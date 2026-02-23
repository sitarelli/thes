/* -------------------------------------------------------------------------- */
/* MAIN - ENTRY POINT DEL GIOCO                                               */
/* -------------------------------------------------------------------------- */

import { config, gameState, player, setCurrentLevelNumber, setGameRunning, setCurrentMap, setItems, setEnemies, setTriggers, setDecorations, setLavas, setLavaParticles, setDustParticles, setFireworkParticles, setColorParticles, currentLevelNumber, gameRunning, isMobile } from './config.js';
import { initInput, requestFullscreen, setFullscreenActivated } from './input.js';
import { update, respawnPlayer, createColorParticles } from './player.js';
import { initRenderer, draw, updateHUD, setBackgroundForLevel } from './renderer.js';

// Stato power-up timer Pac-Man
export const timerPowerUp = {
    active: false,
    timeLeft: 0
};

// Variabile per impedire il reset dello zoom ad ogni livello
let userHasAdjustedZoom = false;

// Canvas setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let dpr = window.devicePixelRatio || 1;
if (isMobile) {
    dpr = Math.min(dpr, 1.5); 
}

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

// --- AUDIO ---
const preferMP3 = (() => {
    const a = document.createElement('audio');
    return a.canPlayType('audio/mpeg') !== '';
})();

function aud(name) {
    return preferMP3 ? `audio/${name}.mp3` : `audio/${name}.ogg`;
}

const audioDefinitions = {
    doorOpen:   { src: aud('dooropen'),    volume: 0.6 },
    doorClose:  { src: aud('doorclose'),   volume: 0.6 },
    walk:       { src: aud('walkingthes'), volume: 0.4, loop: true },
    fly:        { src: aud('flyingthes'),  volume: 0.5, loop: true },
    levelup:    { src: aud('levelup'),     volume: 0.8 },
    beginLevel: { src: aud('beginlevel'),  volume: 0.7 },
    keyPickup:  { src: aud('key'),         volume: 0.6 },
    death:      { src: aud('death'),       volume: 0.7 },
    contact:    { src: aud('contact'),     volume: 0.6 },
    lava:       { src: aud('lava'),        volume: 0.5 },
    timer:      { src: aud('timer'),       volume: 0.5, loop: true },
    flagPickup: { src: aud('flag'),        volume: 0.6 }
};
export const sfx = {};

Object.keys(audioDefinitions).forEach(name => { sfx[name] = null; });

function loadSingleAudio(name, def) {
    return new Promise(resolve => {
        const audio = new Audio();
        audio.volume = def.volume || 1.0;
        audio.loop = def.loop || false;
        audio.preload = 'auto';
        let resolved = false;
        const done = () => { if (resolved) return; resolved = true; sfx[name] = audio; resolve(); };
        const fail = () => { if (resolved) return; resolved = true; sfx[name] = null; resolve(); };
        audio.addEventListener('canplaythrough', done, { once: true });
        audio.addEventListener('loadeddata', done, { once: true });
        audio.addEventListener('error', fail, { once: true });
        setTimeout(() => { if (!resolved) { if (audio.readyState >= 2) done(); else fail(); } }, 8000);
        audio.src = def.src;
        audio.load();
    });
}

function loadAllAudio(onProgress) {
    const entries = Object.entries(audioDefinitions);
    let done = 0;
    return Promise.all(entries.map(([name, def]) =>
        loadSingleAudio(name, def).then(() => {
            done++;
            if (onProgress) onProgress(done, entries.length);
        })
    ));
}

function updateProgress() {
    const debugInfo = document.getElementById('debug-info');
    if (debugInfo) debugInfo.textContent = `Immagini: ${loadedImages}/${imagesToLoad.length}`;
}

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getOrCreateAudioContext() {
    if (!audioCtx) audioCtx = new AudioContext();
    return audioCtx;
}

