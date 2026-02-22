/* -------------------------------------------------------------------------- */
/* RENDERING E DISEGNO                                                        */
/* -------------------------------------------------------------------------- */


import { config, player, gameState, camera, currentMap, items, enemies, lavas, triggers, decorations, lavaParticles, dustParticles, fireworkParticles, colorParticles, lavaAnimTime, isMobile } from './config.js';

let ctx = null;
let canvas = null;
let sprites = {};

// Immagine di sfondo con parallasse (dinamica per livello)
let bgImage = new Image();
bgImage.src = 'jpg/sfondo1.jpg'; // Default: livello 1
const BG_IMG_W = 2560;
const BG_IMG_H = 1086;

// Parallasse: quanto si muove lo sfondo rispetto alla camera (0 = fisso, 1 = 1:1)
const PARALLAX_FACTOR = 0.3;

// Carica lo sfondo corrispondente al numero di livello
export function setBackgroundForLevel(levelNumber) {
    const newSrc = `jpg/sfondo${levelNumber}.jpg`;
    if (bgImage.src.endsWith(newSrc)) return; // Già caricato, evita reload inutile
    const img = new Image();
    img.src = newSrc;
    img.onload = () => { bgImage = img; };
    img.onerror = () => {
        // Se sfondoN.jpg non esiste, usa sfondo1.jpg come fallback
        console.warn(`sfondo${levelNumber}.jpg non trovato, uso sfondo1.jpg`);
        const fallback = new Image();
        fallback.src = 'sfondo1.jpg';
        fallback.onload = () => { bgImage = fallback; };
    };
}

export function initRenderer(canvasElement, contextElement, spritesData) {
    canvas = canvasElement;
    ctx = contextElement;
    sprites = spritesData;

    // TRUCCO ANTI-LAG PER MOBILE: Intercettiamo i shadowBlur e li azzeriamo
    if (isMobile) {
        const originalSetter = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur').set;
        Object.defineProperty(ctx, 'shadowBlur', {
            set: function(val) {
                originalSetter.call(this, 0); // Forza le ombre sempre a 0 su smartphone
            }
        });
    }
}





// Mantenuto per compatibilità con chiamate esterne (ora non fa nulla)
export function randomizeBrickColor() {
    // Non più necessario: lo sfondo è un'immagine fissa
}

// Funzione di disegno sfondo con parallasse
function drawBackground() {
    if (!bgImage.complete || bgImage.naturalWidth === 0) {
        // Fallback se l'immagine non è ancora caricata
        ctx.fillStyle = '#1a1410';
        ctx.fillRect(0, 0, config.viewportWidth, config.viewportHeight);
        return;
    }

    const vW = config.viewportWidth;
    const vH = config.viewportHeight;

    // Offset parallasse: lo sfondo scorre più lentamente della camera
    const parallaxOffsetX = camera.x * PARALLAX_FACTOR;
    const parallaxOffsetY = camera.y * PARALLAX_FACTOR;

    // Scala l'immagine per coprire sempre l'intera viewport in altezza
    const scale = vH / BG_IMG_H;
    const scaledW = BG_IMG_W * scale;
    const scaledH = vH; // = BG_IMG_H * scale

    // Quante volte dobbiamo ripetere l'immagine orizzontalmente?
    // (per mappe molto larghe con forte parallasse)
    const startX = -(parallaxOffsetX % scaledW);

    for (let tx = startX; tx < vW; tx += scaledW) {
        ctx.drawImage(bgImage, tx, -(parallaxOffsetY % scaledH), scaledW, scaledH);
        // Gestione verticale in loop se la mappa è più alta della viewport scalata
        if (parallaxOffsetY % scaledH !== 0) {
            ctx.drawImage(bgImage, tx, -(parallaxOffsetY % scaledH) + scaledH, scaledW, scaledH);
        }
    }

    // Overlay scuro per non disturbare la leggibilità del gameplay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, vW, vH);
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
    



// EFFETTO ROSSO SE IN LAVA (Ruotato: Terzo VERTICALE centrale)
    if (player.isInLava && !player.isDying) {
        ctx.globalCompositeOperation = 'source-atop';
        const intensity = 0.5 + Math.sin(Date.now() * 0.01) * 0.2; // Pulsazione
        ctx.fillStyle = `rgba(255, 50, 0, ${intensity * 0.6})`;
        
        // Calcoliamo un terzo della LARGHEZZA (dw)
        const unTerzoW = dw / 3;
        
        if (player.facing === -1) {
            // Guarda a sinistra: trasliamo di 1/3 di larghezza e coloriamo per 1/3
            // Usiamo tutta l'altezza (dh)
            ctx.fillRect(unTerzoW, 0, unTerzoW, dh);
        } else {
            // Guarda a destra: aggiungiamo 1/3 alla posizione X (dx)
            // Usiamo tutta l'altezza (dh)
            ctx.fillRect(dx + unTerzoW, dy, unTerzoW, dh);
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




// === MAGIA: FUOCHI D'ARTIFICIO DI CUORI E STELLE ===
export function drawFireworkParticles() {
    fireworkParticles.forEach(p => {
        // Se la particella è svanita, non la disegniamo
        if (p.life <= 0) return; 
        
        ctx.save();
        ctx.globalAlpha = p.life;
        
        // Imposta la dimensione e il font per le emoji
        ctx.font = `${p.size * 2 * config.zoom}px serif`; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Calcola la posizione sullo schermo
        const px = p.x * config.zoom - camera.x;
        const py = p.y * config.zoom - camera.y;
        
        // Disegna cuore o stella a seconda del tipo
        ctx.fillText(p.type === 'heart' ? '❤️' : '⭐', px, py);
        
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
    // OTTIMIZZAZIONE MOBILE: Riduce particelle drasticamente su mobile
    const maxParticles = isMobile ? 500 : 800;
    const spawnChance = isMobile ? 0.050 : 0.10;
    
    if (lavaParticles.length > maxParticles) return;
    
    if (Math.random() < spawnChance) {
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
    
    // SFONDO CON PARALLASSE: immagine sfondo1.jpg
    drawBackground();
    
    // OTTIMIZZAZIONE: Mappa (disegna solo tile visibili - culling)
    const tileZoom = config.tileSize * config.zoom;
    const startX = Math.max(0, Math.floor(camera.x / tileZoom));
    const endX = Math.min(currentMap[0]?.length || 0, Math.ceil((camera.x + config.viewportWidth) / tileZoom) + 1);
    const startY = Math.max(0, Math.floor(camera.y / tileZoom));
    const endY = Math.min(currentMap.length, Math.ceil((camera.y + config.viewportHeight) / tileZoom) + 1);
    
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            if (currentMap[y] && currentMap[y][x] === 1) {
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
        // Cambiato canvas.width/height per evitare che l'overlay sia gigante
        ctx.fillRect(0, 0, config.viewportWidth, config.viewportHeight); 
        
        ctx.fillStyle = '#fff'; 
        ctx.font = 'bold 60px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff0000';
        
        // FIX: Centrato usando le dimensioni logiche della viewport, non i pixel del canvas!
        ctx.fillText("GAME OVER", config.viewportWidth / 2, config.viewportHeight / 2 - 20); 
        ctx.shadowBlur = 0;
    }

    // Vittoria
    if (gameState.won) { 
        gameState.victoryTime++;
        drawVictoryMessage();
    }
}
