/* -------------------------------------------------------------------------- */
/* MOTORE DI GIOCO v22 (EFFETTI LAVA, TRIGGER GLOWING, VICTORY CANDY STYLE)   */
/* -------------------------------------------------------------------------- */

const config = {
    viewportWidth: 740,
    viewportHeight: 510,
    // DINAMICHE "GOOD GAME" RIPRISTINATE
    baseGravity: 0.002,    
    baseSpeed: 0.09,       
    baseThrust: -0.009,    
    maxFallSpeed: 0.07,     
    maxFlySpeed: -0.08,     
    enemySpeedMultiplier: 0.08, 
    zoom: 1, 
    tileSize: 0,
    // HITBOX (Tolleranza invisibile per i nemici: 25%)
    hitboxMargin: 0.25 
};

// ----------------------------------
// FIX VELOCITÀ ANDROID / MOBILE
// ----------------------------------
if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    config.baseSpeed *= 0.75;
    config.baseGravity *= 0.75;
    config.baseThrust *= 0.75;
    config.enemySpeedMultiplier *= 0.8;
}



const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
canvas.width = config.viewportWidth;
canvas.height = config.viewportHeight;
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
    { name: 'unchained', src: 'png/unchained.png' }

];


imagesToLoad.forEach(imgData => {
    const img = new Image();
    img.src = imgData.src;
    img.onload = () => { loadedImages++; checkStart(); };
    img.onerror = () => { sprites[imgData.name] = null; loadedImages++; checkStart(); };
    sprites[imgData.name] = img;
});

// --- NUOVI EFFETTI AUDIO ---
const sfx = {
    doorOpen: new Audio('audio/dooropen.mp3'),
    doorClose: new Audio('audio/doorclose.mp3'),
    walk: new Audio('audio/walkingthes.mp3'),
    fly: new Audio('audio/flyingthes.m4a'),
    levelup: new Audio('audio/levelup.mp3')
};

// Impostiamo i loop per i suoni continui
sfx.walk.loop = true;
sfx.fly.loop = true;
// Abbassiamo un po' il volume di default (opzionale)
sfx.walk.volume = 0.4;
sfx.fly.volume = 0.5;


function checkStart() { if (loadedImages === imagesToLoad.length) loadLevelScript(1); }

// STATO
let currentLevelNumber = 1; 
const gameState = { 
    lives: 3, 
    hasKey: false, 
    doorOpen: false, 
    gameOver: false, 
    won: false, 
    stars: 0, 
    flags: 0, 
    bulbs: 0, 
    statusMessage: "Caricamento...",
    victoryTime: 0
};

// ENTITÀ
const player = { 
    x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, startX: 0, startY: 0,
    frameIndex: 0,
    frameTimer: 0,
    facing: 1,      
    animState: 0    
};

let items = [], enemies = [], triggers = [], decorations = [], lavas = [];
const camera = { x: 0, y: 0 };
let currentMap = [];
let gameRunning = false;

// Controllo frame rate per normalizzare la velocità su tutti i dispositivi
let lastTime = 0;
const targetFPS = 60;
const targetFrameTime = 1000 / targetFPS; // Tempo target per frame (16.67ms a 60fps)

// Particelle per effetti lava
let lavaParticles = [];
const lavaAnimTime = { value: 0 };

// --- AUDIO E CARICAMENTO ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    
    if (type==='bonus'){ 
        osc.frequency.setValueAtTime(600,now); 
        osc.frequency.linearRampToValueAtTime(1200,now+0.1); 
        gain.gain.setValueAtTime(0.1,now); 
        osc.start(); 
        osc.stop(now+0.1); 
    }
    
    if (type==='key'){ 
        osc.frequency.setValueAtTime(880,now); 
        gain.gain.setValueAtTime(0.1,now); 
        osc.start(); 
        osc.stop(now+0.1); 
    }
    
    if (type==='die'){ 
        osc.type='sawtooth'; 
        osc.frequency.setValueAtTime(200,now); 
        osc.frequency.exponentialRampToValueAtTime(50,now+0.4); 
        gain.gain.setValueAtTime(0.2,now); 
        osc.start(); 
        osc.stop(now+0.4); 
    }
    
    // Suono apertura porta (sweep up)
    if (type==='open'){ 
        osc.type='triangle';
        osc.frequency.setValueAtTime(400,now); 
        osc.frequency.linearRampToValueAtTime(800,now+0.3); 
        gain.gain.setValueAtTime(0.15,now); 
        gain.gain.exponentialRampToValueAtTime(0.01,now+0.3);
        osc.start(); 
        osc.stop(now+0.3); 
    }
    
    // Suono chiusura porta (sweep down)
    if (type==='close'){ 
        osc.type='triangle';
        osc.frequency.setValueAtTime(800,now); 
        osc.frequency.linearRampToValueAtTime(400,now+0.3); 
        gain.gain.setValueAtTime(0.15,now); 
        gain.gain.exponentialRampToValueAtTime(0.01,now+0.3);
        osc.start(); 
        osc.stop(now+0.3); 
    }
    
    // Suono vittoria
    if (type==='win'){ 
        osc.frequency.setValueAtTime(523,now); 
        osc.frequency.setValueAtTime(659,now+0.1); 
        osc.frequency.setValueAtTime(784,now+0.2); 
        gain.gain.setValueAtTime(0.15,now); 
        osc.start(); 
        osc.stop(now+0.4); 
    }
}

