/* -------------------------------------------------------------------------- */
/* MOTORE DI GIOCO v23 (FIX COLLISIONI, DANNO PROGRESSIVO, NO FREEZE)         */
/* -------------------------------------------------------------------------- */

const config = {
    viewportWidth: 740,
    viewportHeight: 510,
    baseGravity: 0.45,
    baseSpeed: 12.0,
    baseThrust: -0.80,
    maxFallSpeed: 4.6,
    maxFlySpeed: -0.26,
    enemySpeedMultiplier: 0.14,
    zoom: 1, 
    tileSize: 0,
    hitboxMargin: 0.25,
    fixedTimeStep: 1/60
};

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

// --- AUDIO ---
// --- AUDIO ---
const sfx = {
    doorOpen: new Audio('audio/dooropen.mp3'),
    doorClose: new Audio('audio/doorclose.mp3'),
    walk: new Audio('audio/walkingthes.mp3'),
    fly: new Audio('audio/flyingthes.m4a'),
    levelup: new Audio('audio/levelup.mp3'),
    // NUOVI SUONI
    beginLevel: new Audio('audio/beginlevel.mp3'),
    keyPickup: new Audio('audio/key.mp3'),
    death: new Audio('audio/death.mp3'),
    contact: new Audio('audio/contact.mp3'),
    lava: new Audio('audio/lava.mp3')
};
sfx.walk.loop = true;
sfx.fly.loop = true;
sfx.walk.volume = 0.4;
sfx.fly.volume = 0.5;

function checkStart() { if (loadedImages === imagesToLoad.length) loadLevelScript(1); }

// STATO DEL GIOCO
const gameState = { 
    power: 1.0,
    maxPower: 1.0,
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
    animState: 0,
    damageCooldown: 0,
    canFly: true // <--- AGGIUNGI QUESTA RIGA
};

let items = [], enemies = [], triggers = [], decorations = [], lavas = [];
const camera = { x: 0, y: 0 };
let currentMap = [];
let gameRunning = false;
let currentLevelNumber = 1; 

let lastTime = 0;
let accumulator = 0;
let lavaParticles = [];
const lavaAnimTime = { value: 0 };

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
        osc.start(); osc.stop(now+0.1); 
    }
    if (type==='key'){ 
        osc.frequency.setValueAtTime(880,now); 
        gain.gain.setValueAtTime(0.1,now); 
        osc.start(); osc.stop(now+0.1); 
    }
    // Suono DANNO (più breve e secco)
    if (type==='die' || type==='hit'){ 
        osc.type='sawtooth'; 
        osc.frequency.setValueAtTime(150,now); 
        osc.frequency.exponentialRampToValueAtTime(50,now+0.2); 
        gain.gain.setValueAtTime(0.2,now); 
        osc.start(); osc.stop(now+0.2); 
    }
    if (type==='open'){ 
        osc.type='triangle';
        osc.frequency.setValueAtTime(400,now); 
        osc.frequency.linearRampToValueAtTime(800,now+0.3); 
        gain.gain.setValueAtTime(0.15,now); 
        gain.gain.exponentialRampToValueAtTime(0.01,now+0.3);
        osc.start(); osc.stop(now+0.3); 
    }
    if (type==='close'){ 
        osc.type='triangle';
        osc.frequency.setValueAtTime(800,now); 
        osc.frequency.linearRampToValueAtTime(400,now+0.3); 
        gain.gain.setValueAtTime(0.15,now); 
        gain.gain.exponentialRampToValueAtTime(0.01,now+0.3);
        osc.start(); osc.stop(now+0.3); 
    }
    if (type==='win'){ 
        osc.frequency.setValueAtTime(523,now); 
        osc.frequency.setValueAtTime(659,now+0.1); 
        osc.frequency.setValueAtTime(784,now+0.2); 
        gain.gain.setValueAtTime(0.15,now); 
        osc.start(); osc.stop(now+0.4); 
    }
}

