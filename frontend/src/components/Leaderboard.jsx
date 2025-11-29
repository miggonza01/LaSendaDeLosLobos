import React from 'react';

/**
 * UTILIDAD DE FORMATEO FINANCIERO 
 * frontend/src/components/Leaderboard.jsx
 * -------------------------------
 * Esta función auxiliar encapsula la lógica de presentación de moneda.
 * * @param {string|number} amount - El monto a formatear (puede venir como string desde el backend).
 * @returns {string} - Cadena formateada (Ej: "$1,500").
 */
const formatMoney = (amount) => {
  // Conversión defensiva: Aseguramos que sea un número flotante antes de formatear.
  const value = parseFloat(amount);
  
  // Manejo de errores: Si el valor no es válido, mostramos un fallback seguro.
  if (isNaN(value)) return "$0.00";
  
  // Uso de API Nativa del Navegador (Intl.NumberFormat)
  // Es más eficiente que librerías externas para tareas simples de localización.
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    maximumFractionDigits: 0 // DECISIÓN DE UX: Ocultamos centavos para reducir ruido visual en la lista.
  }).format(value);
};

/**
 * COMPONENTE: LEADERBOARD (Tabla de Posiciones)
 * ---------------------------------------------
 * Responsabilidad: Mostrar el ranking de jugadores en tiempo real.
 * * Props:
 * - players: Array de objetos con datos de los jugadores (nickname, net_worth).
 * - myNickname: String con el nombre del usuario actual (para auto-identificación).
 */
const Leaderboard = ({ players, myNickname }) => {
  return (
    // CONTENEDOR PRINCIPAL
    // Estilo: Panel flotante semitransparente (Cyberpunk Lite)
    // bg-slate-900/80: Fondo oscuro con opacidad para integrarse al tablero.
    <div className="mt-4 bg-slate-900/80 border border-slate-700 rounded-lg p-3 w-full max-w-md">
      
      {/* CABECERA DEL MODULO */}
      {/* text-lobo-gold: Color personalizado para denotar valor/premio. */}
      <h3 className="text-xs text-lobo-gold uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
        <span>🏆</span> Top 5 Lobos
      </h3>
      
      {/* LISTA DE JUGADORES */}
      <div className="space-y-1">
        {/* Iteración sobre el array de jugadores (Top 5 pre-filtrado por el backend) */}
        {players.map((p, index) => (
          <div 
            key={index} 
            // CONDICIONAL DE ESTILO (RESALTADO DEL JUGADOR ACTUAL)
            // Si el nickname coincide con 'myNickname', aplicamos un borde y fondo azul neón.
            // Esto es crucial para la UX: el jugador debe encontrarse rápidamente en la lista.
            className={`flex justify-between items-center text-xs p-2 rounded ${
              p.nickname === myNickname 
                ? "bg-lobo-neon-blue/20 border border-lobo-neon-blue/50" 
                : "bg-slate-800/50"
            }`}
          >
            {/* COLUMNA IZQUIERDA: RANKING Y NOMBRE */}
            <div className="flex items-center gap-2">
              {/* POSICIÓN NUMÉRICA */}
              {/* Resaltamos al #1 con color amarillo, el resto en gris pizarra */}
              <span className={`font-bold font-mono w-4 ${index === 0 ? "text-yellow-400" : "text-slate-500"}`}>
                #{index + 1}
              </span>
              
              {/* NOMBRE DEL JUGADOR */}
              {/* Resaltamos en blanco si es el usuario actual, gris si es oponente */}
              <span className={p.nickname === myNickname ? "text-white font-bold" : "text-slate-300"}>
                {p.nickname} {p.nickname === myNickname && "(Tú)"} {/* Feedback visual explícito */}
              </span>
            </div>
            
            {/* COLUMNA DERECHA: PATRIMONIO NETO */}
            {/* Esta es la métrica de victoria. Se usa fuente monoespaciada para alineación numérica. */}
            <span className="font-mono text-green-400">
              {formatMoney(p.net_worth)}
            </span>
          </div>
        ))}
        
        {/* ESTADO VACÍO (EMPTY STATE) */}
        {/* Se muestra si el array de players llega vacío (ej. inicio de partida o error de carga) */}
        {players.length === 0 && (
          <p className="text-center text-slate-500 italic">Esperando datos...</p>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;