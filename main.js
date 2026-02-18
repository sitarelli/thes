/* -------------------------------------------------------------------------- */
/* MAIN - ENTRY POINT DEL GIOCO                                               */
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

// --- DEFINIZIONI AUDIO (solo OGG) ---
const audioDefinitions = {
    doorOpen:   { src: 'audio/dooropen.ogg',    volume: 0.6 },
    doorClose:  { src: 'audio/doorclose.ogg',   volume: 0.6 },
    walk:       { src: 'audio/walkingthes.ogg', volume: 0.4, loop: true },
    fly:        { src: 'audio/flyingthes.ogg',  volume: 0.5, loop: true },
    levelup:    { src: 'audio/levelup.ogg',     volume: 0.7 },
    beginLevel: { src: 'audio/beginlevel.ogg',  volume: 0.7 },
    keyPickup:  { src: 'audio/key.ogg',         volume: 0.6 },
    death:      { src: 'audio/death.ogg',       volume: 0.7 },
    contact:    { src: 'audio/contact.ogg',     volume: 0.6 },
    lava:       { src: 'audio/lava.ogg',        volume: 0.5, loop: true },
    timer:      { src: 'audio/timer.ogg',       volume: 0.8, loop: true }
};

export const sfx = {};

// Crea gli elementi Audio subito (src non ancora caricato)
// Li popoliamo dentro loadAllAudio() dopo il tap
Object.keys(audioDefinitions).forEach(name => { sfx[name] = null; });

// Carica un singolo audio, restituisce Promise
function loadSingleAudio(name, def) {
    return new Promise(resolve => {
        const audio = new Audio();
        audio.volume = def.volume || 1.0;
        audio.loop = def.loop || false;
        audio.preload = 'auto';
        audio.src = def.src;

        const done = () => {
            console.log(`✅ ${name}: ${def.src}`);
            sfx[name] = audio;
            resolve();
        };
        const fail = () => {
            console.warn(`❌ ${name}: ${def.src} fallito`);
            sfx[name] = null;
            resolve(); // risolve comunque per non bloccare il Promise.all
        };

        audio.addEventListener('canplaythrough', done, { once: true });
        audio.addEventListener('error', fail, { once: true });
        // Timeout di sicurezza 3s per WebView lente
        setTimeout(() => { if (!sfx[name]) fail(); }, 3000);
        audio.load();
    });
}

// Carica TUTTI gli audio, aggiorna il debug text, risolve quando tutti pronti
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

// PROGRESS IMMAGINI - loadedImages già dichiarato sopra con gli sprites
let imagesReady = false;

function updateProgress() {
    const debugInfo = document.getElementById('debug-info');
    if (debugInfo) debugInfo.textContent = `Immagini: ${loadedImages}/${imagesToLoad.length}`;
    if (loadedImages === imagesToLoad.length) {
        imagesReady = true;
        if (debugInfo) debugInfo.textContent = 'TAP per iniziare 🎮';
    }
}



// Audio Context - LAZY: creato solo dopo gesto utente per evitare blocco Chrome/Android
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
    osc.connect(gain); 
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    
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

// Set per tracciare play() in corso ed evitare AbortError a cascata
const _playingSet = new WeakSet();

export function safePlayAudio(audio) {
    if (!audio) return;

    // Guard: audio non ancora caricato su Android WebView
    if (audio.readyState === 0) return;

    if (audio.loop) {
        // Audio in loop (walk/fly/lava/timer): usa elemento direttamente
        // NON clonare, NON resettare currentTime se già in play
        if (!audio.paused) return; // già in riproduzione, non fare nulla
        const p = audio.play();
        if (p !== undefined) {
            p.catch(err => {
                if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
                    console.warn('Audio loop error:', err.name);
                }
            });
        }
    } else {
        // Audio one-shot: clona per sovrapposizione senza AbortError
        // Ma solo se non c'è già una copia in play (throttle)
        if (_playingSet.has(audio)) return;
        const clone = audio.cloneNode();
        clone.volume = audio.volume;
        _playingSet.add(audio);
        const p = clone.play();
        if (p !== undefined) {
            p.then(() => {
                clone.addEventListener('ended', () => _playingSet.delete(audio), { once: true });
            }).catch(err => {
                _playingSet.delete(audio);
                if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
                    console.warn('Audio one-shot error:', err.name);
                }
            });
        }
    }
}

export function stopAllSounds() {
    Object.values(sfx).forEach(audio => {
        if (!audio) return;
        try { audio.pause(); audio.currentTime = 0; } catch(e) {}
    });
}

// Inizializza renderer
initRenderer(canvas, ctx, sprites);

// Inizializza input - passa getter lazy così joystick/fly possono fare resume audioCtx
initInput(getOrCreateAudioContext);

// LEVEL LOADING
window.loadLevelData = function(data) { 
    gameState.statusMessage = ""; 
    initGame(data); 
};

export function loadLevelScript(n) {
    setCurrentLevelNumber(n);
    const old = document.getElementById('level-script'); 
    if (old) old.remove();
    const s = document.createElement('script'); 
    s.id = 'level-script'; 
    s.src = `levels/level${n}.js`;
    s.onerror = () => { 
        if (n === 1) gameState.statusMessage = "Manca level1.js"; 
        else drawVictoryScreen(); 
    };
    document.body.appendChild(s);
}

