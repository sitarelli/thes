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
    { name: 'bulb', src: 'png/bulb.png' },
    { name: 'star', src: 'png/star.png' },
    { name: 'flag', src: 'png/flag.png' },
    { name: 'lava', src: 'png/lava.png' },
    { name: 'key', src: 'png/key.png' } 
];

imagesToLoad.forEach(imgData => {
    const img = new Image();
    img.src = imgData.src;
    img.onload = () => { loadedImages++; checkStart(); };
    img.onerror = () => { sprites[imgData.name] = null; loadedImages++; checkStart(); };
    sprites[imgData.name] = img;
});

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
            const type = currentMap[y][x];
            if (type === 0 || type === 1) continue;
            let w = 1, h = 1;
            while (x + w < cols && currentMap[y][x + w] === type) w++;
            let canDown = true;
            while (canDown && y + h < rows) {
                for (let k = 0; k < w; k++) if (currentMap[y + h][x + k] !== type) canDown = false;
                if (canDown) h++;
            }
            const pxW = w * config.tileSize, pxH = h * config.tileSize, pxX = x * config.tileSize, pxY = y * config.tileSize;
            
            if (type === 9) { player.w = pxW; player.h = pxH; player.startX = pxX; player.startY = pxY; respawnPlayer(); } 
            else if (type === 2) lavas.push({ x: pxX, y: pxY, w: pxW, h: pxH });
            else if (type === 10) items.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'key', taken: false });
            else if (type === 12) items.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'star', taken: false });
            else if (type === 7) items.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'flag', taken: false });
            else if (type === 8) items.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'bulb', taken: false });
            else if (type === 4) triggers.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'open' });
            else if (type === 5) triggers.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'close' });
            else if (type === 6) triggers.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'door' });
            else if (type === 3) decorations.push({ x: pxX, y: pxY, w: pxW, h: pxH, type: 'woman' });
            else if (type === 11) enemies.push({ x: pxX, y: pxY, w: pxW, h: pxH, vx: config.enemySpeedMultiplier * config.tileSize, vy: 0, type: 'H' });
            else if (type === 13) enemies.push({ x: pxX, y: pxY, w: pxW, h: pxH, vx: 0, vy: config.enemySpeedMultiplier * config.tileSize, type: 'V' });

            for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) currentMap[r][c] = 0;
        }
    }
    if(!gameRunning) { gameRunning = true; loop(); }
}

function respawnPlayer() { player.x = player.startX; player.y = player.startY; player.vx = 0; player.vy = 0; }
function playerDie() { playSound('die'); gameState.lives--; if (gameState.lives <= 0) gameState.gameOver = true; else respawnPlayer(); }

function getTile(px, py) {
    const tx = Math.floor(px / config.tileSize), ty = Math.floor(py / config.tileSize);
    if (ty < 0 || ty >= currentMap.length || tx < 0 || tx >= currentMap[0].length) return 1;
    if (currentMap[ty][tx] === 1) return 1;
    if (!gameState.doorOpen) {
        for (let t of triggers) if (t.type === 'door' && px >= t.x && px < t.x + t.w && py >= t.y && py < t.y + t.h) return 1;
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

function updateLavaParticles() {
    lavaParticles = lavaParticles.filter(p => p.life > 0);
    lavaParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.01;
        p.life -= 0.015;
        if (p.type === 'smoke') {
            p.size += 0.1;
            p.vx *= 0.98;
        }
    });
}

function update() {
    if (gameState.gameOver) return;
    if (gameState.won) {
        gameState.victoryTime++;
        return;
    }
    
    const speed = config.baseSpeed * config.tileSize, grav = config.baseGravity * config.tileSize, thr = config.baseThrust * config.tileSize;
    
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

    player.frameTimer++;
    if (player.frameTimer > 8) { player.frameTimer = 0; player.frameIndex = (player.frameIndex + 1) % 4; }

    for (let l of lavas) {
        if (rectIntersect(player, l, true)) { playerDie(); return; }
        createLavaParticles(l);
    }
    
    lavaAnimTime.value += 0.05;
    updateLavaParticles();
    
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
            if (trig.type==='open' && !gameState.doorOpen){ 
                gameState.doorOpen=true; 
                playSound('open'); 
            } 
            if (trig.type==='close' && gameState.doorOpen){ 
                gameState.doorOpen=false; 
                playSound('close'); 
            } 
        } 
    });
    
    decorations.forEach(d => { if (d.type==='woman' && rectIntersect(player, d, false) && gameState.hasKey) winLevel(); });
    camera.x += ((player.x * config.zoom) - (config.viewportWidth / 2) - camera.x) * 0.1;
    camera.y += ((player.y * config.zoom) - (config.viewportHeight / 2) - camera.y) * 0.1;
}

