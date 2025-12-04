// =============================================================================
// 📄 ARCHIVO: src/utils/boardData.js
// 📝 DESCRIPCIÓN: Mapeo visual del tablero. Debe coincidir con board.py
// =============================================================================

export const TOTAL_CELLS = 30;

// Definimos los tipos de casillas para colorearlas
// 0 = Neutro (Gris)
// 1 = Lobo Negro (Rojo - Gasto)
// 2 = Lobo Blanco (Azul - Inversión)

export const BOARD_TILES = {
    // Lobos Negros
    3: { type: 'NEGRO', label: 'iPhone' },
    7: { type: 'NEGRO', label: 'Cena' },
    12: { type: 'NEGRO', label: 'Auto' },
    18: { type: 'NEGRO', label: 'Boda' },
    22: { type: 'NEGRO', label: 'Cripto' },
    27: { type: 'NEGRO', label: 'Dentista' },

    // Lobos Blancos
    5: { type: 'BLANCO', label: 'Drop' },
    9: { type: 'BLANCO', label: 'Tacos' },
    14: { type: 'BLANCO', label: 'YouTube' },
    16: { type: 'BLANCO', label: 'Airbnb' },
    20: { type: 'BLANCO', label: 'Vending' },
    25: { type: 'BLANCO', label: 'SaaS' },
    29: { type: 'BLANCO', label: 'Angel' }
};

export const getTileColor = (index) => {
    const tile = BOARD_TILES[index];
    if (!tile) return "stroke-slate-700"; // Neutro
    if (tile.type === 'NEGRO') return "stroke-lobo-neion-red";
    if (tile.type === 'BLANCO') return "stroke-lobo-neon-blue";
    return "stroke-slate-700";
};