window.loadLevelData = function(data) { gameState.statusMessage = ""; initGame(data); };

function loadLevelScript(n) {
    const old = document.getElementById('level-script'); if (old) old.remove();
    const s = document.createElement('script'); s.id = 'level-script'; s.src = `level${n}.js`;
    s.onerror = () => { if(n===1) gameState.statusMessage = "Manca level1.js"; else drawVictoryScreen(); };
    document.body.appendChild(s);
}

function restorePower(amount) {
    gameState.power = Math.min(gameState.maxPower, gameState.power + amount);
}

function initGame(levelData) {
    if (!levelData) return;
    
    // Riproduci suono inizio livello
    sfx.beginLevel.currentTime = 0;
    sfx.beginLevel.play();
    gameState.hasKey = false; 
    gameState.doorOpen = false; 
    gameState.won = false;
    gameState.victoryTime = 0;
    gameState.power = gameState.maxPower;
    gameState.gameOver = false; // Reset Game Over status
    
    currentMap = JSON.parse(JSON.stringify(levelData.map));
    config.tileSize = levelData.tileSize || 20;
    config.zoom = config.viewportHeight / (23 * config.tileSize);
    
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

    lastTime = 0;        
    accumulator = 0;    

    if (!gameRunning) { 
        gameRunning = true; 
        requestAnimationFrame(loop); 
    }
}

function stopAllSounds() {
    Object.values(sfx).forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
}

function respawnPlayer() { 
    player.x = player.startX; 
    player.y = player.startY; 
    player.vx = 0; 
    player.vy = 0; 
    player.damageCooldown = 0;
    player.canFly = true; // <--- QUESTA RIGA L'HAI GIÀ AGGIUNTA, OTTIMO!
}
function playerDie() { 
    if (gameState.gameOver) return; // Evita chiamate multiple
    sfx.death.play(); // <--- AGGIUNTO
    playSound('die'); 
    gameState.gameOver = true; 
    stopAllSounds();
    showRetryButton();
}

function getTile(px, py) {
    const tx = Math.floor(px / config.tileSize), ty = Math.floor(py / config.tileSize);
    if (ty < 0 || ty >= currentMap.length || tx < 0 || tx >= currentMap[0].length) return 1;
    if (currentMap[ty][tx] === 1) return 1;
    for (let t of triggers) {
        if (t.type === 'door' && !t.open && px >= t.x && px < t.x + t.w && py >= t.y && py < t.y + t.h) {
            return 1;
        }
    }
    return 0;
}

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