export function playSound(type) {
    const audioCtx = getOrCreateAudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (type === 'bonus') { osc.frequency.setValueAtTime(600, now); osc.frequency.linearRampToValueAtTime(1200, now + 0.1); gain.gain.setValueAtTime(0.1, now); osc.start(); osc.stop(now + 0.1); }
    if (type === 'key') { osc.frequency.setValueAtTime(880, now); gain.gain.setValueAtTime(0.1, now); osc.start(); osc.stop(now + 0.1); }
    if (type === 'die' || type === 'hit') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.2); gain.gain.setValueAtTime(0.2, now); osc.start(); osc.stop(now + 0.2); }
    if (type === 'open') { osc.type = 'triangle'; osc.frequency.setValueAtTime(400, now); osc.frequency.linearRampToValueAtTime(800, now + 0.3); gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3); osc.start(); osc.stop(now + 0.3); }
    if (type === 'close') { osc.type = 'triangle'; osc.frequency.setValueAtTime(800, now); osc.frequency.linearRampToValueAtTime(400, now + 0.3); gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3); osc.start(); osc.stop(now + 0.3); }
    if (type === 'win') { osc.frequency.setValueAtTime(523, now); osc.frequency.setValueAtTime(659, now + 0.1); osc.frequency.setValueAtTime(784, now + 0.2); gain.gain.setValueAtTime(0.15, now); osc.start(); osc.stop(now + 0.4); }
}

const _oneShotThrottle = new WeakSet();
export function safePlayAudio(audio) {
    if (!audio || audio.readyState === 0) return;
    if (audio.loop) {
        if (!audio.paused) return;
        audio.play().catch(() => {});
    } else {
        if (_oneShotThrottle.has(audio)) return;
        _oneShotThrottle.add(audio);
        const clone = audio.cloneNode();
        clone.volume = audio.volume;
        clone.addEventListener('ended',  () => _oneShotThrottle.delete(audio), { once: true });
        clone.addEventListener('error',  () => _oneShotThrottle.delete(audio), { once: true });
        clone.play().catch(() => { _oneShotThrottle.delete(audio); });
    }
}

export function stopAllSounds() {
    Object.values(sfx).forEach(audio => { if (audio) { try { audio.pause(); audio.currentTime = 0; } catch(e) {} } });
}

// --- LOGICA ZOOM DEFINITIVA PER MOBILE ---
function initZoomControls() {
    const btnIn = document.getElementById('btn-zoom-in');
    const btnOut = document.getElementById('btn-zoom-out');
    if (!btnIn || !btnOut) return;

    const updateZoom = (delta) => {
        const newZoom = Math.round((config.zoom + delta) * 10) / 10;
        if (newZoom >= 0.3 && newZoom <= 5.0) {
            config.zoom = newZoom;
            userHasAdjustedZoom = true; // L'utente ha preso il controllo, non resettare più
            console.log("Zoom impostato a:", config.zoom);
        }
    };

    // Pointerdown gestisce Touch e Mouse senza lag
    const onPointerDown = (e, delta) => {
        e.preventDefault();
        e.stopPropagation(); 
        updateZoom(delta);
    };

    // Usiamo onpointerdown per massima priorità su Android
    btnIn.onpointerdown = (e) => onPointerDown(e, 0.2);
    btnOut.onpointerdown = (e) => onPointerDown(e, -0.2);
}

// --- INIZIALIZZAZIONE GIOCO ---
initRenderer(canvas, ctx, sprites);
initInput(getOrCreateAudioContext);
initZoomControls();

window.loadLevelData = function(data) { gameState.statusMessage = ""; initGame(data); };

export function loadLevelScript(n) {
    setCurrentLevelNumber(n);
    const old = document.getElementById('level-script'); if (old) old.remove();
    const s = document.createElement('script'); s.id = 'level-script'; s.src = `levels/level${n}.js`;
    s.onerror = () => { if (n === 1) gameState.statusMessage = "Manca level1.js"; else drawVictoryScreen(); };
    document.body.appendChild(s);
}

