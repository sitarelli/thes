/* -------------------------------------------------------------------------- */
/* MAIN - ENTRY POINT DEL GIOCO (VERSIONE BUNDLE - AUDIO INCORPORATO)        */
/* -------------------------------------------------------------------------- */

import { config, gameState, player, setCurrentLevelNumber, setGameRunning, setCurrentMap, setItems, setEnemies, setTriggers, setDecorations, setLavas, setLavaParticles, setDustParticles, setFireworkParticles, setColorParticles, currentLevelNumber, gameRunning, isMobile } from './config.js';
import { initInput, requestFullscreen, setFullscreenActivated } from './input.js';
import { update, respawnPlayer, createColorParticles } from './player.js';
import { initRenderer, draw, updateHUD, randomizeBrickColor } from './renderer.js';

// Canvas setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Debug zoom e viewport
console.log('🎮 Setup Canvas:', {
    viewport: `${config.viewportWidth}x${config.viewportHeight}`,
    zoom: config.zoom,
    formato: isMobile ? '16:9 widescreen' : '4:3 standard'
});


// Mostra hint F11 solo su desktop
if (!isMobile) {
    const hint = document.createElement('div');
    hint.textContent = 'PREMI F11 PER ANDARE A SCHERMO INTERO';
    hint.style.cssText = 'text-align: center; margin-top: 10px; font-size: 12px; color: #888; font-family: Orbitron, sans-serif;';
    document.getElementById('game-container').appendChild(hint);
}

const dpr = window.devicePixelRatio || 1;
canvas.width = config.viewportWidth * dpr;
canvas.height = config.viewportHeight * dpr;
canvas.style.width = `${config.viewportWidth}px`;
canvas.style.height = `${config.viewportHeight}px`;
ctx.scale(dpr, dpr);
ctx.imageSmoothingEnabled = true;

// --- SPRITES ---
const sprites = {};
let loadedImages = 0;
const imagesToLoad = [
    { name: 'brick', src: 'png/brick.png' },
    { name: 'thes', src: 'png/thes.png' },
    { name: 'woman', src: 'png/woman.png' },
    { name: 'enemyH', src: 'png/enemyh.png' },
    { name: 'enemyV', src: 'png/enemyv.png' },
    { name: 'enemyS', src: 'png/enemys.png' },
    { name: 'enemyX', src: 'png/enemyx.png' },
    { name: 'bulb', src: 'png/bulb.png' },
    { name: 'star', src: 'png/star.png' },
    { name: 'flag', src: 'png/flag.png' },
    { name: 'lava', src: 'png/lava.png' },
    { name: 'key', src: 'png/key.png' },
    { name: 'timer', src: 'png/timer.png' },
    { name: 'door', src: 'png/door.png' },
    { name: 'thes_die', src: 'png/thes_die.png' },
    { name: 'unchained', src: 'png/unchained.png' }
];

imagesToLoad.forEach(imgData => {
    const img = new Image();
    img.src = imgData.src;
    img.onload = () => { loadedImages++; updateProgress(); };
    img.onerror = () => { sprites[imgData.name] = null; loadedImages++; updateProgress(); };
    sprites[imgData.name] = img;
});

/* ==========================================================================
   AUDIO MANAGER - INCORPORATO (NO FILE SEPARATO)
   ========================================================================== */

