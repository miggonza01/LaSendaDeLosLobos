import React from 'react';
import Leaderboard from './Leaderboard';

const TeacherDashboard = ({ gameCode, playersData, onReset, connectedCount, globalActivity }) => {
  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in p-4 font-mono">
      
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

      {/* --- GRID DE 3 COLUMNAS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA 1: RANKING */}
        <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-5 h-[500px] overflow-hidden flex flex-col">
          <h3 className="text-lobo-gold font-bold uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">
            📊 Ranking
          </h3>
          <div className="overflow-y-auto flex-1">
             <Leaderboard players={playersData} myNickname="HOST_PROFESOR" />
          </div>
        </div>

        {/* COLUMNA 2: BITÁCORA DE JUGADAS (NUEVO) */}
        <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-5 h-[500px] overflow-hidden flex flex-col">
          <h3 className="text-blue-400 font-bold uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">
            📜 Actividad en Vivo
          </h3>
          <div className="overflow-y-auto flex-1 space-y-2 pr-2">
            {globalActivity.length === 0 ? (
                <p className="text-slate-600 text-center text-xs mt-10">Esperando lanzamientos...</p>
            ) : (
                globalActivity.map((log, i) => (
                    <div key={i} className="bg-slate-800 p-3 rounded border-l-2 border-slate-600 text-xs">
                        <div className="flex justify-between mb-1">
                            <span className="font-bold text-white">{log.player}</span>
                            <span className="text-slate-400">Casilla {log.position}</span>
                        </div>
                        {log.events && log.events.map((e, j) => (
                            <div key={j} className={`mt-1 pl-2 border-l-2 ${
                                e.tipo === 'LOBO_NEGRO' ? 'border-red-500 text-red-300' : 
                                e.tipo === 'LOBO_BLANCO' ? 'border-blue-500 text-blue-300' : 
                                'border-green-500 text-green-300'
                            }`}>
                                <span className="font-bold">{e.titulo}:</span> {e.monto}
                            </div>
                        ))}
                    </div>
                ))
            )}
          </div>
        </div>

        {/* COLUMNA 3: CONTROLES */}
        <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-5 h-[500px] flex flex-col justify-between">
          <div>
            <h3 className="text-red-400 font-bold uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">
              ⚠️ Control
            </h3>
            <div className="bg-slate-800/50 p-4 rounded-lg mb-4 text-xs text-slate-400 leading-relaxed border border-slate-700">
              <p className="mb-2 text-white font-bold">Estado del Servidor:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>WebSockets: Activos</li>
                <li>Eventos: Registrando</li>
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