window.loadLevelData = function(data) { gameState.statusMessage = ""; initGame(data); };

function loadLevelScript(n) {
    const old = document.getElementById('level-script'); if (old) old.remove();
    const s = document.createElement('script'); s.id = 'level-script'; s.src = `level${n}.js`;
    s.onerror = () => { if(n===1) gameState.statusMessage = "Manca level1.js"; else drawVictoryScreen(); };
    document.body.appendChild(s);
}

function initGame(levelData) {
    if (!levelData) return;
    gameState.hasKey = false; 
    gameState.doorOpen = false; 
    gameState.won = false;
    gameState.victoryTime = 0;
    currentMap = JSON.parse(JSON.stringify(levelData.map));
    config.tileSize = levelData.tileSize || 20;
    config.zoom = config.viewportHeight / (16 * config.tileSize);
    items = []; enemies = []; triggers = []; decorations = []; lavas = [];
    lavaParticles = [];

    const rows = currentMap.length, cols = currentMap[0].length;
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
            const pxW = w * config.tileSize, pxH = h * config.tileSize, pxX = x * config.tileSize, pxY = y * config.tileSize;
            
            if (type === 9) { player.w = pxW; player.h = pxH; player.startX = pxX; player.startY = pxY; respawnPlayer(); } 
            else if (type === 2) lavas.push({ x: pxX, y: pxY, w: pxW, h: pxH });
            else if (type === 10) items.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'key', taken: false });
            else if (type === 12) items.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'star', taken: false });
            else if (type === 7) items.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'flag', taken: false });
            else if (type === 8) items.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'bulb', taken: false });
            else if (type === 4) triggers.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'open', group: group || 'A' });
            else if (type === 5) triggers.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'close', group: group || 'A' });
            else if (type === 6) triggers.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'door', group: group || 'A', open: false });
            else if (type === 3) decorations.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'woman' });
            else if (type === 11) enemies.push({ x: pxX, y: pxY, w: pxW, h: pxH, vx: config.enemySpeedMultiplier * config.tileSize, vy: 0, type: 'H' });
            else if (type === 13) enemies.push({ x: pxX, y: pxY, w: pxW, h: pxH, vx: 0, vy: config.enemySpeedMultiplier * config.tileSize, type: 'V' });
            else if (type === 14) enemies.push({ x: pxX, y: pxY, w: pxW, h: pxH, vx: 0, vy: 0, type: 'S' });
            else if (type === 15) enemies.push({ x: pxX, y: pxY, w: pxW, h: pxH, vx: config.enemySpeedMultiplier * config.tileSize, vy: 0, type: 'X' });
            else if (type === 16) items.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'timer', taken: false });

            for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) currentMap[r][c] = 0;
        }
    }
    if(!gameRunning) { gameRunning = true; loop(); }
}


function stopAllSounds() {
    Object.values(sfx).forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
}

function respawnPlayer() { player.x = player.startX; player.y = player.startY; player.vx = 0; player.vy = 0; }

function playerDie() { 
    playSound('die'); 
    gameState.lives--; 
    
    if (gameState.lives <= 0) { 
        gameState.gameOver = true; 
        stopAllSounds(); // Ferma passi, volo, ecc.
        showRetryButton(); // Mostra il bottone
    } else { 
        respawnPlayer(); 
    } 
}



function getTile(px, py) {
    const tx = Math.floor(px / config.tileSize), ty = Math.floor(py / config.tileSize);
    if (ty < 0 || ty >= currentMap.length || tx < 0 || tx >= currentMap[0].length) return 1;
    if (currentMap[ty][tx] === 1) return 1;
    // Controlla se il punto è dentro una porta chiusa
    for (let t of triggers) {
        if (t.type === 'door' && !t.open && px >= t.x && px < t.x + t.w && py >= t.y && py < t.y + t.h) {
            return 1;
        }
    }
    return 0;
}

// COLLISIONI CON HITBOX (Invisibile per nemici)
function rectIntersect(r1, r2, useMargin = false) {
    let m1 = 0, m2 = 0;
    if (useMargin) {
        m1 = r1.w * config.hitboxMargin; 
        m2 = r2.w * config.hitboxMargin; 
    }
    return !(
        (r2.x + m2) > (r1.x + r1.w - m1) || 
        (r2.x + r2.w - m2) < (r1.x + m1) || 
        (r2.y + m2) > (r1.y + r1.h - m1) || 
        (r2.y + r2.h - m2) < (r1.y + m1)
    );
}

