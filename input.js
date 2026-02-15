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

    let startX = 0;
    const maxDist = 40; 
    const deadZone = 10; 

    joystickBase.addEventListener('touchstart', (e) => {
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        e.preventDefault();
        startX = e.changedTouches[0].clientX;
    }, { passive: false });

    joystickBase.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const currentX = e.changedTouches[0].clientX;
        const deltaX = currentX - startX;
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
    }, { passive: false });

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

function checkOrientation() {
    const rotateMsg = document.getElementById('rotate-message');
    if (rotateMsg && window.innerWidth < 900) {
        if (window.innerHeight > window.innerWidth) rotateMsg.style.display = 'flex';
        else rotateMsg.style.display = 'none';
    }
}

function initOrientation() {
    window.addEventListener('load', checkOrientation);
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

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