class AudioManager {
    constructor() {
        this.sounds = {};
        this.audioContext = null;
        this.loadedCount = 0;
        this.totalCount = 0;
        this.onProgressCallback = null;
        this.onCompleteCallback = null;
        
        // Definizione suoni con formati multipli (fallback automatico)
        this.soundDefinitions = {
            doorOpen: { files: ['audio/dooropen.ogg', 'audio/dooropen.mp3'], volume: 0.6 },
            doorClose: { files: ['audio/doorclose.ogg', 'audio/doorclose.mp3'], volume: 0.6 },
            walk: { files: ['audio/walkingthes.ogg', 'audio/walkingthes.mp3'], volume: 0.4, loop: true },
            fly: { files: ['audio/flyingthes.ogg', 'audio/flyingthes.m4a'], volume: 0.5, loop: true },
            levelup: { files: ['audio/levelup.ogg', 'audio/levelup.mp3'], volume: 0.7 },
            beginLevel: { files: ['audio/beginlevel.ogg', 'audio/beginlevel.mp3'], volume: 0.7 },
            keyPickup: { files: ['audio/key.ogg', 'audio/key.mp3'], volume: 0.6 },
            death: { files: ['audio/death.ogg', 'audio/death.mp3'], volume: 0.7 },
            contact: { files: ['audio/contact.ogg', 'audio/contact.mp3'], volume: 0.6 },
            lava: { files: ['audio/lava.ogg', 'audio/lava.mp3'], volume: 0.5 }
        };
        
        this.totalCount = Object.keys(this.soundDefinitions).length;
    }
    
    initAudioContext() {
        if (!this.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        return this.audioContext;
    }
    
    loadAll(onProgress, onComplete) {
        this.onProgressCallback = onProgress;
        this.onCompleteCallback = onComplete;
        this.loadedCount = 0;
        
        console.log('🔊 Inizio caricamento audio...');
        
        Object.entries(this.soundDefinitions).forEach(([name, config]) => {
            this.loadSound(name, config);
        });
    }
    
    loadSound(name, config) {
        const audio = new Audio();
        audio.volume = config.volume || 1.0;
        audio.loop = config.loop || false;
        audio.preload = 'auto';
        
        let currentFormatIndex = 0;
        const tryNextFormat = () => {
            if (currentFormatIndex >= config.files.length) {
                console.warn(`⚠️ Impossibile caricare ${name}`);
                this.onSoundLoaded(name, null);
                return;
            }
            
            const src = config.files[currentFormatIndex];
            console.log(`🎵 Caricamento: ${name} → ${src}`);
            
            audio.src = src;
            
            const timeout = setTimeout(() => {
                console.warn(`⏱️ Timeout ${src}`);
                currentFormatIndex++;
                tryNextFormat();
            }, 2000);
            
            const onSuccess = () => {
                clearTimeout(timeout);
                console.log(`✅ OK: ${name}`);
                this.onSoundLoaded(name, audio);
                cleanup();
            };
            
            const onError = () => {
                clearTimeout(timeout);
                console.warn(`❌ Errore ${src}`);
                currentFormatIndex++;
                tryNextFormat();
                cleanup();
            };
            
            const cleanup = () => {
                audio.removeEventListener('canplaythrough', onSuccess);
                audio.removeEventListener('error', onError);
            };
            
            audio.addEventListener('canplaythrough', onSuccess, { once: true });
            audio.addEventListener('error', onError, { once: true });
            audio.load();
        };
        
        tryNextFormat();
    }
    
    onSoundLoaded(name, audio) {
        this.sounds[name] = audio;
        this.loadedCount++;
        
        const progress = Math.floor((this.loadedCount / this.totalCount) * 100);
        console.log(`📊 Progresso: ${this.loadedCount}/${this.totalCount} (${progress}%)`);
        
        if (this.onProgressCallback) {
            this.onProgressCallback(this.loadedCount, this.totalCount, progress);
        }
        
        if (this.loadedCount >= this.totalCount) {
            console.log('✨ Audio caricati!');
            if (this.onCompleteCallback) {
                this.onCompleteCallback();
            }
        }
    }
    
    play(name) {
        const audio = this.sounds[name];
        if (!audio) {
            console.warn(`Audio '${name}' non trovato`);
            return;
        }
        
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        if (audio.readyState >= 2) {
            audio.currentTime = 0;
        }
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(err => {
                if (err.name === 'NotAllowedError') {
                    console.warn('🔇 Audio bloccato');
                } else if (err.name === 'AbortError') {
                    setTimeout(() => audio.play().catch(() => {}), 50);
                }
            });
        }
    }
    