function update(dt) {
    if (gameState.gameOver || gameState.won) {
        sfx.walk.pause();
        sfx.fly.pause();
        return;
    }

    // === GESTIONE COOLDOWN DANNO ===
    // Diminuisce il tempo di invulnerabilità se attivo
    if (player.damageCooldown > 0) {
        player.damageCooldown -= dt;
    }

    // === POWER EROSION (THESEUS CORE MECHANIC) ===
    const POWER_DRAIN_PER_SECOND = 0.020; 
    gameState.power -= POWER_DRAIN_PER_SECOND * dt;
    
    // Controllo morte per erosione naturale
    if (gameState.power <= 0) {
        gameState.power = 0;
        playerDie();
        return;
    }
    
    
    
    // MOVIMENTO PLAYER
    const speed = config.baseSpeed * config.tileSize * dt;
    const grav = config.baseGravity * config.tileSize * dt;
    const thr = config.baseThrust * config.tileSize * dt;
    
    if (keys.right) { player.vx = speed; player.facing = 1; } 
    else if (keys.left) { player.vx = -speed; player.facing = -1; } 
    else player.vx = 0;

    player.x += player.vx;
    const points = [0, player.h/2, player.h-1];
    for(let p of points) {
        if (player.vx > 0 && getTile(player.x + player.w, player.y + p)) player.x = Math.floor((player.x + player.w)/config.tileSize)*config.tileSize - player.w - 0.1;
        if (player.vx < 0 && getTile(player.x, player.y + p)) player.x = (Math.floor(player.x/config.tileSize)+1)*config.tileSize;
    }

    // --- NUOVA LOGICA DI VOLO MODIFICATA ---
    if (keys.up && player.canFly) {
        player.vy += thr;
    } 
    
    player.vy += grav;
    const mF = config.maxFallSpeed * config.tileSize, mY = config.maxFlySpeed * config.tileSize;
    if (player.vy > mF) player.vy = mF; 
    if (player.vy < mY) player.vy = mY;
    player.y += player.vy;

    const wPoints = [0, player.w-1];
    for(let p of wPoints) {
        // COLLISIONE SOFFITTO
        if (player.vy < 0 && getTile(player.x + p, player.y)) { 
            player.y = (Math.floor(player.y/config.tileSize)+1)*config.tileSize; 
            player.vy = 0; 
            player.canFly = false; 
        }
        // COLLISIONE PAVIMENTO
        if (player.vy > 0 && getTile(player.x + p, player.y + player.h)) { 
            player.y = Math.floor((player.y+player.h)/config.tileSize)*config.tileSize - player.h; 
            player.vy = 0; 
            player.canFly = true; 
        }
    }


    // ANIMAZIONE STATI
    if (player.vy < -0.01) player.animState = 2; else if (player.vy > 0.02) player.animState = 3; else if (Math.abs(player.vx) > 0.01) player.animState = 1; else player.animState = 0;

    // SUONI MOVIMENTO
    if (player.animState === 2 || player.animState === 3) {
        if (sfx.fly.paused) sfx.fly.play();
        sfx.walk.pause(); 
    } 
    else if (player.animState === 1) {
        if (sfx.walk.paused) sfx.walk.play();
        sfx.fly.pause();
    } 
    else {
        sfx.walk.pause();
        sfx.fly.pause();
    }

    player.frameTimer++;
    if (player.frameTimer > 8) { player.frameTimer = 0; player.frameIndex = (player.frameIndex + 1) % 4; }

    lavaAnimTime.value += 0.05 * dt * 60;
    updateLavaParticles(dt * 60);
    
    // === NEMICI: MOVIMENTO E DANNO ===
    const ENEMY_HIT_DAMAGE = 0.25; // Danno secco al contatto

    enemies.forEach(en => {
        en.x += en.vx; 
        en.y += en.vy;

        if(en.vx > 0 && (getTile(en.x+en.w, en.y) || getTile(en.x+en.w, en.y+en.h-1))) en.vx*=-1;
        else if(en.vx < 0 && (getTile(en.x, en.y) || getTile(en.x, en.y+en.h-1))) en.vx*=-1;
        if(en.vy > 0 && (getTile(en.x, en.y+en.h) || getTile(en.x+en.w-1, en.y+en.h))) en.vy*=-1;
        else if(en.vy < 0 && (getTile(en.x, en.y) || getTile(en.x+en.w-1, en.y))) en.vy*=-1;

        // COLLISIONE NEMICO
        if (rectIntersect(player, en, true)) {
            // Applica danno solo se il cooldown è finito
            if (player.damageCooldown <= 0) {
                gameState.power -= ENEMY_HIT_DAMAGE;
                sfx.contact.currentTime = 0; // Reset per sovrapposizioni veloci
                sfx.contact.play();        // <--- AGGIUNTO
                playSound('hit'); // Suono colpo (ex die)
                player.damageCooldown = 2.0; // 1 secondo di invulnerabilità
                
                // Controllo morte immediato
                if (gameState.power <= 0) {
                    gameState.power = 0;
                    playerDie();
                }
            }
        }
    });

    // === LAVA: DANNO CONTINUO ===
    const LAVA_DAMAGE_PER_SECOND = 0.5; // Molto alto, ma progressivo
    lavas.forEach(l => {
        if (rectIntersect(player, l, true)) {
            // Sottrae vita costantemente in base al tempo (dt)
            gameState.power -= LAVA_DAMAGE_PER_SECOND * dt;
            if (sfx.lava.paused) sfx.lava.play();
            // Check morte
            if (gameState.power <= 0) {
                gameState.power = 0;
                playerDie();
            }
        }
    });

    // === OGGETTI ===
    items.forEach(item => { 
        if (!item.taken && rectIntersect(player, item, false)) { 
            item.taken = true; 
            if (item.type === 'key') { gameState.hasKey = true; sfx.keyPickup.play(); playSound('key'); }
            else if (item.type === 'bulb') { restorePower(0.5); gameState.bulbs++; playSound('bonus'); }
            else if (item.type === 'star') { restorePower(0.25); gameState.stars++; playSound('bonus'); }
            else if (item.type === 'flag') { gameState.flags++; playSound('bonus'); }
            else if (item.type === 'timer') { restorePower(0.1); playSound('bonus'); }
        } 
    });
    
    triggers.forEach(trig => { 
        if (trig.type !== 'door' && rectIntersect(player, trig, false)) { 
            if (trig.type==='open'){ 
                triggers.forEach(door => {
                    if (door.type === 'door' && door.group === trig.group && !door.open) {
                        door.open = true; sfx.doorOpen.currentTime = 0; sfx.doorOpen.play();
                    }
                });
            } 
            if (trig.type==='close'){ 
                triggers.forEach(door => {
                    if (door.type === 'door' && door.group === trig.group && door.open) {
                        door.open = false; sfx.doorClose.currentTime = 0; sfx.doorClose.play();
                    }
                });
            } 
        } 
    });

    decorations.forEach(d => { 
        if (d.type==='woman' && rectIntersect(player, d, false) && gameState.hasKey) {
            if (!gameState.won) winLevel(d); 
        } 
    });
    
    camera.x += ((player.x * config.zoom) - (config.viewportWidth / 2) - camera.x) * 0.1;
    camera.y += ((player.y * config.zoom) - (config.viewportHeight / 2) - camera.y) * 0.1;
}

