/* -------------------------------------------------------------------------- */
/* CONFIGURAZIONE E COSTANTI GLOBALI                                          */
/* -------------------------------------------------------------------------- */

// Rilevazione mobile migliorata (controlla user agent E dimensioni schermo E touch support)
function detectMobile() {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth <= 1024; // tablet/mobile
    
    const result = (isMobileUA || hasTouch) && isSmallScreen;
    console.log('🔍 Rilevazione Mobile:', {
        hasTouch,
        isMobileUA,
        isSmallScreen,
        screenWidth: window.innerWidth,
        isMobile: result,
        viewport: result ? '960x540 (16:9)' : '740x510 (4:3)',
        zoomApplicato: result ? 1.5 : 1
    });
    return result;
}

export const isMobile = detectMobile();

// Viewport dinamico: widescreen 16:9 su mobile, 4:3 su desktop
const viewportWidth = isMobile ? 1490 : 1000;   // Più largo su mobile
const viewportHeight = isMobile ? 540 : 580;  // Formato 16:9 su mobile

export const config = {
    viewportWidth,
    viewportHeight,
    baseGravity: 0.45,
    baseSpeed: 15.0,
    baseThrust: -0.80,
    maxFallSpeed: 4.6,
    maxFlySpeed: -0.36,
    enemySpeedMultiplier: 0.15,
    zoom: isMobile ? 1.5 : 1,  // 50% di zoom in più su mobile
    tileSize: 0,
    hitboxMargin: 0.25,
    fixedTimeStep: 1/60
};

// Stato dei tasti/input (condiviso tra input.js e player.js)
export const keys = { 
    right: false, 
    left: false, 
    up: false 
};

// Stato del gioco
export const gameState = { 
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

// Player entity
export const player = { 
    x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, startX: 0, startY: 0,
    frameIndex: 0,
    frameTimer: 0,
    facing: 1,        
    animState: 0,
    damageCooldown: 0,
    canFly: true,
    isDying: false,
    deathFrame: 0,
    isInLava: false  // Nuovo: flag per effetto rosso in lava
};

// Camera
export const camera = { x: 0, y: 0 };

// Variabili di gioco condivise
export let currentLevelNumber = 1;
export let gameRunning = false;
export let currentMap = [];
export let items = [];
export let enemies = [];
export let triggers = [];
export let decorations = [];
export let lavas = [];
export let lavaParticles = [];
export let dustParticles = [];  // Nuovo: particelle di polvere
export let fireworkParticles = []; // Nuovo: fuochi d'artificio romantici
export let colorParticles = []; // Particelle colorate per collect/hit
export const lavaAnimTime = { value: 0 };
export const cameraShake = { x: 0, y: 0, intensity: 0 }; // Camera shake

// Funzioni setter per le variabili che devono essere modificabili
export function setCurrentLevelNumber(num) {
    currentLevelNumber = num;
}

export function setGameRunning(value) {
    gameRunning = value;
}

export function setCurrentMap(map) {
    currentMap = map;
}

export function setItems(arr) {
    items = arr;
}

export function setEnemies(arr) {
    enemies = arr;
}

export function setTriggers(arr) {
    triggers = arr;
}

export function setDecorations(arr) {
    decorations = arr;
}

export function setLavas(arr) {
    lavas = arr;
}

export function setLavaParticles(arr) {
    lavaParticles = arr;
}

export function setDustParticles(arr) {
    dustParticles = arr;
}

export function setFireworkParticles(arr) {
    fireworkParticles = arr;
}

export function setColorParticles(arr) {
    colorParticles = arr;
}

export function resetPlayer() {
    player.x = player.startX;
    player.y = player.startY;
    player.vx = 0;
    player.vy = 0;
    player.frameIndex = 0;
    player.frameTimer = 0;
    player.facing = 1;
    player.animState = 0;
    player.damageCooldown = 0;
    player.canFly = true;
    player.isDying = false;
    player.deathFrame = 0;
    player.isInLava = false;
}