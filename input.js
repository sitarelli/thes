/* -------------------------------------------------------------------------- */
/* GESTIONE INPUT (TASTIERA E TOUCH) - Versione APK Android                  */
/* Rimossi: overlay rotazione, richiesta fullscreen, scrollTo iOS            */
/* L'APK gestisce orientation=landscape e fullscreen tramite AndroidManifest */
/* -------------------------------------------------------------------------- */

import { keys } from './config.js';

let audioCtx = null;

export function initInput(audioContext) {
    audioCtx = audioContext;
    initKeyboard();
    initTouchControls();
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

// Stub esportati per compatibilità con main.js (non fanno nulla nell'APK)
export function requestFullscreen() {}
export function setFullscreenActivated(value) {}