// Generazione particelle lava
function createLavaParticles(lava) {
    if (Math.random() < 0.05) {
        lavaParticles.push({
            x: lava.x + Math.random() * lava.w,
            y: lava.y + lava.h - 2,
            vx: (Math.random() - 0.5) * 0.2,
            vy: -Math.random() * 0.5 - 0.3,
            life: 1.0,
            size: Math.random() * 3 + 2,
            type: Math.random() > 0.3 ? 'fire' : 'smoke'
        });
    }
}

function updateLavaParticles(deltaMultiplier = 1) {
    lavaParticles = lavaParticles.filter(p => p.life > 0);
    lavaParticles.forEach(p => {
        p.x += p.vx * deltaMultiplier;
        p.y += p.vy * deltaMultiplier;
        p.vy -= 0.01 * deltaMultiplier;
        p.life -= 0.015 * deltaMultiplier;
        if (p.type === 'smoke') {
            p.size += 0.1 * deltaMultiplier;
            p.vx *= Math.pow(0.98, deltaMultiplier);
        }
    });
}

function update(deltaMultiplier) {
    if (gameState.gameOver) return;
    if (gameState.won) {
        gameState.victoryTime++;
        return;
    }
    
    // Usa deltaMultiplier per normalizzare la velocità
    const speed = config.baseSpeed * config.tileSize * deltaMultiplier;
    const grav = config.baseGravity * config.tileSize * deltaMultiplier;
    const thr = config.baseThrust * config.tileSize * deltaMultiplier;
    
    if (keys.right) { player.vx = speed; player.facing = 1; } 
    else if (keys.left) { player.vx = -speed; player.facing = -1; } 
    else player.vx = 0;

    player.x += player.vx;
    const points = [0, player.h/2, player.h-1];
    for(let p of points) {
        if (player.vx > 0 && getTile(player.x + player.w, player.y + p)) player.x = Math.floor((player.x + player.w)/config.tileSize)*config.tileSize - player.w - 0.1;
        if (player.vx < 0 && getTile(player.x, player.y + p)) player.x = (Math.floor(player.x/config.tileSize)+1)*config.tileSize;
    }

    if (keys.up) player.vy += thr; player.vy += grav;
    const mF = config.maxFallSpeed * config.tileSize, mY = config.maxFlySpeed * config.tileSize;
    if (player.vy > mF) player.vy = mF; if (player.vy < mY) player.vy = mY;
    player.y += player.vy;

    const wPoints = [0, player.w-1];
    for(let p of wPoints) {
        if (player.vy < 0 && getTile(player.x + p, player.y)) { player.y = (Math.floor(player.y/config.tileSize)+1)*config.tileSize; player.vy = 0; }
        if (player.vy > 0 && getTile(player.x + p, player.y + player.h)) { player.y = Math.floor((player.y+player.h)/config.tileSize)*config.tileSize - player.h; player.vy = 0; }
    }

    if (player.vy < -0.01) player.animState = 2; else if (player.vy > 0.02) player.animState = 3; else if (Math.abs(player.vx) > 0.01) player.animState = 1; else player.animState = 0;


if (!gameState.won && !gameState.gameOver) {
    if (player.animState === 2 || player.animState === 3) {
        // Thes è in aria (vola o cade)
        if (sfx.fly.paused) sfx.fly.play();
        sfx.walk.pause(); 
    } 
    else if (player.animState === 1) {
        // Thes sta camminando
        if (sfx.walk.paused) sfx.walk.play();
        sfx.fly.pause();
    } 
    else {
        // Thes è fermo
        sfx.walk.pause();
        sfx.fly.pause();
    }
} else {
    // Spegni tutto se il livello è finito o se hai perso
    sfx.walk.pause();
    sfx.fly.pause();
}



    player.frameTimer++;
    if (player.frameTimer > 8) { player.frameTimer = 0; player.frameIndex = (player.frameIndex + 1) % 4; }

    for (let l of lavas) {
        if (rectIntersect(player, l, true)) { playerDie(); return; }
        createLavaParticles(l);
    }
    
    lavaAnimTime.value += 0.05 * deltaMultiplier;
    updateLavaParticles(deltaMultiplier);
    
    enemies.forEach(en => {
        en.x += en.vx; en.y += en.vy;
        if(en.vx > 0 && (getTile(en.x+en.w, en.y) || getTile(en.x+en.w, en.y+en.h-1))) en.vx*=-1;
        else if(en.vx < 0 && (getTile(en.x, en.y) || getTile(en.x, en.y+en.h-1))) en.vx*=-1;
        if(en.vy > 0 && (getTile(en.x, en.y+en.h) || getTile(en.x+en.w-1, en.y+en.h))) en.vy*=-1;
        else if(en.vy < 0 && (getTile(en.x, en.y) || getTile(en.x+en.w-1, en.y))) en.vy*=-1;
        if (rectIntersect(player, en, true)) playerDie();
    });

    items.forEach(item => { 
        if (!item.taken && rectIntersect(player, item, false)) { 
            item.taken = true; 
            if(item.type==='key') {
                gameState.hasKey=true;
                playSound('key');
            }
            if(item.type!=='key') { 
                gameState[item.type+'s']++; 
                playSound('bonus'); 
            } 
        } 
    });
    
    triggers.forEach(trig => { 
        if (trig.type !== 'door' && rectIntersect(player, trig, false)) { 
            if (trig.type==='open'){ 
                // Apri tutte le porte dello stesso gruppo
                triggers.forEach(door => {
                    if (door.type === 'door' && door.group === trig.group && !door.open) {
                        door.open = true;
                        // playSound('open'); <-- Rimuovi o commenta
            sfx.doorOpen.currentTime = 0; // Ricomincia se già in esecuzione
            sfx.doorOpen.play();
                    }
                });
            } 
            if (trig.type==='close'){ 
                // Chiudi tutte le porte dello stesso gruppo
                triggers.forEach(door => {
                    if (door.type === 'door' && door.group === trig.group && door.open) {
                        door.open = false;
                       sfx.doorClose.currentTime = 0;
            sfx.doorClose.play();
                    }
                });
            } 
        } 
    });

// Cerca questa riga nel blocco update()
decorations.forEach(d => { if (d.type==='woman' && rectIntersect(player, d, false) && gameState.hasKey) {
        if (!gameState.won) winLevel(d); // Passiamo d alla funzione
    } 
});
    

    camera.x += ((player.x * config.zoom) - (config.viewportWidth / 2) - camera.x) * 0.1;
    camera.y += ((player.y * config.zoom) - (config.viewportHeight / 2) - camera.y) * 0.1;
}

