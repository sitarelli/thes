/* -------------------------------------------------------------------------- */
/* FISICA E LOGICA DEL PLAYER                                                 */
/* -------------------------------------------------------------------------- */

import { config, keys, player, gameState, camera, currentMap, items, enemies, lavas, triggers, decorations, lavaParticles, dustParticles, fireworkParticles, colorParticles, cameraShake, lavaAnimTime } from './config.js';
import { getTile as getMapTile } from './map.js';
import { safePlayAudio, sfx, playSound, stopAllSounds } from './main.js';

// Override locale di getTile che considera anche le porte
export function getTile(px, py) {
    const tx = Math.floor(px / config.tileSize);
    const ty = Math.floor(py / config.tileSize);
    
    if (ty < 0 || ty >= currentMap.length || tx < 0 || tx >= currentMap[0].length) return 1;
    if (currentMap[ty][tx] === 1) return 1;
    
    for (let t of triggers) {
        if (t.type === 'door' && !t.open && px >= t.x && px < t.x + t.w && py >= t.y && py < t.y + t.h) {
            return 1;
        }
    }
    return 0;
}

export function rectIntersect(r1, r2, useMargin = false) {
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

export function respawnPlayer() { 
    player.x = player.startX; 
    player.y = player.startY; 
    player.vx = 0; 
    player.vy = 0; 
    player.damageCooldown = 0;
    player.canFly = true; 
    player.isDying = false;
}

export function playerDie() { 
    if (player.isDying || gameState.gameOver) return; 
    
    player.isDying = true;
    player.deathFrame = 0;
    player.frameTimer = 0;
    
    stopAllSounds(); 
    safePlayAudio(sfx.death); 
}

export function restorePower(amount) {
    gameState.power = Math.min(gameState.maxPower, gameState.power + amount);
}

export function updateLavaParticles(deltaMultiplier = 1) {
    const filtered = lavaParticles.filter(p => p.life > 0);
    lavaParticles.length = 0;
    lavaParticles.push(...filtered);
    
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

export function createDustParticles() {
    // Solo se il player sta camminando a terra (animState === 1)
    if (player.animState === 1 && Math.random() < 0.3) {
        dustParticles.push({
            x: player.x + player.w / 2 + (Math.random() - 0.5) * player.w * 0.5,
            y: player.y + player.h - 2, // Sotto i piedi
            vx: (Math.random() - 0.5) * 0.8 - player.facing * 0.3, // Si muove indietro rispetto alla direzione
            vy: -Math.random() * 0.4 - 0.1,
            life: 1.0,
            size: Math.random() * 3.5 + 2.5,
            color: 'rgba(150, 150, 150, 0.6)'
        });
    }
}

export function updateDustParticles(deltaMultiplier = 1) {
    const filtered = dustParticles.filter(p => p.life > 0);
    dustParticles.length = 0;
    dustParticles.push(...filtered);
    
    dustParticles.forEach(p => {
        p.x += p.vx * deltaMultiplier;
        p.y += p.vy * deltaMultiplier;
        p.vy += 0.02 * deltaMultiplier; // Gravità leggera
        p.life -= 0.025 * deltaMultiplier;
        p.size += 0.05 * deltaMultiplier; // Si espande leggermente
        p.vx *= Math.pow(0.95, deltaMultiplier); // Attrito
    });
}

// ===== PARTICELLE COLORATE (da React) =====
export function createColorParticles(x, y, count, type = 'collect') {
    const colors = type === 'death' || type === 'hit'
        ? ['#ff0000', '#ff6600', '#ffff00'] // Rosso/arancio/giallo per danno
        : ['#00ffff', '#ff00ff', '#ffff00', '#00ff00']; // Cyan/magenta/giallo/verde per collect
    
    for (let i = 0; i < count; i++) {
        colorParticles.push({
            x, y,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            life: 1,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 1.5 + 0.5
        });
    }
}

export function updateColorParticles(deltaMultiplier = 1) {
    const filtered = colorParticles.filter(p => p.life > 0);
    colorParticles.length = 0;
    colorParticles.push(...filtered);
    
    colorParticles.forEach(p => {
        p.x += p.vx; // Velocità normale
        p.y += p.vy;
        p.vy += 0.9; // Gravità
        p.life -= 0.02;
    });
}

// ===== CAMERA SHAKE =====
export function addCameraShake(intensity) {
    cameraShake.intensity = intensity;
}

export function updateCameraShake() {
    if (cameraShake.intensity > 0) {
        cameraShake.x = (Math.random() - 0.5) * cameraShake.intensity;
        cameraShake.y = (Math.random() - 0.5) * cameraShake.intensity;
        cameraShake.intensity *= 0.9;
        if (cameraShake.intensity < 0.1) cameraShake.intensity = 0;
    } else {
        cameraShake.x = 0;
        cameraShake.y = 0;
    }
}


export function winLevel(d, currentLevelNumber, loadLevelScript) { 
    gameState.won = true; 
    gameState.victoryTime = 0;
    gameState.vX = d.x; 
    gameState.vY = d.y; 
    gameState.vW = d.w; 
    gameState.vH = d.h;
    
    sfx.walk.pause(); 
    sfx.fly.pause(); 
    safePlayAudio(sfx.levelup);
    
    setTimeout(() => { 
        sfx.levelup.pause(); 
        loadLevelScript(currentLevelNumber + 1); 
    }, 5000); 
}

export function update(dt, showRetryButtonCallback, currentLevelNumber, loadLevelScript) {
    if (gameState.gameOver || gameState.won) {
        sfx.walk.pause();
        sfx.fly.pause();
        return;
    }

    // --- GESTIONE ANIMAZIONE MORTE ---
    if (player.isDying) {
        player.frameTimer += dt * 30;
        if (player.frameTimer > 8) { 
            player.frameTimer = 0;
            player.deathFrame++;
            if (player.deathFrame >= 8) { 
                gameState.gameOver = true;
                showRetryButtonCallback();
            }
        }
        return;
    }

    // === GESTIONE COOLDOWN DANNO ===
    if (player.damageCooldown > 0) {
        player.damageCooldown -= dt;
    }

    // === POWER EROSION (THESEUS CORE MECHANIC) ===
    const POWER_DRAIN_PER_SECOND = 0.003; 
    gameState.power -= POWER_DRAIN_PER_SECOND * dt;
    
    if (gameState.power <= 0) {
        gameState.power = 0;
        playerDie();
        return;
    }

    // === 1. MOVIMENTO ORIZZONTALE E COLLISIONI LATERALI ===
    const speed = config.baseSpeed * config.tileSize * dt;
    if (keys.right) { 
        player.vx = speed; 
        player.facing = 1; 
    } 
    else if (keys.left) { 
        player.vx = -speed; 
        player.facing = -1; 
    } 
    else player.vx = 0;

    player.x += player.vx;
    
    // Generiamo i punti orizzontali dinamicamente (Sensori Muri)
    const hPoints = [0.1];
    // SAFETY CHECK: evitiamo loop infiniti se tileSize non è ancora inizializzato
    if (config.tileSize > 2) {
        for (let p = config.tileSize - 2; p < player.h - 1; p += config.tileSize - 2) {
            hPoints.push(p); 
        }
    }
    hPoints.push(player.h - 0.1);

    for (let p of hPoints) {
        if (player.vx > 0 && getTile(player.x + player.w, player.y + p)) {
            player.x = Math.floor((player.x + player.w) / config.tileSize) * config.tileSize - player.w - 0.01;
            player.vx = 0;
        }
        if (player.vx < 0 && getTile(player.x, player.y + p)) {
            player.x = (Math.floor(player.x / config.tileSize) + 1) * config.tileSize + 0.01;
            player.vx = 0;
        }
    }

    // === 2. MOVIMENTO VERTICALE E COLLISIONI PAVIMENTO/SOFFITTO ===
    const grav = config.baseGravity * config.tileSize * dt;
    const thr = config.baseThrust * config.tileSize * dt;
    
    if (keys.up && player.canFly) {
        player.vy += thr;
    } 
    
    player.vy += grav;
    const mF = config.maxFallSpeed * config.tileSize;
    const mY = config.maxFlySpeed * config.tileSize;
    if (player.vy > mF) player.vy = mF; 
    if (player.vy < mY) player.vy = mY;
    
    player.y += player.vy;

    // Generiamo i punti verticali dinamicamente (Sensori Pavimento/Soffitto)
    const margin = 4; 
    const wPoints = [margin];
    // SAFETY CHECK: evitiamo loop infiniti se tileSize non è ancora inizializzato
    if (config.tileSize > 2) {
        for (let p = margin + config.tileSize - 2; p < player.w - margin; p += config.tileSize - 2) {
            wPoints.push(p);
        }
    }
    wPoints.push(player.w - margin);

    for (let p of wPoints) {
        // COLLISIONE SOFFITTO (Testa)
        if (player.vy < 0 && getTile(player.x + p, player.y)) { 
            player.y = (Math.floor(player.y / config.tileSize) + 1) * config.tileSize; 
            player.vy = 0; 
            player.canFly = false; 
        }
        // COLLISIONE PAVIMENTO (Piedi)
        if (player.vy > 0 && getTile(player.x + p, player.y + player.h)) { 
            player.y = Math.floor((player.y + player.h) / config.tileSize) * config.tileSize - player.h; 
            player.vy = 0; 
            player.canFly = true; 
        }
    }

    // ANIMAZIONE STATI
    if (player.vy < -0.01) player.animState = 2; 
    else if (player.vy > 0.02) player.animState = 3; 
    else if (Math.abs(player.vx) > 0.01) player.animState = 1; 
    else player.animState = 0;

    // SUONI MOVIMENTO
    if (player.animState === 2 || player.animState === 3) {
        if (sfx.fly.paused) safePlayAudio(sfx.fly);
        sfx.walk.pause(); 
    } 
    else if (player.animState === 1) {
        if (sfx.walk.paused) safePlayAudio(sfx.walk);
        sfx.fly.pause();
    } 
    else {
        sfx.walk.pause();
        sfx.fly.pause();
    }

    player.frameTimer++;
    if (player.frameTimer > 8) { 
        player.frameTimer = 0; 
        player.frameIndex = (player.frameIndex + 1) % 4; 
    }

    lavaAnimTime.value += 0.05 * dt * 60;
    updateLavaParticles(dt * 60);
    createDustParticles(); // Crea particelle di polvere
    updateDustParticles(dt * 60); // Aggiorna particelle di polvere
    updateColorParticles(); // Aggiorna particelle colorate (senza moltiplicatore)
    updateCameraShake(); // Aggiorna camera shake
    
    // === NEMICI: MOVIMENTO E DANNO ===
    const ENEMY_HIT_DAMAGE = 0.25;

    enemies.forEach(en => {
        en.x += en.vx; 
        en.y += en.vy;

        if (en.vx > 0 && (getTile(en.x + en.w, en.y) || getTile(en.x + en.w, en.y + en.h - 1))) en.vx *= -1;
        else if (en.vx < 0 && (getTile(en.x, en.y) || getTile(en.x, en.y + en.h - 1))) en.vx *= -1;
        if (en.vy > 0 && (getTile(en.x, en.y + en.h) || getTile(en.x + en.w - 1, en.y + en.h))) en.vy *= -1;
        else if (en.vy < 0 && (getTile(en.x, en.y) || getTile(en.x + en.w - 1, en.y))) en.vy *= -1;

        // COLLISIONE NEMICO
        if (rectIntersect(player, en, true)) {
            if (player.damageCooldown <= 0) {
                gameState.power -= ENEMY_HIT_DAMAGE;
                safePlayAudio(sfx.contact);
                player.damageCooldown = 2.0;
                
                // PARTICELLE ROSSE e CAMERA SHAKE
                const playerCenterX = player.x + player.w / 2;
                const playerCenterY = player.y + player.h / 2;
                createColorParticles(playerCenterX, playerCenterY, 20, 'hit');
                addCameraShake(10);
                
                if (gameState.power <= 0) {
                    gameState.power = 0;
                    playerDie();
                }
            }
        }
    });

    // === LAVA: DANNO CONTINUO ===
    const LAVA_DAMAGE_PER_SECOND = 0.5;
    let touchingLava = false; // Flag per tracciare contatto con lava
    
    lavas.forEach(l => {
        if (rectIntersect(player, l, true)) {
            touchingLava = true; // Player sta toccando la lava
            gameState.power -= LAVA_DAMAGE_PER_SECOND * dt;
            if (sfx.lava.paused) safePlayAudio(sfx.lava);
            
            // PARTICELLE ROSSE ogni tanto
            if (Math.random() < 0.1) { // 10% probabilità per frame
                const playerCenterX = player.x + player.w / 2;
                const playerCenterY = player.y + player.h / 2;
                createColorParticles(playerCenterX, playerCenterY, 5, 'hit');
            }
            
            if (gameState.power <= 0) {
                gameState.power = 0;
                playerDie();
            }
        }
    });
    
    player.isInLava = touchingLava; // Aggiorna lo stato

    // === OGGETTI ===
    items.forEach(item => { 
        if (!item.taken && rectIntersect(player, item, false)) { 
            item.taken = true; 
            
            // PARTICELLE COLORATE al centro dell'item
            const itemCenterX = item.x + item.w / 2;
            const itemCenterY = item.y + item.h / 2;
            createColorParticles(itemCenterX, itemCenterY, 15, 'collect');
            
            if (item.type === 'key') { 
                gameState.hasKey = true; 
                safePlayAudio(sfx.keyPickup); 
            }
            else if (item.type === 'bulb') { 
                restorePower(0.5); 
                gameState.bulbs++; 
                playSound('bonus'); 
            }
            else if (item.type === 'star') { 
                restorePower(0.25); 
                gameState.stars++; 
                playSound('bonus'); 
            }
            else if (item.type === 'flag') { 
                gameState.flags++; 
                playSound('bonus'); 
            }
            else if (item.type === 'timer') { 
                restorePower(0.1); 
                playSound('bonus'); 
            }
        } 
    });
    
    triggers.forEach(trig => { 
        if (trig.type !== 'door' && rectIntersect(player, trig, false)) { 
            if (trig.type === 'open') { 
                triggers.forEach(door => {
                    if (door.type === 'door' && door.group === trig.group && !door.open) {
                        door.open = true; 
                        safePlayAudio(sfx.doorOpen);
                    }
                });
            } 
            if (trig.type === 'close') { 
                triggers.forEach(door => {
                    if (door.type === 'door' && door.group === trig.group && door.open) {
                        door.open = false; 
                        safePlayAudio(sfx.doorClose);
                    }
                });
            } 
        } 
    });

    decorations.forEach(d => { 
        if (d.type === 'woman' && rectIntersect(player, d, false) && gameState.hasKey) {
            if (!gameState.won) {
                const womanCenterX = d.x + d.w / 2;
                const womanCenterY = d.y + d.h / 2;
                
                // Esplosione iniziale di particelle colorate
                createColorParticles(womanCenterX, womanCenterY, 50, 'collect'); 
                
                winLevel(d, currentLevelNumber, loadLevelScript); 
            }
        } 
    });
    
    camera.x += ((player.x * config.zoom) - (config.viewportWidth / 2) - camera.x) * 0.1;
    camera.y += ((player.y * config.zoom) - (config.viewportHeight / 2) - camera.y) * 0.1;
    
    // Applica camera shake
    camera.x += cameraShake.x;
    camera.y += cameraShake.y;
}