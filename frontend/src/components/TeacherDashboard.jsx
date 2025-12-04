// =============================================================================
// 📄 ARCHIVO: src/components/TeacherDashboard.jsx
// 🔍 ROL: Panel de Control exclusivo para el Profesor (Vista Espectador)
// =============================================================================

import React from 'react';
import Leaderboard from './Leaderboard';

const TeacherDashboard = ({ gameCode, playersData, onReset, connectedCount }) => {
  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in p-4">
      
      {/* --- CABECERA DE CONTROL --- */}
      <div className="bg-slate-900 border-2 border-lobo-neion-red rounded-xl p-6 mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)] text-center relative overflow-hidden">
        
        {/* Fondo decorativo animado */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-600 animate-pulse"></div>
        
        <h2 className="text-slate-400 text-sm uppercase tracking-widest mb-2 font-bold">
          SALA DE CLASES ACTIVA
        </h2>
        
        {/* CÓDIGO GIGANTE PARA PROYECTAR */}
        <div className="text-5xl md:text-7xl font-black text-white font-mono tracking-wider mb-4 select-all cursor-pointer hover:text-red-100 transition-colors" title="Click para seleccionar">
          {gameCode}
        </div>
        
        {/* ESTADÍSTICAS RÁPIDAS */}
        <div className="flex justify-center items-center gap-4 text-sm">
          <span className="bg-slate-800 px-4 py-2 rounded-full border border-slate-700 text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Estado: <span className="text-green-400 font-bold">En Línea</span>
          </span>
          <span className="bg-slate-800 px-4 py-2 rounded-full border border-slate-700 text-slate-300">
            👥 Alumnos Conectados: <span className="text-white font-bold text-lg ml-1">{connectedCount}</span>
          </span>
        </div>
      </div>

      {/* --- ÁREA DE MONITOREO --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* COLUMNA 1: RANKING EN VIVO */}
        <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-5 shadow-lg">
          <h3 className="text-lobo-gold font-bold uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
            <span>📊</span> Ranking Tiempo Real
          </h3>
          {/* Reutilizamos el componente Leaderboard existente */}
          <Leaderboard players={playersData} myNickname="HOST_PROFESOR" />
        </div>

        {/* COLUMNA 2: CONTROLES DE PÁNICO Y GESTIÓN */}
        <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-red-400 font-bold uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
              <span>⚠️</span> Control de Misión
            </h3>
            
            <div className="bg-slate-800/50 p-4 rounded-lg mb-4 text-xs text-slate-400 leading-relaxed border border-slate-700">
              <p className="mb-2">
                <strong className="text-white">Instrucciones:</strong>
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Proyecta esta pantalla para que los alumnos vean el código.</li>
                <li>El ranking se actualiza automáticamente cada vez que un alumno lanza los dados.</li>
                <li>Si la clase termina o necesitas reiniciar, usa el botón de abajo.</li>
              </ul>
            </div>
          </div>
          
          <div className="space-y-4 mt-4">
            <button 
              onClick={onReset}
              className="w-full border-2 border-red-600 bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white font-bold py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-3 group shadow-lg"
            >
              <span className="text-2xl group-hover:rotate-12 transition-transform">☢️</span> 
              <span>DETONAR SALA (Reiniciar Todo)</span>
            </button>
            <p className="text-[10px] text-center text-slate-600">
              Esta acción borrará la base de datos y desconectará a todos los alumnos.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TeacherDashboard;