function drawVictoryScreen() {
    setGameRunning(false);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 50px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HAI COMPLETATO TUTTI I LIVELLI!', canvas.width / 2, canvas.height / 2 - 50);
    ctx.font = '30px Orbitron, sans-serif';
    ctx.fillStyle = '#ffff00';
    ctx.fillText(`Stelle: ${gameState.stars} | Bandiere: ${gameState.flags} | Lampadine: ${gameState.bulbs}`, 
        canvas.width / 2, canvas.height / 2 + 20);
}

function initGame(levelData) {
    if (!levelData) return;
    
    safePlayAudio(sfx.beginLevel);
    gameState.hasKey = false; 
    gameState.doorOpen = false; 
    gameState.won = false;
    gameState.victoryTime = 0;
    gameState.power = gameState.maxPower;
    gameState.gameOver = false;
    
    // Cambia colore sfondo mattoni ad ogni livello
    randomizeBrickColor();
    
    setCurrentMap(JSON.parse(JSON.stringify(levelData.map)));
    config.tileSize = levelData.tileSize || 20;
    
    // Calcola zoom base
    const baseZoom = config.viewportHeight / (23 * config.tileSize);
    
    // Applica moltiplicatore mobile (1.5x su mobile, 1x su desktop)
    const mobileMultiplier = isMobile ? 1.5 : 1.0;
    config.zoom = baseZoom * mobileMultiplier;
    
    console.log('🔧 Zoom calcolato:', {
        baseZoom: baseZoom.toFixed(2),
        mobileMultiplier,
        zoomFinale: config.zoom.toFixed(2),
        tileSize: config.tileSize
    });
    
    const tempItems = [];
    const tempEnemies = [];
    const tempTriggers = [];
    const tempDecorations = [];
    const tempLavas = [];
    
    setLavaParticles([]);
    setDustParticles([]); // Reset particelle di polvere
    setFireworkParticles([]); // Reset fuochi d'artificio
    setColorParticles([]); // Reset particelle colorate
    // Reset power-up timer
    timerPowerUp.active = false;
    timerPowerUp.timeLeft = 0;
    if (sfx.timer && !sfx.timer.paused) { sfx.timer.pause(); sfx.timer.currentTime = 0; }

    const currentMap = levelData.map;
    const rows = currentMap.length;
    const cols = currentMap[0].length;
    
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const cell = currentMap[y][x];
            const type = (typeof cell === 'object') ? cell.type : cell;
            const group = (typeof cell === 'object') ? cell.group : null;
            
            if (type === 0 || type === 1) continue;
            
            let w = 1, h = 1;
            while (x + w < cols) {
                const nextCell = currentMap[y][x + w];
                const nextType = (typeof nextCell === 'object') ? nextCell.type : nextCell;
                const nextGroup = (typeof nextCell === 'object') ? nextCell.group : null;
                if (nextType !== type || nextGroup !== group) break;
                w++;
            }
            let canDown = true;
            while (canDown && y + h < rows) {
                for (let k = 0; k < w; k++) {
                    const checkCell = currentMap[y + h][x + k];
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
let fireworkTimer = 0; // Timer per generare fuochi d'artificio

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
    
    // OTTIMIZZAZIONE MOBILE: Meno update su mobile per migliori FPS
    // Mobile: max 2 update/frame, Desktop: max 3 update/frame
    let updatesThisFrame = 0;
    const maxUpdatesPerFrame = isMobile ? 2 : 3;
    
    while (accumulator >= config.fixedTimeStep && updatesThisFrame < maxUpdatesPerFrame) {
        update(config.fixedTimeStep, showRetryButton, currentLevelNumber, loadLevelScript); 
        accumulator -= config.fixedTimeStep;
        updatesThisFrame++;
    }
    
    // Se accumulator è ancora troppo alto, resettalo per evitare spiral of death
    if (accumulator > config.fixedTimeStep * 5) {
        accumulator = 0;
    }
    
    // Genera particelle colorate CONTINUE durante la vittoria (come lava)
    if (gameState.won && gameState.vX && gameState.vY) {
        if (Math.random() < 0.3) { // 30% probabilità ogni frame = molto frequenti
            const centerX = gameState.vX + gameState.vW / 2;
            const centerY = gameState.vY + gameState.vH / 2;
            // 8-12 particelle multicolore per burst
            createColorParticles(centerX, centerY, 8 + Math.floor(Math.random() * 4), 'collect');
        }
    }
    
    draw(gameRunning);
    updateHUD(currentLevelNumber, gameRunning);
    updateKeyHUD();
    requestAnimationFrame(loop);
}

// RETRY BUTTON

function showRetryButton() {
    // Rimuove la classe per far riapparire il mouse!
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
    // Nasconde di nuovo il mouse per il gameplay
    document.body.classList.add('game-active'); 
    
    const btn = document.getElementById('retry-btn');
    if (btn) btn.remove();

    
    gameState.gameOver = false;
    gameState.power = gameState.maxPower; 
    gameState.hasKey = false;
    
    loadLevelScript(currentLevelNumber); 
}

// TAP TO START

const tapOverlay = document.getElementById('tap-to-start');

// Guard flag
let gameStarted = false;

// Rileva Capacitor WebView
const isCapacitor = !!(window.Capacitor || window.webkit?.messageHandlers?.capacitor);

// Mostra schermata di loading sovrapposta al tap overlay
function showLoadingScreen(text) {
    const debugInfo = document.getElementById('debug-info');
    if (debugInfo) debugInfo.textContent = text;
}

async function startGame() {
    if (gameStarted) return;
    gameStarted = true;

    // 1. Crea AudioContext subito dopo il gesto
    const actx = getOrCreateAudioContext();
    if (actx.state === 'suspended') await actx.resume().catch(() => {});

    // 2. Mostra feedback visivo mentre carichiamo i suoni
    showLoadingScreen('Caricamento audio...');

    // 3. Carica tutti i suoni ORA (dopo il gesto = policy audio sbloccata)
    await loadAllAudio((done, total) => {
        showLoadingScreen(`Audio: ${done}/${total}`);
    });

    // 4. Sblocca ogni audio element con un silent play (richiesto da Android WebView)
    await Promise.all(Object.values(sfx).map(audio => {
        if (!audio) return Promise.resolve();
        return new Promise(resolve => {
            const vol = audio.volume;
            audio.volume = 0;
            audio.play()
                .then(() => { audio.pause(); audio.currentTime = 0; audio.volume = vol; resolve(); })
                .catch(() => { audio.volume = vol; resolve(); });
        });
    }));

    // 5. Avvia suono di inizio e nascondi overlay
    safePlayAudio(sfx.beginLevel);
    document.body.classList.add('game-active');

    if (tapOverlay) {
        tapOverlay.classList.remove('show');
        setTimeout(() => { tapOverlay.style.display = 'none'; }, 300);
    }
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) gameContainer.style.display = 'flex';

    // 6. Fullscreen solo su browser
    if (!isCapacitor) {
        try {
            if (document.documentElement.requestFullscreen)
                document.documentElement.requestFullscreen().catch(() => {});
            else if (document.documentElement.webkitRequestFullscreen)
                document.documentElement.webkitRequestFullscreen();
        } catch(e) {}
    }

    // 7. Avvia level e game loop
    if (!gameRunning) {
        loadLevelScript(1);
    }
}

// ============================================================
// RECOVERY: ritorno in foreground dopo background Android
// Quando l'app torna visibile, ripristina AudioContext e
// ricarica gli audio element che Android WebView ha rilasciato
// ============================================================
document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
        // App va in background: ferma tutto ordinatamente
        stopAllSounds();
        return;
    }

    // App torna in foreground
    if (!gameStarted) return; // Non ancora partito, nulla da fare

    console.log('🔄 App tornata in foreground - ripristino audio...');

    // Ripristina AudioContext
    const actx = getOrCreateAudioContext();
    if (actx.state === 'suspended') await actx.resume().catch(() => {});

    // Controlla se gli audio element sono stati rilasciati (readyState 0 = HAVE_NOTHING)
    const needsReload = Object.values(sfx).some(a => a && a.readyState === 0);

    if (needsReload) {
        console.log('🔄 Audio rilasciati da Android - ricarico...');
        // Ricarica solo i suoni persi
        await Promise.all(Object.entries(audioDefinitions).map(([name, def]) => {
            const audio = sfx[name];
            if (!audio || audio.readyState > 0) return Promise.resolve();
            return loadSingleAudio(name, def);
        }));
        // Sblocca di nuovo dopo il ricaricamento
        await Promise.all(Object.values(sfx).map(audio => {
            if (!audio) return Promise.resolve();
            return new Promise(resolve => {
                const vol = audio.volume;
                audio.volume = 0;
                audio.play()
                    .then(() => { audio.pause(); audio.currentTime = 0; audio.volume = vol; resolve(); })
                    .catch(() => { audio.volume = vol; resolve(); });
            });
        }));
        console.log('✅ Audio ripristinato');
    }
});

if (tapOverlay) {
    tapOverlay.classList.add('show');

    tapOverlay.addEventListener('touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        startGame();
    }, { passive: false });

    tapOverlay.addEventListener('click', function(e) {
        e.preventDefault();
        startGame();
    });
}

// Stato power-up timer (stile Pac-Man): blocca nemici per 10 secondi
export const timerPowerUp = {
    active: false,
    timeLeft: 0
};

// Aggiorna icona chiave nell'HUD (chiamata ogni frame da updateHUD in renderer.js
// oppure direttamente qui nel loop se renderer non la gestisce)
export function updateKeyHUD() {
    const keyIndicator = document.querySelector('.key-indicator');
    if (!keyIndicator) return;
    if (gameState.hasKey) {
        keyIndicator.textContent = '🔑';
        keyIndicator.classList.add('has-key');
    } else {
        keyIndicator.textContent = '◯';
        keyIndicator.classList.remove('has-key');
    }
}