function winLevel(d) { 
    gameState.won = true; 
    gameState.victoryTime = 0;
    gameState.vX = d.x; gameState.vY = d.y; gameState.vW = d.w; gameState.vH = d.h;
    sfx.walk.pause(); sfx.fly.pause(); sfx.levelup.currentTime = 0; sfx.levelup.play();
    
    setTimeout(() => { 
        sfx.levelup.pause(); 
        currentLevelNumber++; 
        loadLevelScript(currentLevelNumber); 
    }, 5000); 
}

// --- RENDERING ---
function drawPlayer() {
    const img = sprites.thes;
    if (!img || !img.complete) return;

    // EFFETTO LAMPEGGIO SE COLPITO
    if (player.damageCooldown > 0) {
        // Lampeggia ogni 0.1 secondi
        if (Math.floor(Date.now() / 100) % 2 === 0) return; 
    }

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
    ctx.shadowBlur = 20 * pulse;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = pulse;
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2 * pulse;
    ctx.fillRect(sx, sy, sw, sh);
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(1, time / 20);
    const bounce = Math.sin(time * 0.2) * 5;
    ctx.globalAlpha = 1;
    ctx.translate(canvas.width / 2, 100); 
    ctx.scale(scale, scale);
    const text = "LIVELLO COMPLETATO!";
    ctx.font = 'bold 42px Orbitron, sans-serif';
    ctx.textAlign = 'center';
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
        // La logica di collisione ora è in update(), qui solo disegno
        drawImg(sprites.lava, l.x, l.y, l.w / config.tileSize, l.h / config.tileSize);
        drawLavaEffects(l);
        createLavaParticles(l);
    });

    triggers.forEach(t => {
        if (t.type === 'door') {
            if (!t.open) drawImg(sprites.door, t.x, t.y, t.w/config.tileSize, t.h/config.tileSize);
        }
        if(t.type==='open') drawGlowingTrigger(t.x, t.y, t.w, t.h, '#00ffff', 'OPEN', 0);
        if(t.type==='close') drawGlowingTrigger(t.x, t.y, t.w, t.h, '#ff6600', 'CLOSE', Math.PI);
    });

    drawLavaParticles();

    function drawImg(img, x, y, wS, hS) { 
        const sx = x*config.zoom-camera.x, sy = y*config.zoom-camera.y, sw = config.tileSize*config.zoom*wS, sh = config.tileSize*config.zoom*hS; 
        if(img && img.complete) ctx.drawImage(img, sx, sy, sw, sh); 
    }

    items.forEach(i => { 
        if(!i.taken) {
            if (i.type === 'star') drawStarGlow(i);
            else drawImg(sprites[i.type], i.x, i.y, i.w/config.tileSize, i.h/config.tileSize);
        }
    });
    
    decorations.forEach(d => { 
        if(d.type==='woman') {
            if (!gameState.won) drawImg(sprites.woman, d.x, d.y, d.w/config.tileSize, d.h/config.tileSize); 
        }
    });

    enemies.forEach(en => {
        let sprite = sprites.enemyH; 
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
            const larghezzaInTile = 3.5; 
            const aspect = img.naturalHeight / img.naturalWidth;
            const altezzaInTile = larghezzaInTile * aspect;
            const offsetX = (larghezzaInTile * config.tileSize - gameState.vW) / 2;
            const offsetY = (altezzaInTile * config.tileSize - gameState.vH);
            drawImg(img, gameState.vX - offsetX, gameState.vY - offsetY, larghezzaInTile, altezzaInTile);
        }
    }

    if (gameState.gameOver) { 
        ctx.fillStyle = 'rgba(50, 0, 0, 0.85)'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height); 
        ctx.fillStyle = '#fff'; 
        ctx.font = 'bold 60px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff0000';
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 20); 
        ctx.shadowBlur = 0; 
    }
    
    if (gameState.won) { 
        gameState.victoryTime++;
        drawVictoryMessage();
    }
    
    updateHUD();
}

