/* -------------------------------------------------------------------------- */
/* RENDERING E DISEGNO                                                        */
/* -------------------------------------------------------------------------- */

import { config, player, gameState, camera, currentMap, items, enemies, lavas, triggers, decorations, lavaParticles, dustParticles, fireworkParticles, colorParticles, lavaAnimTime } from './config.js';

let ctx = null;
let canvas = null;
let sprites = {};
let brickPattern = null; // Pattern di mattoni per lo sfondo
let brickColorOverlay = 'rgba(70, 60, 50, 0.3)'; // Overlay colore casuale

export function initRenderer(canvasElement, contextElement, spritesData) {
    canvas = canvasElement;
    ctx = contextElement;
    sprites = spritesData;
    generateBrickPattern(); // Genera il pattern di mattoni (UNA VOLTA SOLA)
}

// Cambia solo l'overlay di colore (chiamato ad ogni livello)
export function randomizeBrickColor() {
    const colorStyles = [
        'rgba(60, 70, 85, 0.35)',  // Grigio-Blu-Marrone
        'rgba(85, 60, 55, 0.35)',  // Marrone-Grigio-Rosso
    ];
    brickColorOverlay = colorStyles[Math.floor(Math.random() * colorStyles.length)];
}

// Genera un pattern di mattoni irregolari casuali (UNA VOLTA SOLA)
function generateBrickPattern() {
    const patternCanvas = document.createElement('canvas');
    const patternSize = 200;
    patternCanvas.width = patternSize;
    patternCanvas.height = patternSize;
    const pctx = patternCanvas.getContext('2d');
    
    // Sfondo base scuro
    pctx.fillStyle = '#1a1410';
    pctx.fillRect(0, 0, patternSize, patternSize);
    
    // Disegna mattoni irregolari
    const brickWidth = 40;
    const brickHeight = 20;
    const mortarSize = 2;
    
    for (let y = 0; y < patternSize + brickHeight; y += brickHeight + mortarSize) {
        const offsetX = (Math.floor(y / (brickHeight + mortarSize)) % 2) * (brickWidth / 2);
        
        for (let x = -brickWidth; x < patternSize + brickWidth; x += brickWidth + mortarSize) {
            const bx = x + offsetX;
            const by = y;
            
            const seed = (bx * 7 + by * 13) % 100;
            const variation = (seed / 100) * 30 - 15;
            
            const baseR = 60 + variation;
            const baseG = 45 + variation;
            const baseB = 30 + variation;
            
            // Mattone base
            pctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
            pctx.fillRect(bx, by, brickWidth, brickHeight);
            
            // Texture ridotta (10 invece di 20 per ottimizzazione)
            for (let i = 0; i < 10; i++) {
                const px = bx + (seed * i * 7) % brickWidth;
                const py = by + (seed * i * 11) % brickHeight;
                const size = 1 + (seed * i) % 2;
                const alpha = 0.1 + ((seed * i) % 30) / 300;
                
                pctx.fillStyle = `rgba(${baseR + 20}, ${baseG + 15}, ${baseB + 10}, ${alpha})`;
                pctx.fillRect(px, py, size, size);
            }
            
            // Ombreggiatura
            const gradient = pctx.createLinearGradient(bx, by, bx, by + brickHeight);
            gradient.addColorStop(0, `rgba(255, 255, 255, 0.05)`);
            gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
            pctx.fillStyle = gradient;
            pctx.fillRect(bx, by, brickWidth, brickHeight);
            
            // Bordi
            pctx.strokeStyle = `rgba(0, 0, 0, 0.3)`;
            pctx.lineWidth = 1;
            pctx.strokeRect(bx + 0.5, by + 0.5, brickWidth - 1, brickHeight - 1);
        }
    }
    
    brickPattern = ctx.createPattern(patternCanvas, 'repeat');
    randomizeBrickColor(); // Inizializza colore
}

function drawImg(img, x, y, wS, hS, flip = false) { 
    const sx = x * config.zoom - camera.x;
    const sy = y * config.zoom - camera.y;
    const sw = config.tileSize * config.zoom * wS;
    const sh = config.tileSize * config.zoom * hS;
    
    if (img && img.complete) {
        if (flip) {
            ctx.save();
            ctx.translate(sx + sw, sy);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, sw, sh);
            ctx.restore();
        } else {
            ctx.drawImage(img, sx, sy, sw, sh);
        }
    }
}