    stop(name) {
        const audio = this.sounds[name];
        if (!audio) return;
        audio.pause();
        if (audio.readyState >= 2) {
            audio.currentTime = 0;
        }
    }
    
    stopAll() {
        Object.values(this.sounds).forEach(audio => {
            if (audio) {
                audio.pause();
                if (audio.readyState >= 2) {
                    audio.currentTime = 0;
                }
            }
        });
    }
    
    unlock() {
        this.initAudioContext();
        
        Object.values(this.sounds).forEach(audio => {
            if (!audio) return;
            
            const originalVolume = audio.volume;
            audio.volume = 0;
            
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    audio.pause();
                    if (audio.readyState >= 2) {
                        audio.currentTime = 0;
                    }
                    audio.volume = originalVolume;
                }).catch(() => {
                    audio.volume = originalVolume;
                });
            }
        });
        
        console.log('🔓 Audio sbloccato');
    }
}

// Istanza globale
const audioManager = new AudioManager();

/* ==========================================================================
   FINE AUDIO MANAGER
   ========================================================================== */

// Inizia caricamento audio
let audioLoaded = false;
let audioLoadedCount = 0;
let audioTotalCount = 0;

audioManager.loadAll(
    (loaded, total, percent) => {
        audioLoadedCount = loaded;
        audioTotalCount = total;
        updateProgress();
    },
    () => {
        audioLoaded = true;
        console.log('✅ Audio pronti!');
        updateProgress();
    }
);

// Export per retrocompatibilità (wrapper)
export const sfx = {
    get doorOpen() { return audioManager.sounds.doorOpen; },
    get doorClose() { return audioManager.sounds.doorClose; },
    get walk() { return audioManager.sounds.walk; },
    get fly() { return audioManager.sounds.fly; },
    get levelup() { return audioManager.sounds.levelup; },
    get beginLevel() { return audioManager.sounds.beginLevel; },
    get keyPickup() { return audioManager.sounds.keyPickup; },
    get death() { return audioManager.sounds.death; },
    get contact() { return audioManager.sounds.contact; },
    get lava() { return audioManager.sounds.lava; }
};

// PROGRESS BAR
function updateProgress() {
    const total = imagesToLoad.length + audioTotalCount;
    const loaded = loadedImages + audioLoadedCount;
    const percent = Math.floor((loaded / total) * 100);
    
    // Aggiorna UI di loading
    const loadingBar = document.getElementById('loading-progress-bar');
    const loadingText = document.getElementById('loading-text');
    const loadingDetails = document.getElementById('loading-details');
    
    if (loadingBar) loadingBar.style.width = `${percent}%`;
    if (loadingText) loadingText.textContent = `Loading: ${percent}%`;
    if (loadingDetails) {
        loadingDetails.textContent = `Assets: ${loaded}/${total} (Images: ${loadedImages}/${imagesToLoad.length}, Audio: ${audioLoadedCount}/${audioTotalCount})`;
    }
    
    const debugInfo = document.getElementById('debug-info');
    if (debugInfo) {
        debugInfo.textContent = `Loading: ${percent}% (${loaded}/${total})`;
    }
    
    checkStart();
}

function checkStart() { 
    const total = imagesToLoad.length + audioTotalCount;
    const loaded = loadedImages + audioLoadedCount;
    
    if (loaded === total && audioLoaded) {
        const loadingOverlay = document.getElementById('loading-overlay');
        const loadingText = document.getElementById('loading-text');
        const debugInfo = document.getElementById('debug-info');
        
        if (loadingText) loadingText.textContent = '✅ Ready!';
        if (debugInfo) debugInfo.textContent = 'Ready! 🎮 Tap to start';
        
        setTimeout(() => {
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                }, 500);
            }
        }, 500);
        
        loadLevelScript(1);
    }
}

