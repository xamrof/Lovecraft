// Renderer script moved out of index.html
// --- CONFIGURACIÓN ---
const CORRECT_KEY = "1234"; // ¡CAMBIA ESTO A TU CLAVE REAL!

// Sockets: ajustar la URL al servidor desplegado en Railway.
// Para desarrollo local use: ws://localhost:8080
// Usar WSS en producción (Railway) sin especificar puerto; Railway gestiona el puerto.
const SOCKET_SERVER_URL = window.SOCKET_SERVER_URL || 'wss://servecito-production.up.railway.app';

// Identificador único del cliente (persistente) para evitar reproducir dos veces
function getClientId() {
    try {
        let id = localStorage.getItem('lovecraft_client_id');
        if (!id) {
            id = Math.random().toString(36).slice(2) + Date.now().toString(36);
            localStorage.setItem('lovecraft_client_id', id);
        }
        return id;
    } catch (e) { return 'unknown'; }
}
const CLIENT_ID = getClientId();

// WebSocket connection and helpers
let socket = null;
let pendingPlayResponse = null;
// Cola para plays remotos recibidos antes de que la página esté lista
window._lovecraft_pending_plays = window._lovecraft_pending_plays || [];
function connectSocket() {
    try {
        socket = new WebSocket(SOCKET_SERVER_URL);
        socket.addEventListener('open', () => {
            console.log('Socket connected to', SOCKET_SERVER_URL);
            try { socket.send(JSON.stringify({ type: 'hello', clientId: CLIENT_ID, ts: Date.now() })); } catch (e) {}
        });
        socket.addEventListener('close', (ev) => {
            console.log('Socket closed (code=', ev.code, 'reason=', ev.reason, '), retrying in 3s');
            setTimeout(connectSocket, 3000);
        });
        socket.addEventListener('error', (err) => {
            console.error('Socket error', err);
        });
        socket.addEventListener('message', (ev) => {
            console.log('Socket message raw:', ev.data);
            try {
                const data = JSON.parse(ev.data);
                if (data && data.type === 'play') handleRemotePlay(data);
                else console.log('Socket message (ignored type):', data && data.type);
            } catch (e) { console.warn('Invalid socket message JSON', e); }
        });
    } catch (e) {
        console.warn('Socket connection failed', e);
    }
}
connectSocket();

function requestCoordinatedPlay() {
    return new Promise((resolve) => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            resolve(null);
            return;
        }
        // Esperar una respuesta del servidor con startAt
        pendingPlayResponse = (data) => resolve(data);
        socket.send(JSON.stringify({ type: 'request_play', clientId: CLIENT_ID, clientTime: Date.now() }));
        // fallback si no responde en 2s
        setTimeout(() => {
            if (pendingPlayResponse) { pendingPlayResponse = null; resolve(null); }
        }, 2000);
    });
}

function handleRemotePlay(data) {
    if (!data) return;
    if (pendingPlayResponse) {
        // respuesta a una solicitud local
        pendingPlayResponse(data);
        pendingPlayResponse = null;
        return;
    }
    // Si viene de otro cliente, programar reproducción
    if (data.origin === CLIENT_ID) return; // Ignorar si es nuestro propio eco
    const startAt = data.startAt || Date.now();
    const delay = Math.max(0, startAt - Date.now());
    console.log('Coordinated play received, starting in', delay, 'ms');
    console.log('handleRemotePlay: remoteTriggerPlay typeof=', typeof window.remoteTriggerPlay, 'handlers_ready=', !!window._lovecraft_handlers_ready);

    // Si la página aún no ha inicializado el handler, encolamos el play
    const remotePlayTask = { startAt, origin: data.origin };
    if (typeof window.remoteTriggerPlay !== 'function' && !window._lovecraft_handlers_ready) {
        console.log('Handler no listo aun, encolando remote play');
        window._lovecraft_pending_plays.push(remotePlayTask);
        return;
    }

    setTimeout(() => {
        try {
            console.log('handleRemotePlay timeout: remoteTriggerPlay typeof=', typeof window.remoteTriggerPlay, 'handlers_ready=', !!window._lovecraft_handlers_ready);
            if (typeof window.remoteTriggerPlay === 'function') {
                window.remoteTriggerPlay();
            } else {
                // No handler yet: attempt to dispatch a custom event
                try { window.dispatchEvent(new CustomEvent('lovecraft-remote-play')); } catch (e) { console.warn('dispatch lovecraft-remote-play failed', e); }
            }
        } catch (err) { console.error('handleRemotePlay setTimeout threw', err); }
    }, delay);
}