function initGame(levelData) {
    if (!levelData) return;
    safePlayAudio(sfx.beginLevel);
    gameState.hasKey = false; gameState.hasFlag = false; gameState.doorOpen = false; gameState.won = false; gameState.victoryTime = 0; gameState.power = gameState.maxPower; gameState.gameOver = false;
    timerPowerUp.active = false; timerPowerUp.timeLeft = 0;
    if (sfx.timer && !sfx.timer.paused) { try { sfx.timer.pause(); sfx.timer.currentTime = 0; } catch(e) {} }
    setBackgroundForLevel(currentLevelNumber);
    setCurrentMap(JSON.parse(JSON.stringify(levelData.map)));
    config.tileSize = levelData.tileSize || 20;
    
    // Ricalcola zoom solo se l'utente non lo ha ancora toccato
    if (!userHasAdjustedZoom) {
        const baseZoom = config.viewportHeight / (23 * config.tileSize);
        const mobileMultiplier = isMobile ? 1.5 : 1.0;
        config.zoom = baseZoom * mobileMultiplier;
    }
    
    const tempItems = [], tempEnemies = [], tempTriggers = [], tempDecorations = [], tempLavas = [];
    setLavaParticles([]); setDustParticles([]); setFireworkParticles([]); setColorParticles([]);
    const currentMap = levelData.map;
    for (let y = 0; y < currentMap.length; y++) {
        for (let x = 0; x < currentMap[y].length; x++) {
            const cell = currentMap[y][x];
            const type = (typeof cell === 'object') ? cell.type : cell;
            const group = (typeof cell === 'object') ? cell.group : null;
            if (type === 0 || type === 1) continue;
            let w = 1, h = 1;
            while (x + w < currentMap[y].length) {
                const nextCell = currentMap[y][x + w];
                const nextType = (typeof nextCell === 'object') ? nextCell.type : nextCell;
                const nextGroup = (typeof nextCell === 'object') ? nextCell.group : null;
                if (nextType !== type || nextGroup !== group) break;
                w++;
            }
            let canDown = true;
            while (canDown && y + h < currentMap.length) {
                for (let k = 0; k < w; k++) {
                    const checkCell = currentMap[y + h][x + k];
                    const checkType = (typeof checkCell === 'object') ? checkCell.type : checkCell;
                    const checkGroup = (typeof checkCell === 'object') ? checkCell.group : null;
                    if (checkType !== type || checkGroup !== group) canDown = false;
                }
                if (canDown) h++;
            }
            const pxW = w * config.tileSize, pxH = h * config.tileSize, pxX = x * config.tileSize, pxY = y * config.tileSize;
            if (type === 9) { player.w = pxW; player.h = pxH; player.startX = pxX; player.startY = pxY; respawnPlayer(); } 
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
            for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) currentMap[r][c] = 0;
        }
    }
    setItems(tempItems); setEnemies(tempEnemies); setTriggers(tempTriggers); setDecorations(tempDecorations); setLavas(tempLavas); setCurrentMap(currentMap);
    if (!gameRunning) { setGameRunning(true); requestAnimationFrame(loop); }
}

let lastTime = 0;
let accumulator = 0;
function loop(timestamp) {
    if (!gameRunning) return;
    if (!lastTime) { lastTime = timestamp; requestAnimationFrame(loop); return; }
    let deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (deltaTime > 0.25) deltaTime = 0.25;
    accumulator += deltaTime;
    while (accumulator >= config.fixedTimeStep) {
        update(config.fixedTimeStep, showRetryButton, currentLevelNumber, loadLevelScript); 
        accumulator -= config.fixedTimeStep;
    }
    if (gameState.won && gameState.vX && gameState.vY && Math.random() < 0.3) {
        createColorParticles(gameState.vX + gameState.vW / 2, gameState.vY + gameState.vH / 2, 8 + Math.floor(Math.random() * 4), 'collect');
    }
    draw(gameRunning);
    updateHUD(currentLevelNumber, gameRunning);
    updateKeyHUD();
    requestAnimationFrame(loop);
}

