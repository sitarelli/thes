/* -------------------------------------------------------------------------- */
/* GESTIONE INPUT (TASTIERA E TOUCH)                                          */
/* -------------------------------------------------------------------------- */

import { keys } from './config.js';

let audioCtx = null;

export function initInput(audioContext) {
    audioCtx = audioContext;
    initKeyboard();
    initTouchControls();
    initOrientation();
}

function initKeyboard() {
    window.addEventListener('keydown', e => { 
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); 
        if (e.code === 'ArrowRight') keys.right = true; 
        if (e.code === 'ArrowLeft') keys.left = true; 
        if (e.code === 'Space') keys.up = true; 
    });
    
    window.addEventListener('keyup', e => { 
        if (e.code === 'ArrowRight') keys.right = false; 
        if (e.code === 'ArrowLeft') keys.left = false; 
        if (e.code === 'Space') keys.up = false; 
    });
}

function initTouchControls() {
    const joystickBase = document.getElementById('joystick-base');
    const joystickStick = document.getElementById('joystick-stick');
    const btnFly = document.getElementById('btn-fly');
    
    if (!joystickBase || !btnFly) return;

    const maxDist = 40; 
    const deadZone = 15; // Aumentata per evitare scatti

    const handleJoystick = (e) => {
        e.preventDefault();
        // Usiamo targetTouches[0] per prendere solo il dito che sta toccando il joystick
        // ignorando eventuali altri tocchi (come il tasto FLY)
        const touch = e.targetTouches[0];
        if (!touch) return;

        const rect = joystickBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        
        // Calcoliamo la distanza dal centro fisico della base
        const deltaX = touch.clientX - centerX;
        const moveX = Math.max(-maxDist, Math.min(maxDist, deltaX));
        
        joystickStick.style.transform = `translate(calc(-50% + ${moveX}px), -50%)`;
        
        if (moveX < -deadZone) { 
            keys.left = true; 
            keys.right = false; 
        } 
        else if (moveX > deadZone) { 
            keys.right = true; 
            keys.left = false; 
        } 
        else { 
            keys.left = false; 
            keys.right = false; 
        }
    };

    joystickBase.addEventListener('touchstart', (e) => {
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        handleJoystick(e);
    }, { passive: false });

    joystickBase.addEventListener('touchmove', handleJoystick, { passive: false });

    const resetJoystick = (e) => {
        if (e) e.preventDefault();
        keys.left = false; 
        keys.right = false;
        joystickStick.style.transform = `translate(-50%, -50%)`;
    };

    joystickBase.addEventListener('touchend', resetJoystick);
    joystickBase.addEventListener('touchcancel', resetJoystick);

    btnFly.addEventListener('touchstart', (e) => { 
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); 
        e.preventDefault(); 
        keys.up = true; 
    }, { passive: false });
    
    btnFly.addEventListener('touchend', (e) => { 
        e.preventDefault(); 
        keys.up = false; 
    });
    
    btnFly.addEventListener('touchcancel', (e) => { 
        e.preventDefault(); 
        keys.up = false; 
    });
}

function isMobileDevice() { 
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent); 
}

function isIOS() { 
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; 
}

// Rileva se siamo in un'app Capacitor (APK)
function isCapacitor() {
    return window.Capacitor !== undefined;
}

function checkOrientation() {
    if (isCapacitor()) {
        const rotateMsg = document.getElementById('rotate-message');
        if (rotateMsg) {
            rotateMsg.style.display = 'none';
            rotateMsg.style.pointerEvents = 'none';
        }
        return;
    }
    
    const rotateMsg = document.getElementById('rotate-message');
    if (rotateMsg) {
        if (window.innerWidth < 900 && window.innerHeight > window.innerWidth) {
            rotateMsg.style.display = 'flex';
            rotateMsg.style.pointerEvents = 'auto';
        } else {
            rotateMsg.style.display = 'none';
            rotateMsg.style.pointerEvents = 'none';
            const tapOverlay = document.getElementById('tap-to-start');
            if (tapOverlay && tapOverlay.classList.contains('show')) {
                tapOverlay.style.pointerEvents = 'auto';
            }
        }
    }
}

function initOrientation() {
    window.addEventListener('load', checkOrientation);
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 350));

    if (isIOS()) {
        window.addEventListener('load', () => setTimeout(() => window.scrollTo(0, 1), 100));
        window.addEventListener('touchstart', () => { 
            if (fullscreenActivated) setTimeout(() => window.scrollTo(0, 1), 0); 
        });
        window.addEventListener('resize', () => { 
            if (fullscreenActivated) setTimeout(() => window.scrollTo(0, 1), 0); 
        });
    }
}

// Fullscreen
let fullscreenActivated = false;

export function requestFullscreen() {
    if (isCapacitor()) return;
    
    const elem = document.documentElement;
    if (isMobileDevice()) {
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => console.log('Fullscreen failed:', err));
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        }
    }
}

export function setFullscreenActivated(value) {
    fullscreenActivated = value;
}