export function playSound(type) {
    if (audioManager.audioContext) {
        if (audioManager.audioContext.state === 'suspended') {
            audioManager.audioContext.resume();
        }
        
        const ctx = audioManager.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); 
        gain.connect(ctx.destination);
        const now = ctx.currentTime;
    
    if (type === 'bonus') { 
        osc.frequency.setValueAtTime(600, now); 
        osc.frequency.linearRampToValueAtTime(1200, now + 0.1); 
        gain.gain.setValueAtTime(0.1, now); 
        osc.start(); 
        osc.stop(now + 0.1); 
    }
    if (type === 'key') { 
        osc.frequency.setValueAtTime(880, now); 
        gain.gain.setValueAtTime(0.1, now); 
        osc.start(); 
        osc.stop(now + 0.1); 
    }
    if (type === 'die' || type === 'hit') { 
        osc.type = 'sawtooth'; 
        osc.frequency.setValueAtTime(150, now); 
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.2); 
        gain.gain.setValueAtTime(0.2, now); 
        osc.start(); 
        osc.stop(now + 0.2); 
    }
    if (type === 'open') { 
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now); 
        osc.frequency.linearRampToValueAtTime(800, now + 0.3); 
        gain.gain.setValueAtTime(0.15, now); 
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(); 
        osc.stop(now + 0.3); 
    }
    if (type === 'close') { 
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now); 
        osc.frequency.linearRampToValueAtTime(400, now + 0.3); 
        gain.gain.setValueAtTime(0.15, now); 
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(); 
        osc.stop(now + 0.3); 
    }
    if (type === 'win') { 
        osc.frequency.setValueAtTime(523, now); 
        osc.frequency.setValueAtTime(659, now + 0.1); 
        osc.frequency.setValueAtTime(784, now + 0.2); 
        gain.gain.setValueAtTime(0.15, now); 
        osc.start(); 
        osc.stop(now + 0.4); 
    }
    }
}

export function safePlayAudio(audio) {
    if (!audio) return;
    audioManager.initAudioContext();
    
    if (audio.readyState >= 2) {
        audio.currentTime = 0;
    }
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise.catch(err => {
            if (err.name === 'NotAllowedError') {
                console.warn('🔇 Audio bloccato');
            } else if (err.name === 'AbortError') {
                setTimeout(() => {
                    audio.play().catch(() => {});
                }, 50);
            }
        });
    }
}

export function stopAllSounds() {
    audioManager.stopAll();
}

// Inizializza renderer
initRenderer(canvas, ctx, sprites, config);
initInput(audioManager.audioContext || new (window.AudioContext || window.webkitAudioContext)());

// Carica un livello
function loadLevelScript(levelNum) {
    setCurrentLevelNumber(levelNum);
    const script = document.createElement('script');
    script.type = 'module';
    script.src = `levels/level${levelNum}.js`;
    script.onload = () => console.log(`✅ Livello ${levelNum} caricato`);
    script.onerror = () => {
        console.error(`❌ Errore caricamento livello ${levelNum}`);
        gameState.statusMessage = `Livello ${levelNum} non trovato`;
    };
    document.head.appendChild(script);
}