function winLevel() { 
    gameState.won = true; 
    gameState.victoryTime = 0;
    playSound('win'); 
    setTimeout(() => { 
        currentLevelNumber++; 
        loadLevelScript(currentLevelNumber); 
    }, 3000); 
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
        
        if (p.type === 'fire') {
            const gradient = ctx.createRadialGradient(px, py, 0, px, py, p.size);
            gradient.addColorStop(0, '#ffff00');
            gradient.addColorStop(0.5, '#ff6600');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            ctx.fillStyle = gradient;
        } else {
            const gradient = ctx.createRadialGradient(px, py, 0, px, py, p.size);
            gradient.addColorStop(0, 'rgba(100, 100, 100, 0.8)');
            gradient.addColorStop(1, 'rgba(50, 50, 50, 0)');
            ctx.fillStyle = gradient;
        }
        
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
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
    ctx.font = `bold ${Math.min(sw * 0.35, sh * 0.6)}px Orbitron, monospace`;
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
    
    // Overlay scuro
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Animazione testo candy style
    const scale = Math.min(1, time / 20);
    const bounce = Math.sin(time * 0.2) * 5;
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    
    // Testo principale con effetto candy
    const text = "LIVELLO COMPLETATO!";
    
    // Ombra multipla colorata (effetto candy)
    for (let i = 0; i < 5; i++) {
        const offset = 8 - i * 2;
        const colors = ['#ff00ff', '#00ffff', '#ffff00', '#00ff00', '#ff6600'];
        ctx.fillStyle = colors[i];
        ctx.font = 'bold 48px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, bounce + offset);
    }
    
    // Testo principale bianco
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ffff00';
    ctx.fillText(text, 0, bounce);
    
    // Particelle celebrative
    for (let i = 0; i < 20; i++) {
        const angle = (time * 0.05 + i * Math.PI * 2 / 20);
        const radius = 150 + Math.sin(time * 0.1 + i) * 30;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        
        ctx.fillStyle = ['#ff00ff', '#00ffff', '#ffff00'][i % 3];
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
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
            const sx = t.x*config.zoom-camera.x, sy = t.y*config.zoom-camera.y, sw = t.w*config.zoom, sh = t.h*config.zoom; 
            ctx.fillStyle = gameState.doorOpen ? 'rgba(51,51,51,0.5)' : '#6f42c1'; 
            ctx.fillRect(sx, sy, sw, sh); 
        } 
        if(t.type==='open') drawGlowingTrigger(t.x, t.y, t.w, t.h, '#00ffff', 'OPEN', 0); 
        if(t.type==='close') drawGlowingTrigger(t.x, t.y, t.w, t.h, '#ff6600', 'CLOSE', Math.PI);
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
    
    decorations.forEach(d => { if(d.type==='woman') drawImg(sprites.woman, d.x, d.y, d.w/config.tileSize, d.h/config.tileSize); });
    enemies.forEach(en => drawImg(en.type==='H'?sprites.enemyH:sprites.enemyV, en.x, en.y, en.w/config.tileSize, en.h/config.tileSize));
    
    drawPlayer();

    if (gameState.gameOver) { 
        ctx.fillStyle='rgba(100,0,0,0.8)'; 
        ctx.fillRect(0,0,canvas.width,canvas.height); 
        ctx.fillStyle='#fff'; 
        ctx.font = 'bold 48px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2); 
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

function loop() { if(gameRunning) update(); draw(); requestAnimationFrame(loop); }
loop();
