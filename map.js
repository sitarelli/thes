/* -------------------------------------------------------------------------- */
/* GESTIONE MAPPA E LIVELLI                                                   */
/* -------------------------------------------------------------------------- */

import { config, currentMap } from './config.js';

// Definizione dei livelli (verranno caricati dinamicamente dai file levelN.js)
export const levels = {};

// Funzioni di utilità mappa
export function getTile(x, y) {
    const tileX = Math.floor(x / config.tileSize);
    const tileY = Math.floor(y / config.tileSize);
    if (!currentMap[tileY] || currentMap[tileY][tileX] === undefined) return 0;
    return currentMap[tileY][tileX];
}

export function isSolid(tileValue) {
    return tileValue === 1;
}

export function isDoor(tileValue) {
    return tileValue === 8;
}

export function isLava(tileValue) {
    return tileValue === 7;
}
