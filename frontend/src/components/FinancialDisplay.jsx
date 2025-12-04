import React from 'react';

const formatMoney = (amount) => {
  const value = parseFloat(amount);
  if (isNaN(value)) return "$0.00";
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

// AHORA RECIBE LA PROP: target (La meta del juego)
const FinancialDisplay = ({ financials, target }) => {
  if (!financials) {
    return (
      <div className="p-4 bg-slate-800 rounded border border-yellow-500 text-yellow-500 text-center animate-pulse text-xs">
        ⚡ Sincronizando...
      </div>
    );
  }

  const cash = parseFloat(financials.cash || 0);
  const netWorth = parseFloat(financials.netWorth || 0);
  const toxicDebt = parseFloat(financials.toxicDebt || 0);
  const passiveIncome = parseFloat(financials.passiveIncome || 0);
  const goal = parseFloat(target || 1000000);

  // Cálculo de progreso hacia la meta
  const progress = Math.min(Math.max((netWorth / goal) * 100, 0), 100);

  const isDanger = toxicDebt > cash;
  const containerClass = isDanger 
    ? "border-lobo-neion-red shadow-[0_0_15px_rgba(239,68,68,0.2)]" 
    : "border-lobo-neon-blue shadow-[0_0_15px_rgba(59,130,246,0.2)]";

  return (
    <div className={`mb-6 p-4 rounded-xl bg-slate-900 border ${containerClass} transition-all duration-500`}>
      <div className="grid grid-cols-1 gap-3">
        
        {/* BARRA DE PROGRESO DE VICTORIA */}
        <div className="bg-slate-950 rounded-full h-2 w-full overflow-hidden mb-2 border border-slate-700">
            <div 
                className="h-full bg-gradient-to-r from-blue-500 to-green-400 transition-all duration-1000" 
                style={{ width: `${progress}%` }}
            ></div>
        </div>
        <p className="text-[10px] text-center text-slate-400 -mt-2">
            META: {formatMoney(goal)} ({progress.toFixed(1)}%)
        </p>

        {/* 1. EFECTIVO */}
        <div className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center border border-slate-700/30">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Efectivo</p>
          <p className="text-xl font-bold text-lobo-gold font-mono break-words text-right">{formatMoney(cash)}</p>
        </div>

        {/* 2. INGRESO PASIVO */}
        <div className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center border border-slate-700/30">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Ingreso Pasivo</p>
          <p className="text-xl font-bold text-green-400 font-mono break-words text-right">+{formatMoney(passiveIncome)}</p>
        </div>

        {/* 3. PATRIMONIO */}
        <div className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center border border-slate-700/30">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Patrimonio</p>
          <p className={`text-xl font-bold font-mono break-words text-right ${netWorth >= goal ? 'text-green-400 animate-pulse' : 'text-white'}`}>
            {formatMoney(netWorth)}
          </p>
        </div>

        {/* 4. DEUDA */}
        <div className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center relative overflow-hidden border border-slate-700/30">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Deuda</p>
          <p className={`text-xl font-bold font-mono break-words text-right ${toxicDebt > 0 ? 'text-lobo-neion-red' : 'text-slate-500'}`}>
            {formatMoney(toxicDebt)}
          </p>
          {toxicDebt > 0 && <div className="absolute top-0 right-0 w-2 h-full bg-red-500/20 border-l border-red-500"></div>}
        </div>

      </div>
    </div>
  );
};

export default FinancialDisplay;