function drawPlayer() {
    let img, sx, sy, sw, sh;

    if (player.isDying) {
        img = sprites.thes_die;
        if (!img || !img.complete) return;

        // Griglia 4 colonne x 2 righe (700x400)
        const cols = 4;
        const rows = 2;
        
        sw = img.naturalWidth / cols;
        sh = img.naturalHeight / rows;
        
        sx = (player.deathFrame % cols) * sw;
        sy = Math.floor(player.deathFrame / cols) * sh;

    } else {
        img = sprites.thes;
        if (!img || !img.complete) return;

        // EFFETTO LAMPEGGIO SE COLPITO
        if (player.damageCooldown > 0) {
            if (Math.floor(Date.now() / 100) % 2 === 0) return; 
        }

        const cellW = img.naturalWidth / 4;
        const cellH = img.naturalHeight / 4;
        const trimX = 120; 
        const trimY = 18;  

        sx = (player.frameIndex * cellW) + trimX;
        sy = (player.animState * cellH) + trimY;
        sw = cellW - (trimX * 2);
        sh = cellH - (trimY * 2);
    }

    let dx = player.x * config.zoom - camera.x;
    let dy = player.y * config.zoom - camera.y;

    // Abbassa animazione morte
    if (player.isDying) {
        dy += 3 * config.zoom;
    }

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
    
    // EFFETTO ROSSO SE IN LAVA
    if (player.isInLava && !player.isDying) {
        ctx.globalCompositeOperation = 'source-atop';
        const intensity = 0.5 + Math.sin(Date.now() * 0.01) * 0.2; // Pulsazione
        ctx.fillStyle = `rgba(255, 50, 0, ${intensity * 0.6})`;
        if (player.facing === -1) {
            ctx.fillRect(0, 0, dw, dh);
        } else {
            ctx.fillRect(dx, dy, dw, dh);
        }
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

function drawDustParticles() {
    dustParticles.forEach(p => {
        const px = p.x * config.zoom - camera.x;
        const py = p.y * config.zoom - camera.y;
        
        ctx.save();
        ctx.globalAlpha = p.life * 0.5; // Polvere più trasparente
        const particleSize = isFinite(p.size) && p.size > 0 ? p.size : 2;
        
        // Crea un gradiente radiale per effetto sfumato
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, particleSize);
        gradient.addColorStop(0, 'rgba(150, 150, 150, 0.8)');
        gradient.addColorStop(0.5, 'rgba(120, 120, 120, 0.5)');
        gradient.addColorStop(1, 'rgba(100, 100, 100, 0)');
        ctx.fillStyle = gradient;
        
        ctx.beginPath();
        ctx.arc(px, py, particleSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function drawFireworkParticles() {
    fireworkParticles.forEach(p => {
        // Applica oscillazione se presente (cuoricini vittoria)
        let offsetX = 0;
        if (p.oscillation !== undefined) {
            p.oscillation += p.oscillationSpeed;
            offsetX = Math.sin(p.oscillation) * 10; // Oscilla ±10px
        }
        
        const px = (p.x + offsetX) * config.zoom - camera.x;
        const py = p.y * config.zoom - camera.y;
        
        ctx.save();
        ctx.globalAlpha = p.life; // Dissolvenza graduale
        ctx.translate(px, py);
        ctx.rotate(p.rotation);
        
        // Disegna emoji
        ctx.font = `${p.size * config.zoom}px Arial`; // Scala con zoom
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Shadow/glow per effetto brillante
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(255, 192, 203, 0.8)'; // Rosa per cuori
        
        ctx.fillText(p.emoji, 0, 0);
        
        ctx.restore();
    });
}

// Particelle colorate (da React)
function drawColorParticles() {
    colorParticles.forEach(p => {
        const px = p.x * config.zoom - camera.x;
        const py = p.y * config.zoom - camera.y;
        
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(px, py, p.size * config.zoom, p.size * config.zoom);
        ctx.restore();
    });
}

export function createLavaParticles(lava) {
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
    
    // Sfondo scuro semi-trasparente
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Animazione di entrata (scala)
    const scale = Math.min(1, time / 20);
    const bounce = Math.sin(time * 0.15) * 3;
    
    ctx.translate(config.viewportWidth / 2, config.viewportHeight / 2 - 30);
    ctx.scale(scale, scale);
    
    // ===== STILE THESEUS APPLICATO A "LIVELLO COMPLETATO!" =====
    const text = "LIVELLO COMPLETATO!";
    ctx.font = 'bold 36px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Layer multipli di colore (come il logo THESEUS)
    const layers = [
        { color: '#ff00ff', offset: 6 },  // Magenta
        { color: '#00ffff', offset: 4 },  // Cyan
        { color: '#ffff00', offset: 2 },  // Giallo
        { color: '#00ff41', offset: 0 },  // Verde
    ];
    
    layers.forEach(layer => {
        ctx.shadowBlur = 20;
        ctx.shadowColor = layer.color;
        ctx.fillStyle = layer.color;
        ctx.fillText(text, 0, bounce + layer.offset);
    });
    
    // Testo finale bianco sopra
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 0, bounce);
    
    ctx.restore();
    
    // Sottotitolo con effetto glow
    ctx.save();
    ctx.font = 'bold 18px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ffff';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00ffff';
    const alpha = Math.sin(time * 0.1) * 0.3 + 0.7; // Pulsazione
    ctx.globalAlpha = alpha;
    ctx.fillText('Preparati al prossimo livello...', config.viewportWidth / 2, config.viewportHeight / 2 + 40);
    ctx.restore();
}

// Esporta la funzione per usarla in main.js
export function triggerVictoryFireworks() {
    // Importa createVictoryFirework da player.js
    return gameState.vX && gameState.vY;
}

export function updateHUD(currentLevelNumber, gameRunning) {
    if (!gameRunning) return;
    
    const levelDisplay = document.getElementById('level-display');
    if (levelDisplay) levelDisplay.textContent = currentLevelNumber.toString().padStart(2, '0');
    
    const powerBar = document.getElementById('power-bar');
    if (powerBar) {
        const percentage = Math.max(0, Math.min(100, (gameState.power / gameState.maxPower) * 100));
        powerBar.style.width = percentage + '%';
        if (percentage > 50) powerBar.style.backgroundColor = '#00ff41'; 
        else if (percentage > 25) powerBar.style.backgroundColor = '#ffff00'; 
        else powerBar.style.backgroundColor = '#ff0040'; 
    }
    
    const starsDisplay = document.getElementById('stars-display');
    if (starsDisplay) starsDisplay.textContent = gameState.stars;
    const flagsDisplay = document.getElementById('flags-display');
    if (flagsDisplay) flagsDisplay.textContent = gameState.flags;
    const bulbsDisplay = document.getElementById('bulbs-display');
    if (bulbsDisplay) bulbsDisplay.textContent = gameState.bulbs;
    
    const keyIndicator = document.querySelector('.key-indicator');
    if (keyIndicator) {
        if (gameState.hasKey) keyIndicator.classList.add('has-key');
        else keyIndicator.classList.remove('has-key');
    }
}

export function draw(gameRunning) {
    // Sfondo nero
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (!gameRunning) { 
        ctx.fillStyle = '#fff'; 
        ctx.fillText(gameState.statusMessage, 50, 100); 
        return; 
    }
    
    // Disegna pattern di mattoni come sfondo - FISSO CON LA CAMERA
    if (brickPattern) {
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        ctx.fillStyle = brickPattern;
        
        const worldLeft = camera.x - 100;
        const worldTop = camera.y - 100;
        const worldWidth = config.viewportWidth + 200;
        const worldHeight = config.viewportHeight + 200;
        
        ctx.fillRect(worldLeft, worldTop, worldWidth, worldHeight);
        
        // OVERLAY COLORE CASUALE
        ctx.fillStyle = brickColorOverlay;
        ctx.fillRect(worldLeft, worldTop, worldWidth, worldHeight);
        
        ctx.restore();
        
        // Overlay scuro per non disturbare il gameplay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, config.viewportWidth, config.viewportHeight);
    }
    
    // Mappa (mattoni del gioco)
    for (let y = 0; y < currentMap.length; y++) {
        for (let x = 0; x < currentMap[y].length; x++) {
            if (currentMap[y][x] === 1) {
                drawImg(sprites.brick, x * config.tileSize, y * config.tileSize, 1, 1);
            }
        }
    }
    
    // Lava
    lavas.forEach(l => {
        drawImg(sprites.lava, l.x, l.y, l.w / config.tileSize, l.h / config.tileSize);
        drawLavaEffects(l);
        createLavaParticles(l);
    });

    // Triggers
    triggers.forEach(t => {
        if (t.type === 'door') {
            if (!t.open) drawImg(sprites.door, t.x, t.y, t.w / config.tileSize, t.h / config.tileSize);
        }
        if (t.type === 'open') drawGlowingTrigger(t.x, t.y, t.w, t.h, '#00ffff', 'OPEN', 0);
        if (t.type === 'close') drawGlowingTrigger(t.x, t.y, t.w, t.h, '#ff6600', 'CLOSE', Math.PI);
    });

    drawLavaParticles();
    drawDustParticles(); // Disegna particelle di polvere
    drawColorParticles(); // Disegna particelle colorate (collect/hit)

    // Items
    items.forEach(i => { 
        if (!i.taken) {
            if (i.type === 'star') drawStarGlow(i);
            else drawImg(sprites[i.type], i.x, i.y, i.w / config.tileSize, i.h / config.tileSize);
        }
    });
    
    // Decorations
    decorations.forEach(d => { 
        if (d.type === 'woman') {
            if (!gameState.won) drawImg(sprites.woman, d.x, d.y, d.w / config.tileSize, d.h / config.tileSize); 
        }
    });

    // Enemies
    enemies.forEach(en => {
        let sprite = sprites.enemyH; 
        let flipDirection = false;

        if (en.type === 'H') {
            sprite = sprites.enemyH;
            if (en.vx < 0) flipDirection = true;
        }
        else if (en.type === 'V') {
            sprite = sprites.enemyV;
        }
        else if (en.type === 'S') {
            sprite = sprites.enemyS;
        }
        else if (en.type === 'X') {
            sprite = sprites.enemyX;
            if (en.vx > 0) flipDirection = true;
        }
        
        drawImg(sprite, en.x, en.y, en.w / config.tileSize, en.h / config.tileSize, flipDirection);
    });

    // FUOCHI D'ARTIFICIO DIETRO AI PROTAGONISTI (se in vittoria)
    if (gameState.won) {
        drawFireworkParticles();
    }

    // Player o immagine vittoria - SEMPRE SOPRA i fuochi
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

    // Game Over overlay
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
    
    // Vittoria
    if (gameState.won) { 
        gameState.victoryTime++;
        drawVictoryMessage();
    }
}