function getCssVariable(variableName) {
    return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}

function enterFullScreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.getElementById('secret-key-input');
    const messageArea = document.getElementById('message-area');
    const inputCard = document.getElementById('key-input-card');
    const videoContainer = document.getElementById('video-container');
    const videoElement = document.getElementById('secret-video');
    const chainTop = document.getElementById('chain-top');
    const lockIcon = document.getElementById('lock-icon');
    const activateButton = document.getElementById('activate-button');

    // Marcar handlers listos y procesar plays pendientes (si hubo señal antes de la carga)
    window._lovecraft_handlers_ready = true;
    try {
        if (window._lovecraft_pending_plays && window._lovecraft_pending_plays.length) {
            console.log('Procesando plays pendientes:', window._lovecraft_pending_plays.length);
            window._lovecraft_pending_plays.forEach(task => {
                const delay = Math.max(0, (task.startAt || Date.now()) - Date.now());
                setTimeout(() => {
                    if (typeof window.remoteTriggerPlay === 'function') window.remoteTriggerPlay();
                    else window.dispatchEvent(new CustomEvent('lovecraft-remote-play'));
                }, delay);
            });
            window._lovecraft_pending_plays = [];
        }
    } catch (e) { console.warn('Flush pending plays failed', e); }

    // Cursor control for immersive playback
    let cursorTimer = null;
    function hideCursor() {
        document.body.classList.add('hide-cursor');
    }
    function showCursor() {
        document.body.classList.remove('hide-cursor');
    }
    function scheduleHideCursor(delay = 2000) {
        if (cursorTimer) clearTimeout(cursorTimer);
        cursorTimer = setTimeout(() => {
            hideCursor();
            cursorTimer = null;
        }, delay);
    }

    function showMessage(text, isError = true) {
        const color = isError ? getCssVariable('--color-error') : getCssVariable('--color-accent');
        messageArea.textContent = text;
        messageArea.style.color = color;
        messageArea.classList.add('opacity-100');
        setTimeout(() => {
            messageArea.classList.remove('opacity-100');
        }, 4000);
    }

    function setLockColor(variableName) {
        const color = getCssVariable(variableName);
        lockIcon.style.stroke = color;
        activateButton.style.borderColor = color;
        activateButton.style.boxShadow = `0 0 15px ${color}`;
    }

    function breakTheChains() {
        const links = chainTop.querySelectorAll('.chain-link');
        links.forEach((link, index) => {
            link.style.opacity = '0';
            link.style.transform = `translateY(${index === 0 ? '-30px' : '30px'}) rotate(${index === 0 ? '-15deg' : '15deg'})`;
        });
        setTimeout(() => {
            chainTop.style.display = 'none';
        }, 500);
    }

    function checkKey() {
        const enteredKey = inputField.value.trim();

        if (enteredKey === CORRECT_KEY) {
            setLockColor('--color-accent');
            showMessage("The Seal has been accepted. Reality fades...", false);

            // Animar apertura del candado antes de la siguiente secuencia
            const shackle = document.getElementById('lock-shackle');
            const body = document.getElementById('lock-body');

            // Reproduce un efecto sonoro metálico breve al desbloquear
            function playUnlockSound() {
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();

                    // Clic metálico: breve oscilador y ruido filtrado
                    const osc = ctx.createOscillator();
                    const oscGain = ctx.createGain();
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(1200, ctx.currentTime);
                    oscGain.gain.setValueAtTime(0, ctx.currentTime);

                    // Envelope para oscilador (rápido)
                    oscGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.001);
                    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

                    // Ruido breve
                    const bufferSize = ctx.sampleRate * 0.08; // 80ms
                    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                    const data = noiseBuffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
                    const noise = ctx.createBufferSource();
                    noise.buffer = noiseBuffer;

                    const noiseGain = ctx.createGain();
                    noiseGain.gain.setValueAtTime(0.08, ctx.currentTime);
                    noiseGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

                    // Filtro para hacer ruido más metálico
                    const band = ctx.createBiquadFilter();
                    band.type = 'bandpass';
                    band.frequency.value = 1800;
                    band.Q.value = 0.8;

                    // Conexiones
                    osc.connect(oscGain).connect(ctx.destination);
                    noise.connect(noiseGain).connect(band).connect(ctx.destination);

                    // Start
                    noise.start(ctx.currentTime);
                    osc.start(ctx.currentTime);
                    // Stop
                    noise.stop(ctx.currentTime + 0.09);
                    osc.stop(ctx.currentTime + 0.2);
                } catch (err) {
                    console.warn('Audio playback failed:', err);
                }
            }

            // Muestra el contenedor de video y lo reproduce (misma lógica para local y remoto)
            function showVideoAndPlay() {
                console.log('showVideoAndPlay invoked');
                try {
                breakTheChains();

                inputCard.style.opacity = '0';
                inputCard.style.transform = 'translateY(-50px) scale(0.95)';
                inputCard.style.pointerEvents = 'none';

                setTimeout(() => {
                    try {
                        enterFullScreen();
                    } catch (errEnter) {
                        console.warn('enterFullScreen failed', errEnter);
                    }

                    videoContainer.style.display = 'block';
                    videoContainer.classList.add('fade-in');

                    // Play the video and hide the cursor for immersion once playback starts
                    videoElement.play().then(() => {
                        try {
                            hideCursor();
                            // When the user moves the mouse, show the cursor briefly
                            const onMouseMove = () => {
                                showCursor();
                                scheduleHideCursor(2000);
                            };
                            document.addEventListener('mousemove', onMouseMove);

                            // When the video ends, restore cursor and cleanup
                            const onVideoEnd = () => {
                                showCursor();
                                document.removeEventListener('mousemove', onMouseMove);
                                videoElement.removeEventListener('ended', onVideoEnd);
                                if (cursorTimer) { clearTimeout(cursorTimer); cursorTimer = null; }
                            };
                            videoElement.addEventListener('ended', onVideoEnd);
                        } catch (err) {
                            console.warn('Cursor control failed:', err);
                        }
                    }).catch(error => {
                        console.error("Error trying to play the video:", error);
                        // Autoplay may be blocked by policy (no user gesture). Try fallback: play muted.
                        if (!videoElement.muted) {
                            console.log('Attempting muted fallback play');
                            videoElement.muted = true;
                            videoElement.play().then(() => {
                                console.log('Muted fallback play succeeded');
                                showUnmuteButton();
                            }).catch(err2 => {
                                console.error('Muted fallback failed', err2);
                                showPlaybackClickOverlay();
                            });
                        } else {
                            showPlaybackClickOverlay();
                        }
                    });

                    inputCard.remove();
                }, 600);
                } catch (err) {
                    console.error('showVideoAndPlay threw', err);
                }
            }

            // Orquestador: solicita al servidor una reproducción coordinada y programa el inicio
            function orchestratePlay() {
                requestCoordinatedPlay().then(response => {
                    if (response && response.startAt) {
                        const delay = Math.max(0, response.startAt - Date.now());
                        console.log('Playing at server startAt, delay', delay);
                        setTimeout(showVideoAndPlay, delay);
                    } else {
                        // Sin servidor o sin respuesta: reproducir inmediatamente
                        showVideoAndPlay();
                    }
                }).catch(() => {
                    showVideoAndPlay();
                });
            }

            // Cuando una señal remota pide reproducir (desde otro cliente)
            function remoteTriggerPlay() {
                console.log('remoteTriggerPlay invoked');
                try {
                    // Si ya estamos reproduciendo, no hacer nada
                    if (!videoElement.paused && videoElement.currentTime > 0) { console.log('remoteTriggerPlay: already playing'); return; }
                    showVideoAndPlay();
                } catch (e) {
                    console.error('remoteTriggerPlay threw', e);
                }
            }
            // Exponer para que el handler socket (que está fuera de este scope) pueda invocarlo
            window.remoteTriggerPlay = remoteTriggerPlay;
            // También escuchar un evento en caso de que el handler lo prefiera
            window.addEventListener('lovecraft-remote-play', () => remoteTriggerPlay());

            if (shackle) {
                // Reproducir sonido y añadir clase para iniciar la apertura; escuchar transición para continuar
                playUnlockSound();
                shackle.classList.add('unlock');
                if (body) body.classList.add('unlock-shift');

                // Esperar el fin de la transición del shackle
                const onEnd = (e) => {
                    if (e.propertyName === 'transform' || e.propertyName === 'all') {
                        shackle.removeEventListener('transitionend', onEnd);
                        // Un pequeño retardo para que la apertura se asiente visualmente
                        setTimeout(orchestratePlay, 120);
                    }
                };
                shackle.addEventListener('transitionend', onEnd);

                // Fallback por si no se dispara transitionend
                setTimeout(() => {
                    shackle.removeEventListener('transitionend', onEnd);
                    orchestratePlay();
                }, 900);
            } else {
                orchestratePlay();
            }
        } else {
            setLockColor('--color-error');
            showMessage("Incorrect Symbol. The Void awaits you.");
            inputField.value = '';
            inputField.focus();

            setTimeout(() => {
                setLockColor('--color-text');
                activateButton.style.boxShadow = 'none';
                activateButton.style.borderColor = getCssVariable('--chain-color');
            }, 1000);
        }
    }

    // Exponer globalmente para los handlers inline en el HTML
    window.checkKey = checkKey;

    // Inicialización: preparar el video pero NO reproducir automáticamente
    // If preload exposed a packaged path, use it so the packaged app can find the video reliably
    try {
        if (window.electronAPI && typeof window.electronAPI.getVideoPath === 'function') {
            const p = window.electronAPI.getVideoPath();
            if (p) {
                console.log('Using packaged video path:', p);
                // set as src on the video element
                try {
                    // If source child exists, update its src, otherwise set videoElement.src
                    const srcEl = videoElement.querySelector('source');
                    if (srcEl) srcEl.src = p;
                    else videoElement.src = p;
                } catch (e) { videoElement.src = p; }
            }
        }
    } catch (e) { console.warn('getVideoPath failed', e); }
    videoElement.load();
    // Registrar listeners para depuración y estado
    try {
        videoElement.addEventListener('play', () => console.log('video event: play'));
        videoElement.addEventListener('playing', () => console.log('video event: playing'));
        videoElement.addEventListener('pause', () => console.log('video event: pause'));
        videoElement.addEventListener('ended', () => console.log('video event: ended'));
        videoElement.addEventListener('error', (e) => console.error('video event: error', e));
    } catch (e) { console.warn('Could not attach video event listeners', e); }
    // Asegurarse de que no entre en loop: reproducirá solo una vez al desbloquear
    try {
        videoElement.muted = false;
    } catch (e) {}
    videoElement.volume = 0.8;
    videoElement.loop = false;
    inputField.focus();
    setLockColor('--color-text');
    activateButton.style.borderColor = getCssVariable('--chain-color');

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            console.log("The Barrier is broken.");
        } else {
            console.log("The Seal has reformed.");
        }
    });
    
    // --- Helpers for autoplay fallbacks ---
    function showUnmuteButton() {
        try {
            const existing = document.getElementById('unmute-button');
            if (existing) return;
            const btn = document.createElement('button');
            btn.id = 'unmute-button';
            btn.textContent = 'Unmute';
            Object.assign(btn.style, {
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                padding: '12px 18px',
                'zIndex': 9999,
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
            });
            btn.addEventListener('click', () => {
                try {
                    videoElement.muted = false;
                    btn.remove();
                } catch (e) { console.warn('Unmute failed', e); }
            });
            document.body.appendChild(btn);
        } catch (e) { console.warn('showUnmuteButton failed', e); }
    }

    function showPlaybackClickOverlay() {
        try {
            const existing = document.getElementById('playback-overlay');
            if (existing) return;
            const overlay = document.createElement('div');
            overlay.id = 'playback-overlay';
            Object.assign(overlay.style, {
                position: 'fixed',
                inset: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.35)',
                zIndex: 9998,
                cursor: 'pointer'
            });
            const text = document.createElement('div');
            text.textContent = 'Click to start playback';
            Object.assign(text.style, {
                padding: '18px 26px',
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                borderRadius: '8px',
                fontSize: '18px'
            });
            overlay.appendChild(text);
            overlay.addEventListener('click', async () => {
                try {
                    await videoElement.play();
                    overlay.remove();
                    // If it played muted, try to unmute after user gesture
                    if (videoElement.muted) {
                        videoElement.muted = false;
                    }
                } catch (e) {
                    console.error('Click-to-play failed', e);
                }
            });
            document.body.appendChild(overlay);
        } catch (e) { console.warn('showPlaybackClickOverlay failed', e); }
    }
});
