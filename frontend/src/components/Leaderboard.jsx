import React from 'react';

/**
 * FUNCIÓN AUXILIAR: FORMATO DE MONEDA
 * -----------------------------------
 * Encapsula la lógica para presentar cifras financieras de manera legible.
 * Utiliza la API nativa del navegador (Intl) para mejor rendimiento.
 * * @param {string|number} amount - El valor a formatear.
 * @returns {string} - Cadena formateada (ej. "$1,500").
 */
const formatMoney = (amount) => {
  // Conversión defensiva para evitar errores si el backend envía strings
  const value = parseFloat(amount);
  
  // Fallback de seguridad: si no es un número válido, mostramos cero.
  if (isNaN(value)) return "$0.00";
  
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    maximumFractionDigits: 0 // UX: Ocultamos centavos para reducir ruido visual en la tabla
  }).format(value);
};

/**
 * COMPONENTE: LEADERBOARD (Ranking Global)
 * ----------------------------------------
 * Muestra la lista de los mejores jugadores ordenados por Patrimonio Neto.
 * Incluye lógica visual para resaltar al usuario actual y distinguir el podio (Top 3).
 * * @param {Array} players - Lista de objetos de jugadores (ordenada desde el backend).
 * @param {string} myNickname - El apodo del usuario actual para auto-identificación.
 */
const Leaderboard = ({ players, myNickname }) => {

  // ⬇️⬇️⬇️ BLOQUE NUEVO: ORDENAMIENTO EN CLIENTE ⬇️⬇️⬇️
  
  // --- CORRECCIÓN DE RANKING (CLIENT SIDE SORT) ---
  // Objetivo: Garantizar que la lista siempre se muestre ordenada de mayor a menor patrimonio,
  // independientemente del orden en que lleguen los datos crudos del socket.
  
  // 1. [...players]: Creamos una "Shallow Copy" (copia superficial) del array original.
  //    Esto es CRÍTICO en React, ya que 'players' es un prop inmutable. Si usamos .sort()
  //    directamente sobre 'players', React lanzaría un error de mutación de estado.
  const sortedPlayers = [...players].sort((a, b) => {
    // 2. Lógica de comparación numérica:
    //    Convertimos los strings de dinero ("1500.00") a flotantes reales.
    //    Restamos B - A para lograr un orden DESCENDENTE (Mayor a menor).
    return parseFloat(b.net_worth) - parseFloat(a.net_worth);
  });

  // ⬆️⬆️⬆️ FIN DEL BLOQUE NUEVO ⬆️⬆️⬆️

  return (
    // CONTENEDOR PRINCIPAL
    // Estilo "Glassmorphism" oscuro: bg-slate-900 con opacidad (80%)
    // Shadow-lg para dar profundidad sobre el tablero de juego.
    <div className="mt-4 bg-slate-900/80 border border-slate-700 rounded-lg p-4 w-full max-w-md shadow-lg">
      
      {/* TÍTULO DEL COMPONENTE */}
      <h3 className="text-xs text-lobo-gold uppercase tracking-widest font-bold mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
        <span>🏆</span> Ranking Global (Top 5)
      </h3>
      
      {/* CABECERA DE COLUMNAS */}
      <div className="flex justify-between text-[10px] text-slate-500 mb-2 px-2 font-bold uppercase tracking-wider">
        <span>Lobo / Agente</span>
        <span>Patrimonio Neto</span>
      </div>
      
      {/* LISTA DE JUGADORES */}
      <div className="space-y-2">
        
        {/* ⬇️ CAMBIO AQUÍ: Iteramos sobre 'sortedPlayers' en lugar de 'players' */}
        {sortedPlayers.map((p, index) => (
          <div 
            key={index} 
            // ESTILOS DINÁMICOS DE FILA
            // Si es el usuario actual (p.nickname === myNickname):
            // - Fondo azul neón tenue (bg-lobo-neon-blue/20)
            // - Borde brillante y sombra (glow effect)
            className={`flex justify-between items-center text-xs p-2 rounded transition-colors ${
              p.nickname === myNickname 
                ? "bg-lobo-neon-blue/20 border border-lobo-neon-blue/50 shadow-[0_0_10px_rgba(59,130,246,0.1)]" 
                : "bg-slate-800/50 hover:bg-slate-800"
            }`}
          >
            {/* LADO IZQUIERDO: POSICIÓN Y NOMBRE */}
            <div className="flex items-center gap-3">
              
              {/* INSIGNIA DE POSICIÓN (BADGE) */}
              {/* Lógica de colores para el PODIO (Oro, Plata, Bronce) */}
              <span className={`font-bold font-mono w-5 h-5 flex items-center justify-center rounded-full text-[10px] ${
                index === 0 ? "bg-yellow-500 text-black" : 
                index === 1 ? "bg-slate-400 text-black" :
                index === 2 ? "bg-orange-700 text-white" : "bg-slate-700 text-slate-400"
              }`}>
                {index + 1}
              </span>
              
              {/* NOMBRE DEL JUGADOR */}
              {/* truncate: Corta nombres muy largos con puntos suspensivos (...) */}
              <span className={`truncate max-w-[100px] ${p.nickname === myNickname ? "text-white font-bold" : "text-slate-300"}`}>
                {p.nickname} {p.nickname === myNickname && "(Tú)"}
              </span>
            </div>
            
            {/* LADO DERECHO: EL DINERO (Patrimonio Neto) */}
            {/* Si supera $1M, se pone amarillo (Victoria) */}
            <span className={`font-mono font-bold ${
              parseFloat(p.net_worth) >= 1000000 ? "text-yellow-400" : "text-green-400"
            }`}>
              {formatMoney(p.net_worth)}
            </span>
          </div>
        ))}
        
        {/* ESTADO VACÍO (EMPTY STATE) */}
        {players.length === 0 && (
          <p className="text-center text-slate-500 italic text-xs py-2">Buscando señales de vida...</p>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;