function showRetryButton() {
    document.body.classList.remove('game-active'); 
    const oldBtn = document.getElementById('retry-btn'); if (oldBtn) oldBtn.remove();
    const btn = document.createElement('button');
    btn.id = 'retry-btn'; btn.textContent = 'RIPROVA';
    Object.assign(btn.style, { position: 'absolute', left: '50%', top: '65%', transform: 'translate(-50%, -50%)', padding: '15px 30px', fontSize: '24px', fontFamily: 'Orbitron, sans-serif', cursor: 'pointer', backgroundColor: '#ff0000', color: 'white', border: 'none', borderRadius: '5px', boxShadow: '0 0 15px rgba(255,0,0,0.5)', zIndex: '100' });
    btn.onclick = restartGame;
    document.body.appendChild(btn);
}

function restartGame() {
    document.body.classList.add('game-active'); 
    const btn = document.getElementById('retry-btn'); if (btn) btn.remove();
    gameState.gameOver = false; gameState.power = gameState.maxPower; gameState.hasKey = false; gameState.hasFlag = false;
    loadLevelScript(currentLevelNumber); 
}

const tapOverlay = document.getElementById('tap-to-start');
let gameStarted = false;
async function startGame() {
    if (gameStarted) return;
    gameStarted = true;
    
    // 1. Audio Context
    const actx = getOrCreateAudioContext();
    if (actx.state === 'suspended') await actx.resume().catch(() => {});
    
    // 2. Fullscreen (RIPRISTINATO)
    requestFullscreen();
    setFullscreenActivated(true);

    const debugInfo = document.getElementById('debug-info');
    if (debugInfo) debugInfo.textContent = 'Caricamento audio...';
    await loadAllAudio((done, total) => { if (debugInfo) debugInfo.textContent = `Audio: ${done}/${total}`; });
    
    safePlayAudio(sfx.beginLevel);
    document.body.classList.add('game-active');
    
    if (tapOverlay) { 
        tapOverlay.classList.remove('show'); 
        setTimeout(() => { tapOverlay.style.display = 'none'; }, 300); 
    }
    
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) gameContainer.style.display = 'flex';
    
    if (!gameRunning) loadLevelScript(1);
}

if (tapOverlay) {
    tapOverlay.classList.add('show');
    tapOverlay.addEventListener('touchend', startGame, { passive: true });
    tapOverlay.addEventListener('click', startGame);
}

export function updateKeyHUD() {
    const keyIndicator = document.querySelector('.key-indicator');
    if (keyIndicator) {
        const currentlyHasImg = keyIndicator.querySelector('img');
        const isLit = keyIndicator.classList.contains('has-key');

        if (gameState.hasKey && (!currentlyHasImg || !isLit)) {
            keyIndicator.classList.add('has-key');
            keyIndicator.innerHTML = '<img src="png/key.png" alt="Key">';
        } else if (!gameState.hasKey && (!currentlyHasImg || isLit)) {
            keyIndicator.classList.remove('has-key');
            keyIndicator.innerHTML = '<img src="png/key.png" alt="Key" style="opacity:0.2;">';
        }
    }

    const flagIndicator = document.querySelector('.flag-indicator');
    if (flagIndicator) {
        const currentlyHasImg = flagIndicator.querySelector('img');
        const isLit = flagIndicator.classList.contains('has-flag');

        if (gameState.hasFlag && (!currentlyHasImg || !isLit)) {
            flagIndicator.classList.add('has-flag');
            flagIndicator.innerHTML = '<img src="png/flag.png" alt="Flag">';
        } else if (!gameState.hasFlag && (!currentlyHasImg || isLit)) {
            flagIndicator.classList.remove('has-flag');
            flagIndicator.innerHTML = '<img src="png/flag.png" alt="Flag" style="opacity:0.2;">';
        }
    }
}
