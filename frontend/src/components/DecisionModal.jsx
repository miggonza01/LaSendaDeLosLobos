// =============================================================================
// 📄 ARCHIVO: src/components/DecisionModal.jsx
// 📝 DESCRIPCIÓN: Modal que obliga al jugador a tomar una decisión financiera.
//    Aparece cuando el servidor envía el evento "DECISION_NEEDED".
// =============================================================================

import React from 'react';

const DecisionModal = ({ eventData, onBuy, onPass }) => {
  if (!eventData) return null;

  const { titulo, descripcion, costo, flujo_extra } = eventData;

  return (
    // Fondo oscuro semi-transparente que bloquea la interacción con el fondo
    <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-50 animate-fade-in p-4 backdrop-blur-md">
      
      <div className="bg-slate-900 border-2 border-lobo-neon-blue rounded-2xl p-6 max-w-md w-full shadow-[0_0_50px_rgba(59,130,246,0.3)] relative overflow-hidden">
        
        {/* Decoración superior */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-400 to-blue-600 animate-pulse"></div>

        <div className="text-center mb-6">
          <div className="text-6xl mb-2">🚀</div>
          <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-2">
            OPORTUNIDAD DE INVERSIÓN
          </h2>
          <p className="text-slate-300 text-sm font-mono leading-relaxed">
            {descripcion}
          </p>
        </div>

        {/* Detalles Financieros */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-800 p-3 rounded-lg text-center border border-slate-700">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">COSTO INICIAL</p>
            <p className="text-xl font-bold text-red-400 font-mono">-${costo}</p>
          </div>
          <div className="bg-slate-800 p-3 rounded-lg text-center border border-slate-700">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">FLUJO MENSUAL</p>
            <p className="text-xl font-bold text-green-400 font-mono">+${flujo_extra}</p>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-col gap-3">
          <button 
            onClick={onBuy}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <span>💰</span> COMPRAR ACTIVO
          </button>
          
          <button 
            onClick={onPass}
            className="w-full bg-transparent border border-slate-600 text-slate-400 hover:text-white hover:border-white font-bold py-3 rounded-xl transition-colors"
          >
            PASAR (NO COMPRAR)
          </button>
        </div>

      </div>
    </div>
  );
};

export default DecisionModal;