function winLevel(d) { 
    gameState.won = true; 
    gameState.victoryTime = 0;
    
    // Memorizziamo la posizione
    gameState.vX = d.x;
    gameState.vY = d.y;
    gameState.vW = d.w;
    gameState.vH = d.h;

    // AUDIO: Fermiamo i loop e facciamo partire il levelup
    sfx.walk.pause();
    sfx.fly.pause();
    sfx.levelup.currentTime = 0;
    sfx.levelup.play();

    // playSound('win'); // Puoi tenerlo o commentarlo se il mp3 basta
    
    setTimeout(() => { 
        sfx.levelup.pause(); // Fermiamo la musica prima di cambiare livello
        currentLevelNumber++; 
        loadLevelScript(currentLevelNumber); 
    }, 5000); // Ho messo 5 secondi per far sentire bene la musica
}

// --- RENDERING AGGIORNATO ---
function drawPlayer() {
    const img = sprites.thes;
    if (!img || !img.complete) return;

    const cellW = img.naturalWidth / 4;
    const cellH = img.naturalHeight / 4;

    const trimX = 120; 
    const trimY = 18;  

    const sx = (player.frameIndex * cellW) + trimX;
    const sy = (player.animState * cellH) + trimY;
    const sw = cellW - (trimX * 2);
    const sh = cellH - (trimY * 2);

    const dx = player.x * config.zoom - camera.x;
    const dy = player.y * config.zoom - camera.y;
    const dw = player.w * config.zoom;
    const dh = player.h * config.zoom;

    ctx.save();
    if (player.facing === -1) {
        ctx.translate(dx + dw, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    } else {
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    ctx.restore();
}

function drawLavaEffects(l) {
    const sx = l.x * config.zoom - camera.x;
    const sy = l.y * config.zoom - camera.y;
    const sw = l.w * config.zoom;
    const sh = l.h * config.zoom;
    
    // Effetto ondulato sulla superficie
    ctx.save();
    ctx.globalAlpha = 0.3;
    const waveOffset = Math.sin(lavaAnimTime.value + l.x * 0.01) * 3;
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(sx, sy + waveOffset, sw, 4);
    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawLavaParticles() {
    lavaParticles.forEach(p => {
        const px = p.x * config.zoom - camera.x;
        const py = p.y * config.zoom - camera.y;
        
        ctx.save();
        ctx.globalAlpha = p.life;
        
        // Protezione: assicurati che p.size sia valido
        const particleSize = isFinite(p.size) && p.size > 0 ? p.size : 3;
        
        if (p.type === 'fire') {
            const gradient = ctx.createRadialGradient(px, py, 0, px, py, particleSize);
            gradient.addColorStop(0, '#ffff00');
            gradient.addColorStop(0.5, '#ff6600');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            ctx.fillStyle = gradient;
        } else {
            const gradient = ctx.createRadialGradient(px, py, 0, px, py, particleSize);
            gradient.addColorStop(0, 'rgba(100, 100, 100, 0.8)');
            gradient.addColorStop(1, 'rgba(50, 50, 50, 0)');
            ctx.fillStyle = gradient;
        }
        
        ctx.beginPath();
        ctx.arc(px, py, particleSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function drawGlowingTrigger(x, y, w, h, color, text, pulseOffset = 0) {
    const sx = x * config.zoom - camera.x;
    const sy = y * config.zoom - camera.y;
    const sw = w * config.zoom;
    const sh = h * config.zoom;
    
    const pulse = Math.sin(Date.now() * 0.003 + pulseOffset) * 0.3 + 0.7;
    
    ctx.save();
    
    // Glow esterno
    ctx.shadowBlur = 20 * pulse;
    ctx.shadowColor = color;
    
    // Box con bordo glowing
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = pulse;
    ctx.strokeRect(sx, sy, sw, sh);
    
    // Background semi-trasparente
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2 * pulse;
    ctx.fillRect(sx, sy, sw, sh);
    
    // Testo glowing
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 15 * pulse;
    ctx.fillStyle = color;
 
ctx.font = `bold ${Math.min(sw * 0.20, sh * 0.3)}px Orbitron, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, sx + sw / 2, sy + sh / 2);
    
    ctx.restore();
}

function drawStarGlow(item) {
    const img = sprites.star;
    if (!img || !img.complete) return;
    
    const sx = item.x * config.zoom - camera.x;
    const sy = item.y * config.zoom - camera.y;
    const sw = (item.w / config.tileSize) * config.tileSize * config.zoom;
    const sh = (item.h / config.tileSize) * config.tileSize * config.zoom;
    
    const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
    
    ctx.save();
    ctx.shadowBlur = 25 * pulse;
    ctx.shadowColor = '#ffff00';
    ctx.globalAlpha = pulse;
    ctx.drawImage(img, sx, sy, sw, sh);
    ctx.restore();
}

function drawVictoryMessage() {
    const time = gameState.victoryTime;
    ctx.save();
    
    // Rimuoviamo il nero totale, mettiamo solo un leggero oscuramento (opzionale)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // ANIMAZIONE TESTO "LIVELLO COMPLETATO"
    const scale = Math.min(1, time / 20);
    const bounce = Math.sin(time * 0.2) * 5;
    
    ctx.globalAlpha = 1;
    // Spostiamo il testo in alto così non copre l'immagine dell'incontro
    ctx.translate(canvas.width / 2, 100); 
    ctx.scale(scale, scale);
    
    const text = "LIVELLO COMPLETATO!";
    ctx.font = 'bold 42px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    
    // Effetto Candy
    for (let i = 0; i < 5; i++) {
        const offset = 8 - i * 2;
        const colors = ['#ff00ff', '#00ffff', '#ffff00', '#00ff00', '#ff6600'];
        ctx.fillStyle = colors[i];
        ctx.fillText(text, 0, bounce + offset);
    }
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 0, bounce);
    
    ctx.restore();
}
function draw() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (!gameRunning) { 
        ctx.fillStyle = '#fff'; 
        ctx.fillText(gameState.statusMessage, 50, 100); 
        return; 
    }
    
    for (let y = 0; y < currentMap.length; y++) 
        for (let x = 0; x < currentMap[y].length; x++) 
            if (currentMap[y][x] === 1) 
                drawImg(sprites.brick, x*config.tileSize, y*config.tileSize, 1, 1);
    
    lavas.forEach(l => {
        drawImg(sprites.lava, l.x, l.y, l.w/config.tileSize, l.h/config.tileSize);
        drawLavaEffects(l);
    });
    
    drawLavaParticles();
    
  triggers.forEach(t => { 
if (t.type === 'door') { 
        ctx.save();
        // Se la porta è aperta, la rendiamo semi-trasparente (0.3)
        if (t.open) ctx.globalAlpha = 0.3; 
        
        // Usiamo la funzione drawImg esistente per disegnare la sprite 'door'
        drawImg(sprites.door, t.x, t.y, t.w/config.tileSize, t.h/config.tileSize);
        
        ctx.restore();
    }
    if(t.type==='open') {
        // Forza sempre la scritta OPEN
        drawGlowingTrigger(t.x, t.y, t.w, t.h, '#00ffff', 'OPEN', 0);
    }
    if(t.type==='close') {
        // Forza sempre la scritta CLOSE
        drawGlowingTrigger(t.x, t.y, t.w, t.h, '#ff6600', 'CLOSE', Math.PI);
    }
});




    function drawImg(img, x, y, wS, hS) { 
        const sx = x*config.zoom-camera.x, sy = y*config.zoom-camera.y, sw = config.tileSize*config.zoom*wS, sh = config.tileSize*config.zoom*hS; 
        if(img && img.complete) ctx.drawImage(img, sx, sy, sw, sh); 
    }

    items.forEach(i => { 
        if(!i.taken) {
            if (i.type === 'star') {
                drawStarGlow(i);
            } else {
                drawImg(sprites[i.type], i.x, i.y, i.w/config.tileSize, i.h/config.tileSize);
            }
        }
    });
    
   
decorations.forEach(d => { 
    if(d.type==='woman') {
        // Se abbiamo vinto, non disegniamo la donna "statica"
        if (!gameState.won) {
            drawImg(sprites.woman, d.x, d.y, d.w/config.tileSize, d.h/config.tileSize); 
        }
    }
});

    enemies.forEach(en => {
        let sprite = sprites.enemyH; // default
        if (en.type === 'H') sprite = sprites.enemyH;
        else if (en.type === 'V') sprite = sprites.enemyV;
        else if (en.type === 'S') sprite = sprites.enemyS;
        else if (en.type === 'X') sprite = sprites.enemyX;
        drawImg(sprite, en.x, en.y, en.w/config.tileSize, en.h/config.tileSize);
    });
    
   if (!gameState.won) {
        drawPlayer();
    } else {
        const img = sprites.unchained;
        if (img && img.complete) {
            // --- REGOLA QUI LA GRANDEZZA ---
            const larghezzaInTile = 3.5; // Prova 2.5 o 3 per trovare la dimensione perfetta
            // -------------------------------

            const aspect = img.naturalHeight / img.naturalWidth;
            const altezzaInTile = larghezzaInTile * aspect;

            // Calcoliamo la posizione per centrarla esattamente sulla "woman"
            // spostandola un po' a sinistra e in alto per coprire bene lo spazio
            const offsetX = (larghezzaInTile * config.tileSize - gameState.vW) / 2;
            const offsetY = (altezzaInTile * config.tileSize - gameState.vH);

            drawImg(
                img, 
                gameState.vX - offsetX, 
                gameState.vY - offsetY, 
                larghezzaInTile, 
                altezzaInTile
            );
        }
    }


if (gameState.gameOver) { 
        ctx.fillStyle = 'rgba(50, 0, 0, 0.85)'; // Rosso scuro profondo
        ctx.fillRect(0, 0, canvas.width, canvas.height); 
        
        ctx.fillStyle = '#fff'; 
        ctx.font = 'bold 60px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff0000';
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 20); 
        ctx.shadowBlur = 0; // Reset ombra per non appesantire il resto
    }
    
    if (gameState.won) { 
        drawVictoryMessage();
    }
    
    updateHUD();
}

function updateHUD() {
    const levelDisplay = document.getElementById('level-display');
    if(levelDisplay) levelDisplay.textContent = currentLevelNumber.toString().padStart(2, '0');
    const livesDisplay = document.getElementById('lives-display');
    if(livesDisplay) livesDisplay.textContent = '♥'.repeat(gameState.lives);
    const starsDisplay = document.getElementById('stars-display');
    if(starsDisplay) starsDisplay.textContent = gameState.stars;
    const flagsDisplay = document.getElementById('flags-display');
    if(flagsDisplay) flagsDisplay.textContent = gameState.flags;
    const bulbsDisplay = document.getElementById('bulbs-display');
    if(bulbsDisplay) bulbsDisplay.textContent = gameState.bulbs;
    const keyIndicator = document.querySelector('.key-indicator');
    if(keyIndicator) {
        if(gameState.hasKey) keyIndicator.classList.add('has-key');
        else keyIndicator.classList.remove('has-key');
    }
}

const keys = { right: false, left: false, up: false };
window.addEventListener('keydown', e => { 
    if(audioCtx.state==='suspended') audioCtx.resume(); 
    if(e.code==='ArrowRight') keys.right=true; 
    if(e.code==='ArrowLeft') keys.left=true; 
    if(e.code==='Space') keys.up=true; 
});
window.addEventListener('keyup', e => { 
    if(e.code==='ArrowRight') keys.right=false; 
    if(e.code==='ArrowLeft') keys.left=false; 
    if(e.code==='Space') keys.up=false; 
});

function loop(currentTime) { 
    if (!lastTime) lastTime = currentTime;
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    // Calcola il moltiplicatore basato sul tempo reale trascorso
    // Normalizzato a 60fps (16.67ms per frame)
    let deltaMultiplier = deltaTime / targetFrameTime;
    
    // Validazione: assicurati che sia un numero valido e ragionevole
    if (!isFinite(deltaMultiplier) || deltaMultiplier <= 0 || deltaMultiplier > 5) {
        deltaMultiplier = 1; // Fallback a velocità normale
    }
    
    // Ulteriore limitazione per evitare salti enormi
    const clampedDelta = Math.min(Math.max(deltaMultiplier, 0.1), 2);
    
    if(gameRunning) update(clampedDelta);
    draw();
    
    requestAnimationFrame(loop);
}
loop(performance.now());

function showRetryButton() {
    // Rimuoviamo se esiste già
    const oldBtn = document.getElementById('retry-btn');
    if (oldBtn) oldBtn.remove();

    const btn = document.createElement('button');
    btn.id = 'retry-btn';
    btn.textContent = 'RIPROVA';
    
    // Stile CSS via JS per centrarlo sul canvas
    Object.assign(btn.style, {
        position: 'absolute',
        left: '50%',
        top: '60%',
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
    // Rimuove il bottone
    const btn = document.getElementById('retry-btn');
    if (btn) btn.remove();

    // Reset dello stato globale
    gameState.gameOver = false;
    gameState.lives = 3;
    gameState.stars = 0;
    gameState.flags = 0;
    gameState.bulbs = 0;
    gameState.hasKey = false;
    currentLevelNumber = 1;

    // Ricarica il primo livello
    loadLevelScript(1);
}

// ============================================
// TOUCH CONTROLS & FULLSCREEN SUPPORT
// ============================================

// Controlla se è un dispositivo mobile
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Controlla se è iOS
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Funzione per attivare fullscreen (con gestione iOS e Android)
function requestFullscreen() {
    console.log('Requesting fullscreen...');
    const elem = document.documentElement;
    
    if (isIOS()) {
        console.log('iOS detected - using scroll method');
        // iOS non supporta fullscreen API completa, ma possiamo nascondere la barra
        // Forza scroll per nascondere la barra degli indirizzi
        window.scrollTo(0, 1);
        
        // Tenta comunque webkitEnterFullscreen se disponibile
        if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen().catch((err) => {
                console.log('iOS fullscreen failed:', err);
                // Fallback: almeno nascondiamo la barra con scroll
                window.scrollTo(0, 1);
            });
        }
    } else {
        // Android e altri dispositivi
        console.log('Android/Desktop detected - using fullscreen API');
        
        const fullscreenPromise = elem.requestFullscreen ? elem.requestFullscreen() :
                                  elem.webkitRequestFullscreen ? elem.webkitRequestFullscreen() :
                                  elem.mozRequestFullScreen ? elem.mozRequestFullScreen() :
                                  elem.msRequestFullscreen ? elem.msRequestFullscreen() : null;
        
        if (fullscreenPromise) {
            fullscreenPromise
                .then(() => {
                    console.log('Fullscreen activated successfully');
                })
                .catch((err) => {
                    console.log('Fullscreen request failed:', err);
                    console.log('Trying alternative method...');
                    
                    // Fallback per Android - prova metodi alternativi
                    try {
                        if (elem.webkitRequestFullscreen) {
                            elem.webkitRequestFullscreen();
                        } else if (document.body.webkitRequestFullscreen) {
                            document.body.webkitRequestFullscreen();
                        }
                    } catch (e) {
                        console.log('All fullscreen methods failed:', e);
                    }
                });
        } else {
            console.log('No fullscreen API available');
        }
    }
}

// Gestione overlay "Tap to Start"
let fullscreenActivated = false;
const tapOverlay = document.getElementById('tap-to-start');

// Funzione per avviare il gioco dopo il tap
function startGame() {
    console.log('Starting game...');
    
    // Resume audio context
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log('Audio context resumed');
        }).catch((err) => {
            console.log('Audio resume failed:', err);
        });
    }
    
    // Nascondi overlay prima del fullscreen
    if (tapOverlay) {
        tapOverlay.classList.remove('show');
        // Dopo la transizione, nascondi completamente
        setTimeout(() => {
            tapOverlay.style.display = 'none';
        }, 300);
        console.log('Overlay hidden');
    }
    
    // Assicurati che il game container sia visibile
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        gameContainer.style.display = 'flex';
        console.log('Game container visible');
    }
    
    // Attiva fullscreen dopo un piccolo delay
    setTimeout(() => {
        requestFullscreen();
    }, 100);
    
    fullscreenActivated = true;
    
    // Per iOS, forza scroll
    if (isIOS()) {
        setTimeout(() => {
            window.scrollTo(0, 1);
        }, 200);
    }
    
    // Debug: verifica che il canvas sia visibile
    setTimeout(() => {
        const canvasVisible = canvas && canvas.offsetParent !== null;
        console.log('Canvas visible:', canvasVisible);
        console.log('Game running:', gameRunning);
    }, 500);
    
    console.log('Game start sequence completed');
}

// Mostra overlay su mobile all'avvio
if (isMobileDevice() && tapOverlay) {
    // Mostra overlay
    tapOverlay.classList.add('show');
    console.log('Mobile device detected, showing tap overlay');
    
    // Mostra info debug
    const debugInfo = document.getElementById('debug-info');
    if (debugInfo) {
        const ua = navigator.userAgent;
        let browserInfo = 'Unknown';
        if (ua.includes('Chrome')) browserInfo = 'Chrome';
        else if (ua.includes('Safari')) browserInfo = 'Safari';
        else if (ua.includes('Firefox')) browserInfo = 'Firefox';
        else if (ua.includes('SamsungBrowser')) browserInfo = 'Samsung Internet';
        
        debugInfo.textContent = `${browserInfo} | ${isIOS() ? 'iOS' : 'Android'}`;
        console.log('Browser:', browserInfo);
    }
    
    // Gestione tocco sull'overlay
    tapOverlay.addEventListener('touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Tap detected on overlay (touchend)');
        startGame();
    }, { passive: false });
    
    // Gestione click sull'overlay (per desktop testing)
    tapOverlay.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Click detected on overlay');
        startGame();
    });
    
    // Fallback con touchstart per dispositivi che non triggherano touchend
    tapOverlay.addEventListener('touchstart', function(e) {
        console.log('Touchstart detected');
    }, { passive: true });
}


// Touch Controls Setup
function initTouchControls() {
    // Riferimenti ai nuovi elementi del DOM
    const joystickBase = document.getElementById('joystick-base');
    const joystickStick = document.getElementById('joystick-stick');
    const btnFly = document.getElementById('btn-fly');

    // Se mancano elementi (es. siamo su desktop o errore HTML), usciamo
    if (!joystickBase || !btnFly) return;

    // --- LOGICA JOYSTICK (Sinistra / Destra) ---
    let startX = 0;
    const maxDist = 40; // Massima distanza visiva del pomello (pixel)
    const deadZone = 10; // Zona morta centrale

    // 1. Inizio tocco: salva la posizione iniziale X
    joystickBase.addEventListener('touchstart', (e) => {
        if (audioCtx.state === 'suspended') audioCtx.resume(); // Sblocca audio su mobile
        e.preventDefault();
        startX = e.changedTouches[0].clientX;
    }, { passive: false });

    // 2. Movimento: calcola delta e muovi stick + personaggio
    joystickBase.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const currentX = e.changedTouches[0].clientX;
        const deltaX = currentX - startX;

        // Limita il movimento visivo del pomello
        const moveX = Math.max(-maxDist, Math.min(maxDist, deltaX));
        joystickStick.style.transform = `translate(calc(-50% + ${moveX}px), -50%)`;

        // Applica input al gioco
        if (moveX < -deadZone) {
            keys.left = true;
            keys.right = false;
        } else if (moveX > deadZone) {
            keys.right = true;
            keys.left = false;
        } else {
            keys.left = false;
            keys.right = false;
        }
    }, { passive: false });

    // 3. Fine tocco: resetta tutto
    const resetJoystick = (e) => {
        if(e) e.preventDefault();
        keys.left = false;
        keys.right = false;
        joystickStick.style.transform = `translate(-50%, -50%)`; // Torna al centro
    };

    joystickBase.addEventListener('touchend', resetJoystick);
    joystickBase.addEventListener('touchcancel', resetJoystick);

    // --- LOGICA TASTO FLY ---
    const handleFlyStart = (e) => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        e.preventDefault();
        keys.up = true;
    };
    const handleFlyEnd = (e) => {
        e.preventDefault();
        keys.up = false;
    };

    btnFly.addEventListener('touchstart', handleFlyStart, { passive: false });
    btnFly.addEventListener('touchend', handleFlyEnd);
    btnFly.addEventListener('touchcancel', handleFlyEnd);
}

// AVVIA I CONTROLLI TOUCH
initTouchControls();



// Gestione orientamento schermo
function checkOrientation() {
    const rotateMsg = document.getElementById('rotate-message');
    if (rotateMsg && window.innerWidth < 900) {
        if (window.innerHeight > window.innerWidth) {
            // Portrait mode - mostra messaggio
            rotateMsg.style.display = 'flex';
        } else {
            // Landscape mode - nascondi messaggio
            rotateMsg.style.display = 'none';
        }
    }
}

// Controlla orientamento all'avvio e quando cambia
window.addEventListener('load', checkOrientation);
window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', checkOrientation);

// Per iOS: mantieni nascoste le barre del browser
if (isIOS()) {
    // Nascondi barra all'avvio
    window.addEventListener('load', () => {
        setTimeout(() => window.scrollTo(0, 1), 100);
    });
    
    // Mantieni nascosta quando l'utente interagisce
    window.addEventListener('touchstart', () => {
        if (fullscreenActivated) {
            setTimeout(() => window.scrollTo(0, 1), 0);
        }
    });
    
    // Gestisci il resize (quando appare/scompare la tastiera o barra indirizzi)
    window.addEventListener('resize', () => {
        if (fullscreenActivated) {
            setTimeout(() => window.scrollTo(0, 1), 0);
        }
    });
}