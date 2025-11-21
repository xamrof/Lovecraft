// Renderer script moved out of index.html
// --- CONFIGURACIÓN ---
const CORRECT_KEY = "1234"; // ¡CAMBIA ESTO A TU CLAVE REAL!

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

            function continueSequence() {
                // Romper cadenas y hacer la transición al video
                breakTheChains();

                inputCard.style.opacity = '0';
                inputCard.style.transform = 'translateY(-50px) scale(0.95)';
                inputCard.style.pointerEvents = 'none';

                setTimeout(() => {
                    enterFullScreen();

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
                    });

                    inputCard.remove();
                }, 600);
            }

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
                        setTimeout(continueSequence, 120);
                    }
                };
                shackle.addEventListener('transitionend', onEnd);

                // Fallback por si no se dispara transitionend
                setTimeout(() => {
                    shackle.removeEventListener('transitionend', onEnd);
                    continueSequence();
                }, 900);
            } else {
                continueSequence();
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
    videoElement.load();
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
});