export function loadLevel(levelData) {
    console.log(`🎮 Avvio livello ${currentLevelNumber}...`);
    
    gameState.won = false;
    gameState.gameOver = false;
    gameState.hasKey = false;
    gameState.doorOpen = false;
    gameState.stars = 0;
    gameState.flags = 0;
    gameState.bulbs = 0;
    gameState.power = gameState.maxPower;
    gameState.statusMessage = `Livello ${currentLevelNumber}`;
    gameState.victoryTime = 0;

    config.tileSize = levelData.tileSize || 30;
    config.baseGravity = levelData.gravity !== undefined ? levelData.gravity : 0.45;
    config.baseSpeed = levelData.speed !== undefined ? levelData.speed : 15.0;
    config.baseThrust = levelData.thrust !== undefined ? levelData.thrust : -0.80;
    config.maxFallSpeed = levelData.maxFallSpeed !== undefined ? levelData.maxFallSpeed : 4.6;
    config.maxFlySpeed = levelData.maxFlySpeed !== undefined ? levelData.maxFlySpeed : -0.36;

    let currentMap = levelData.map.map(row => row.slice());
    setLavaParticles([]);
    setDustParticles([]);
    setFireworkParticles([]);
    setColorParticles([]);
    randomizeBrickColor();

    let tempItems = [];
    let tempEnemies = [];
    let tempTriggers = [];
    let tempDecorations = [];
    let tempLavas = [];

    for (let y = 0; y < currentMap.length; y++) {
        for (let x = 0; x < currentMap[y].length; x++) {
            const cell = currentMap[y][x];
            if (cell === 0 || cell === 1) continue;

            const type = (typeof cell === 'object') ? cell.type : cell;
            const group = (typeof cell === 'object') ? cell.group : null;

            let w = 1, h = 1;

            for (let dx = x + 1; dx < currentMap[y].length; dx++) {
                const checkCell = currentMap[y][dx];
                const checkType = (typeof checkCell === 'object') ? checkCell.type : checkCell;
                const checkGroup = (typeof checkCell === 'object') ? checkCell.group : null;
                if (checkType !== type || checkGroup !== group) break;
                w++;
            }

            for (let dy = y + 1; dy < currentMap.length; dy++) {
                let canDown = true;
                for (let dx = x; dx < x + w; dx++) {
                    const checkCell = currentMap[dy][dx];
                    const checkType = (typeof checkCell === 'object') ? checkCell.type : checkCell;
                    const checkGroup = (typeof checkCell === 'object') ? checkCell.group : null;
                    if (checkType !== type || checkGroup !== group) canDown = false;
                }
                if (canDown) h++;
            }
            
            const pxW = w * config.tileSize;
            const pxH = h * config.tileSize;
            const pxX = x * config.tileSize;
            const pxY = y * config.tileSize;
            
            if (type === 9) { 
                player.w = pxW; 
                player.h = pxH; 
                player.startX = pxX; 
                player.startY = pxY; 
                respawnPlayer(); 
            } 
            else if (type === 2) tempLavas.push({ x: pxX, y: pxY, w: pxW, h: pxH });
            else if (type === 10) tempItems.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'key', taken: false });
            else if (type === 12) tempItems.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'star', taken: false });
            else if (type === 7) tempItems.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'flag', taken: false });
            else if (type === 8) tempItems.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'bulb', taken: false });
            else if (type === 4) tempTriggers.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'open', group: group || 'A' });
            else if (type === 5) tempTriggers.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'close', group: group || 'A' });
            else if (type === 6) tempTriggers.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'door', group: group || 'A', open: false });
            else if (type === 3) tempDecorations.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'woman' });
            else if (type === 11) tempEnemies.push({ x: pxX, y: pxY, w: pxW, h: pxH, vx: config.enemySpeedMultiplier * config.tileSize, vy: 0, type: 'H' });
            else if (type === 13) tempEnemies.push({ x: pxX, y: pxY, w: pxW, h: pxH, vx: 0, vy: config.enemySpeedMultiplier * config.tileSize, type: 'V' });
            else if (type === 14) tempEnemies.push({ x: pxX, y: pxY, w: pxW, h: pxH, vx: 0, vy: 0, type: 'S' });
            else if (type === 15) tempEnemies.push({ x: pxX, y: pxY, w: pxW, h: pxH, vx: config.enemySpeedMultiplier * config.tileSize, vy: 0, type: 'X' });
            else if (type === 16) tempItems.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'timer', taken: false });

            for (let r = y; r < y + h; r++) {
                for (let c = x; c < x + w; c++) {
                    currentMap[r][c] = 0;
                }
            }
        }
    }

    setItems(tempItems);
    setEnemies(tempEnemies);
    setTriggers(tempTriggers);
    setDecorations(tempDecorations);
    setLavas(tempLavas);
    setCurrentMap(currentMap);

    lastTime = 0;        
    accumulator = 0;    

    if (!gameRunning) { 
        setGameRunning(true);
        requestAnimationFrame(loop); 
    }
}