function updateHUD() {
    if (!gameRunning) return;
    const levelDisplay = document.getElementById('level-display');
    if(levelDisplay) levelDisplay.textContent = currentLevelNumber.toString().padStart(2, '0');
    
    const powerBar = document.getElementById('power-bar');
    if (powerBar) {
        const percentage = Math.max(0, Math.min(100, (gameState.power / gameState.maxPower) * 100));
        powerBar.style.width = percentage + '%';
        if (percentage > 50) powerBar.style.backgroundColor = '#00ff41'; 
        else if (percentage > 25) powerBar.style.backgroundColor = '#ffff00'; 
        else powerBar.style.backgroundColor = '#ff0040'; 
    }
    
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

function loop(timestamp) {
    if (!gameRunning) return;
    if (!lastTime) { lastTime = timestamp; requestAnimationFrame(loop); return; }
    let deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (deltaTime > 0.25) deltaTime = 0.25;
    accumulator += deltaTime;
    while (accumulator >= config.fixedTimeStep) {
        update(config.fixedTimeStep); 
        accumulator -= config.fixedTimeStep;
    }
    draw();
    requestAnimationFrame(loop);
}

function showRetryButton() {
    const oldBtn = document.getElementById('retry-btn');
    if (oldBtn) oldBtn.remove();
    const btn = document.createElement('button');
    btn.id = 'retry-btn';
    btn.textContent = 'RIPROVA';
    Object.assign(btn.style, {
        position: 'absolute', left: '50%', top: '60%',
        transform: 'translate(-50%, -50%)', padding: '15px 30px',
        fontSize: '24px', fontFamily: 'Orbitron, sans-serif',
        cursor: 'pointer', backgroundColor: '#ff0000', color: 'white',
        border: 'none', borderRadius: '5px', boxShadow: '0 0 15px rgba(255,0,0,0.5)',
        zIndex: '100'
    });
    btn.onclick = restartGame;
    document.body.appendChild(btn);
}

function restartGame() {
    const btn = document.getElementById('retry-btn');
    if (btn) btn.remove();
    gameState.gameOver = false;
    gameState.power = gameState.maxPower; 
    gameState.stars = 0;
    gameState.flags = 0;
    gameState.bulbs = 0;
    gameState.hasKey = false;
    currentLevelNumber = 1;
    loadLevelScript(1);
}

// --- TOUCH & FULLSCREEN ---
function isMobileDevice() { return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent); }
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; }

