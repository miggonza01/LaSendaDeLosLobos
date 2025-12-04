// =============================================================================
// 📄 ARCHIVO: src/components/TeacherDashboard.jsx
// 📝 DESCRIPCIÓN: Panel de control. Ahora incluye el Tablero Visual.
// =============================================================================

import React from 'react';
import Leaderboard from './Leaderboard';
import GameBoard from './GameBoard'; // <--- IMPORTACIÓN NUEVA

const TeacherDashboard = ({ gameCode, playersData, onReset, connectedCount, globalActivity }) => {
  return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in p-4 font-mono">
      
      {/* --- CABECERA --- */}
      <div className="bg-slate-900 border-2 border-lobo-neion-red rounded-xl p-6 mb-6 shadow-lg text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-600 animate-pulse"></div>
        <h2 className="text-slate-400 text-sm uppercase tracking-widest mb-2 font-bold">SALA ACTIVA</h2>
        <div className="text-5xl md:text-7xl font-black text-white tracking-wider mb-4 select-all cursor-pointer hover:text-red-100 transition-colors">
          {gameCode}
        </div>
        <div className="flex justify-center items-center gap-4 text-sm">
          <span className="bg-slate-800 px-4 py-2 rounded-full border border-slate-700 text-slate-300">
            👥 Alumnos: <span className="text-white font-bold text-lg ml-1">{connectedCount}</span>
          </span>
        </div>
      </div>

      {/* --- GRID DE 3 COLUMNAS (Ajustado) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMNA 1: RANKING (3 cols) */}
        <div className="lg:col-span-3 bg-slate-900/90 border border-slate-700 rounded-xl p-5 h-[600px] overflow-hidden flex flex-col">
          <h3 className="text-lobo-gold font-bold uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">
            📊 Ranking
          </h3>
          <div className="overflow-y-auto flex-1">
             <Leaderboard players={playersData.filter(p => p.nickname !== "HOST_PROFESOR")} />
          </div>
        </div>

        {/* COLUMNA 2: TABLERO VISUAL (6 cols - CENTRO) */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-700 rounded-xl p-2 h-[600px] flex flex-col items-center justify-center relative overflow-hidden">
          
          <h3 className="text-lobo-neon-blue font-bold uppercase tracking-widest mb-2 absolute top-4 left-4 z-10">
            🗺️ Mapa en Vivo
          </h3>

          {/* TABLERO SVG GIGANTE */}
          <div className="scale-125 transform origin-center">
             <GameBoard players={playersData} />
          </div>

          {/* BITÁCORA FLOTANTE SOBRE EL TABLERO */}
          <div className="absolute bottom-4 w-[90%] bg-black/50 p-2 rounded-lg max-h-[150px] overflow-y-auto text-[10px] border border-white/10">
             <p className="text-slate-400 mb-1 font-bold sticky top-0 bg-black/50 w-full">ÚLTIMOS EVENTOS:</p>
             {globalActivity.map((log, i) => (
                <div key={i} className="text-slate-300 mb-1 border-l-2 border-slate-600 pl-2">
                    <span className="text-white font-bold">{log.player}</span> en Casilla {log.position}
                    {log.events && log.events.map((e, j) => (
                        <span key={j} className={`ml-1 ${e.tipo === 'LOBO_NEGRO' ? 'text-red-400' : 'text-blue-400'}`}>
                           [{e.titulo}]
                        </span>
                    ))}
                </div>
             ))}
          </div>
        </div>

        {/* COLUMNA 3: CONTROLES (3 cols) */}
        <div className="lg:col-span-3 bg-slate-900/90 border border-slate-700 rounded-xl p-5 h-[600px] flex flex-col justify-between">
          <div>
            <h3 className="text-red-400 font-bold uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">
              ⚠️ Control
            </h3>
            <div className="bg-slate-800/50 p-4 rounded-lg mb-4 text-xs text-slate-400 leading-relaxed border border-slate-700">
              <p className="mb-2 text-white font-bold">Estado:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>WebSockets: Activos</li>
                <li>Visualización: 3D SVG</li>
                <li>Sonido: Habilitado</li>
              </ul>
            </div>
          </div>
          
          <button onClick={onReset} className="w-full border-2 border-red-600 bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white font-bold py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-3 group">
              <span className="text-2xl group-hover:rotate-12 transition-transform">☢️</span> 
              <span>REINICIAR SALA</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default TeacherDashboard;