// GAME LOOP
let lastTime = 0;
let accumulator = 0;
let fireworkTimer = 0;

function loop(timestamp) {
    if (!gameRunning) return;
    if (!lastTime) { 
        lastTime = timestamp; 
        requestAnimationFrame(loop); 
        return; 
    }
    
    let deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (deltaTime > 0.25) deltaTime = 0.25;
    
    accumulator += deltaTime;
    
    let updatesThisFrame = 0;
    const maxUpdatesPerFrame = isMobile ? 2 : 3;
    
    while (accumulator >= config.fixedTimeStep && updatesThisFrame < maxUpdatesPerFrame) {
        update(config.fixedTimeStep, showRetryButton, currentLevelNumber, loadLevelScript); 
        accumulator -= config.fixedTimeStep;
        updatesThisFrame++;
    }
    
    if (accumulator > config.fixedTimeStep * 5) {
        accumulator = 0;
    }
    
    if (gameState.won && gameState.vX && gameState.vY) {
        if (Math.random() < 0.3) {
            const centerX = gameState.vX + gameState.vW / 2;
            const centerY = gameState.vY + gameState.vH / 2;
            createColorParticles(centerX, centerY, 8 + Math.floor(Math.random() * 4), 'collect');
        }
    }
    
    draw(gameRunning);
    updateHUD(currentLevelNumber, gameRunning);
    requestAnimationFrame(loop);
}

// RETRY BUTTON
function showRetryButton() {
    document.body.classList.remove('game-active'); 
    
    const oldBtn = document.getElementById('retry-btn');
    if (oldBtn) oldBtn.remove();

    const btn = document.createElement('button');
    btn.id = 'retry-btn';
    btn.textContent = 'RIPROVA';
    Object.assign(btn.style, {
        position: 'absolute', 
        left: '50%', 
        top: '65%',
        transform: 'translate(-50%, -50%)', 
        padding: '15px 30px',
        fontSize: '24px', 
        fontFamily: 'Orbitron, sans-serif',
        cursor: 'pointer', 
        backgroundColor: '#ff0000', 
        color: 'white',
        border: 'none', 
        borderRadius: '5px', 
        boxShadow: '0 0 15px rgba(255,0,0,0.5)',
        zIndex: '100'
    });
    btn.onclick = restartGame;
    document.body.appendChild(btn);
}

function restartGame() {
    document.body.classList.add('game-active'); 
    
    const btn = document.getElementById('retry-btn');
    if (btn) btn.remove();

    gameState.gameOver = false;
    gameState.power = gameState.maxPower; 
    gameState.hasKey = false;
    
    loadLevelScript(currentLevelNumber); 
}

// TAP TO START
function isMobileDevice() { 
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent); 
}

function isIOS() { 
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; 
}

let fullscreenActivated = false;
const tapOverlay = document.getElementById('tap-to-start');

function startGame() {
    audioManager.unlock();
    safePlayAudio(sfx.beginLevel);
    
    document.body.classList.add('game-active');
    
    if (tapOverlay) {
        tapOverlay.classList.remove('show');
        setTimeout(() => tapOverlay.style.display = 'none', 300);
    }
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) gameContainer.style.display = 'flex';
    
    setTimeout(() => requestFullscreen(), 100);
    fullscreenActivated = true;
    setFullscreenActivated(true);
    
    if (isIOS()) setTimeout(() => window.scrollTo(0, 1), 200);
    
    if (!gameRunning) { 
        setGameRunning(true);
        lastTime = 0; 
        accumulator = 0; 
        requestAnimationFrame(loop); 
    }
}

if (tapOverlay) {
    tapOverlay.classList.add('show');
    tapOverlay.addEventListener('touchend', function(e) { 
        e.preventDefault(); 
        startGame(); 
    }, { passive: false });
    tapOverlay.addEventListener('click', function(e) { 
        e.preventDefault(); 
        startGame(); 
    });
}