function requestFullscreen() {
    const elem = document.documentElement;
    if (isMobileDevice()) {
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => console.log('Fullscreen failed:', err));
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        }
    }
}

let fullscreenActivated = false;
const tapOverlay = document.getElementById('tap-to-start');

function startGame() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (tapOverlay) {
        tapOverlay.classList.remove('show');
        setTimeout(() => tapOverlay.style.display = 'none', 300);
    }
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) gameContainer.style.display = 'flex';
    setTimeout(() => requestFullscreen(), 100);
    fullscreenActivated = true;
    if (isIOS()) setTimeout(() => window.scrollTo(0, 1), 200);
    if (!gameRunning) { gameRunning = true; lastTime = 0; accumulator = 0; requestAnimationFrame(loop); }
}

if (isMobileDevice() && tapOverlay) {
    tapOverlay.classList.add('show');
    tapOverlay.addEventListener('touchend', function(e) { e.preventDefault(); startGame(); }, { passive: false });
    tapOverlay.addEventListener('click', function(e) { e.preventDefault(); startGame(); });
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
        if (audioCtx.state === 'suspended') audioCtx.resume();
        e.preventDefault();
        startX = e.changedTouches[0].clientX;
    }, { passive: false });

    joystickBase.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const currentX = e.changedTouches[0].clientX;
        const deltaX = currentX - startX;
        const moveX = Math.max(-maxDist, Math.min(maxDist, deltaX));
        joystickStick.style.transform = `translate(calc(-50% + ${moveX}px), -50%)`;
        if (moveX < -deadZone) { keys.left = true; keys.right = false; } 
        else if (moveX > deadZone) { keys.right = true; keys.left = false; } 
        else { keys.left = false; keys.right = false; }
    }, { passive: false });

    const resetJoystick = (e) => {
        if(e) e.preventDefault();
        keys.left = false; keys.right = false;
        joystickStick.style.transform = `translate(-50%, -50%)`;
    };

    joystickBase.addEventListener('touchend', resetJoystick);
    joystickBase.addEventListener('touchcancel', resetJoystick);

    btnFly.addEventListener('touchstart', (e) => { if (audioCtx.state === 'suspended') audioCtx.resume(); e.preventDefault(); keys.up = true; }, { passive: false });
    btnFly.addEventListener('touchend', (e) => { e.preventDefault(); keys.up = false; });
    btnFly.addEventListener('touchcancel', (e) => { e.preventDefault(); keys.up = false; });
}

initTouchControls();

function checkOrientation() {
    const rotateMsg = document.getElementById('rotate-message');
    if (rotateMsg && window.innerWidth < 900) {
        if (window.innerHeight > window.innerWidth) rotateMsg.style.display = 'flex';
        else rotateMsg.style.display = 'none';
    }
}

window.addEventListener('load', checkOrientation);
window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', checkOrientation);

if (isIOS()) {
    window.addEventListener('load', () => setTimeout(() => window.scrollTo(0, 1), 100));
    window.addEventListener('touchstart', () => { if (fullscreenActivated) setTimeout(() => window.scrollTo(0, 1), 0); });
    window.addEventListener('resize', () => { if (fullscreenActivated) setTimeout(() => window.scrollTo(0, 1), 0); });
}