// =============================================================================
// 📄 ARCHIVO: src/components/GameBoard.jsx
// 📝 DESCRIPCIÓN: Renderiza el tablero circular usando SVG.
// 🛠️ CORRECCIONES:
//    1. Eliminado 'myPosition' de props (no se usaba).
//    2. Reemplazado Math.random() por un cálculo determinista basado en ID
//       para cumplir con la pureza de renderizado de React.
//    3. Aplicado el offset calculado para evitar superposición de fichas.
// =============================================================================

import React from 'react';
import { TOTAL_CELLS, getTileColor, BOARD_TILES } from '../utils/boardData';

// Eliminamos 'myPosition' de las props ya que la lógica usa 'player.is_me' interno
const GameBoard = ({ players }) => {
  
  // --- CONFIGURACIÓN GEOMÉTRICA ---
  const RADIUS = 140; // Radio del círculo principal
  const CENTER = 160; // Centro del SVG (X, Y)
  
  // Función matemática para convertir índice lineal (1-30) a coordenadas polares (X, Y)
  const getCoordinates = (index, offsetRadius = 0) => {
    // 1. Calcular ángulo: (Indice / Total) * 2PI radianes.
    // Restamos PI/2 para que la casilla 1 empiece arriba (las 12 del reloj).
    const angle = (index / TOTAL_CELLS) * 2 * Math.PI - Math.PI / 2;
    
    // 2. Aplicar radio variable (para efecto de capas)
    const r = RADIUS + offsetRadius;
    
    // 3. Convertir Polar a Cartesiano
    return {
      x: CENTER + r * Math.cos(angle),
      y: CENTER + r * Math.sin(angle)
    };
  };

  // --- RENDERIZADO DEL TABLERO ESTÁTICO (CASILLAS) ---
  const tiles = Array.from({ length: TOTAL_CELLS }, (_, i) => {
    const pos = i + 1; // Casillas 1 a 30
    const { x, y } = getCoordinates(pos);
    const colorClass = getTileColor(pos);
    const data = BOARD_TILES[pos];
    
    return (
      <g key={pos}>
        {/* Círculo base de la casilla */}
        <circle 
          cx={x} cy={y} r="6" 
          className={`fill-slate-900 stroke-2 ${colorClass} transition-all duration-500`}
        />
        
        {/* Número de casilla (Guía visual cada 5 pasos) */}
        {pos % 5 === 0 && (
          <text x={x} y={y} dy="15" textAnchor="middle" className="fill-slate-500 text-[8px] font-mono select-none">
            {pos}
          </text>
        )}

        {/* Punto indicador de tipo (Rojo/Azul) */}
        {data && (
            <circle cx={x} cy={y} r="2" className={data.type === 'NEGRO' ? 'fill-red-500' : 'fill-blue-500'} />
        )}
      </g>
    );
  });

  // --- RENDERIZADO DE JUGADORES (FICHAS) ---
  const playerTokens = players.map((player) => {
    // 🛠️ CORRECCIÓN DE PUREZA REACT:
    // En lugar de Math.random(), generamos un número estable basado en el ID del jugador.
    // Sumamos los códigos ASCII de los caracteres del ID para obtener un "hash" simple.
    const idHash = player.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Usamos el hash para generar un desplazamiento entre -6 y +6 pixeles.
    // Esto evita que las fichas se apilen perfectamente una sobre otra.
    const stableOffset = (idHash % 12) - 6; 

    // Definir radio: 
    // - Si soy yo: Floto un poco más adentro (-15px) para destacar.
    // - Si es otro: Uso el radio normal + el pequeño desplazamiento calculado.
    const radiusAdjustment = player.is_me ? -15 : stableOffset;

    // Calcular posición final
    const { x, y } = getCoordinates(player.position, radiusAdjustment);

    return (
      <g key={player.id} className="transition-all duration-700 ease-out">
        {/* Halo pulsante (Solo para el usuario actual) */}
        {player.is_me && (
          <circle cx={x} cy={y} r="10" className="fill-lobo-neon-blue/30 animate-pulse" />
        )}
        
        {/* Ficha física */}
        <circle 
          cx={x} cy={y} 
          r={player.is_me ? 6 : 4} 
          className={player.is_me ? "fill-white stroke-lobo-neon-blue stroke-2" : "fill-slate-400 opacity-80"}
        />
        
        {/* Etiqueta "YO" */}
        {(player.is_me) && (
           <text x={x} y={y - 10} textAnchor="middle" className="fill-white text-[10px] font-bold drop-shadow-md select-none">
             YO
           </text>
        )}
      </g>
    );
  });

  return (
    <div className="flex justify-center items-center py-4">
      {/* Contenedor SVG Responsivo */}
      <div className="relative w-[320px] h-[320px]">
        
        <svg width="320" height="320" viewBox="0 0 320 320" className="w-full h-full">
          
          {/* Riel / Guía del circuito */}
          <circle cx={CENTER} cy={CENTER} r={RADIUS} className="fill-none stroke-slate-800 stroke-1" />
          
          {/* Capa 1: Casillas */}
          {tiles}
          
          {/* Capa 2: Jugadores */}
          {playerTokens}

          {/* Decoración Central (Marca de Agua) */}
          <g className="opacity-30">
            <circle cx={CENTER} cy={CENTER} r="40" className="fill-slate-800/50 stroke-slate-700" />
            <text x={CENTER} y={CENTER} dy="5" textAnchor="middle" className="fill-slate-500 text-xs font-mono tracking-widest select-none">
              RACE
            </text>
          </g>

        </svg>

      </div>
    </div>
  );
};

export default GameBoard;