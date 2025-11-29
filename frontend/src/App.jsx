// =============================================================================
// 📄 ARCHIVO: src/App.jsx (VERSIÓN MAESTRA FINAL - CLOUD READY ☁️)
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import FinancialDisplay from './components/FinancialDisplay';

function App() {
  // --- 1. CONFIGURACIÓN DE ENTORNO (CRÍTICO PARA LA NUBE) ---
  // Detectamos la URL del Backend desde el archivo .env o variables de entorno de Vercel
  // Si no existe la variable, usamos localhost como respaldo de seguridad.
  const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  // --- ESTADOS DE LA APLICACIÓN ---
  const [nickname, setNickname] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [jugador, setJugador] = useState(null); 
  const [backendStatus, setBackendStatus] = useState("Conectando...");
  
  // --- ESTADOS DE LA INTERFAZ ---
  const [logs, setLogs] = useState([]); 
  const [isRolling, setIsRolling] = useState(false); 
  
  const ws = useRef(null);

  // ---------------------------------------------------------------------------
  // 🔧 FUNCIONES AUXILIARES
  // ---------------------------------------------------------------------------
  
  const addLog = (text) => {
    setLogs((prev) => [text, ...prev].slice(0, 5));
  };

  // ---------------------------------------------------------------------------
  // 2. HEALTH CHECK (Adaptado a Nube)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Usamos la variable dinámica API_URL
    fetch(`${API_URL}/`)
      .then((res) => {
        if (res.ok) setBackendStatus("En Línea 🟢");
        else setBackendStatus("Error Servidor 🔴");
      })
      .catch(() => setBackendStatus("Desconectado 🔴"));
  }, [API_URL]);

  // ---------------------------------------------------------------------------
  // 3. CONEXIÓN WEBSOCKET (Adaptado a SSL/Nube)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (jugador) {
      // 1. Detectar si estamos en sitio seguro (HTTPS) para usar WSS
      const wsProtocol = API_URL.startsWith("https") ? "wss" : "ws";
      
      // 2. Limpiar la URL (quitar http:// o https://) para quedarnos con el dominio
      const wsBase = API_URL.replace(/^http(s)?:\/\//, '');
      
      // 3. Construir la URL final del socket
      const socket = new WebSocket(`${wsProtocol}://${wsBase}/ws/${jugador._id}`);
      
      socket.onopen = () => {
        addLog("✅ Conexión Neural Establecida");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "UPDATE_PLAYER") {
            addLog(data.message); 
            
            // Actualizar datos SI es mi jugador
            if (data.payload.player_id === jugador._id) {
                setJugador((prev) => ({
                    ...prev, 
                    position: data.payload.new_position,
                    financials: {
                      ...prev.financials,
                      cash: data.payload.new_cash,
                      toxicDebt: data.payload.new_debt,
                      netWorth: data.payload.new_net_worth,
                      passiveIncome: data.payload.new_passive_income // Mantenemos Ingreso Pasivo
                    }
                }));
            }
          } 
          else if (data.type === "CHAT" || data.type === "SYSTEM") {
            addLog(data.message);
          }
          else {
            addLog(JSON.stringify(data));
          }

        } catch (error) {
          console.error("Error socket:", error);
          addLog(event.data);
        }
      };

      socket.onclose = () => {
        addLog("❌ Conexión Cerrada");
      };

      ws.current = socket;

      return () => {
        socket.close();
      };
    }
  }, [jugador, API_URL]); // Se reinicia si cambia el jugador o la URL de la API

  // ---------------------------------------------------------------------------
  // 4. LÓGICA DE REGISTRO (Adaptado a Nube)
  // ---------------------------------------------------------------------------
  const handleRegister = async () => {
    if (!nickname) return;
    setMensaje("Enviando...");
    try {
      // Usamos API_URL dinámica
      const response = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname })
      });
      const data = await response.json();
      if (response.ok) {
        setJugador(data);
        setMensaje("");
      } else {
        setMensaje("Error: " + data.detail); 
      }
    } catch (error) {
      console.error(error);
      setMensaje("Error de conexión");
    }
  };

  // ---------------------------------------------------------------------------
  // 5. ACCIÓN DE JUEGO
  // ---------------------------------------------------------------------------
  const handleDiceRoll = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      addLog("⚠️ Error: Sin conexión al servidor");
      return;
    }

    setIsRolling(true);
    
    setTimeout(() => {
      ws.current.send(`🎲 ${jugador.nickname} ha lanzado los dados...`);
      setIsRolling(false);
    }, 800);
  };

  // ---------------------------------------------------------------------------
  // VISTA
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-lobo-dark text-white p-4 font-mono transition-colors duration-500">
      
      <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden p-8 relative">
        
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-lobo-neion-red via-purple-500 to-lobo-neon-blue"></div>

        <h1 className="text-3xl font-bold mb-6 text-center tracking-tighter">
          LA SENDA <span className="text-lobo-neion-red">DE LOS LOBOS</span>
        </h1>

        {jugador ? (
          <div className="w-full animate-fade-in">
            
            <div className="flex justify-between items-end mb-4 border-b border-slate-800 pb-2">
              <h2 className="text-xl font-bold">Hola, {jugador.nickname}</h2>
              <button className="text-xs text-red-400 underline hover:text-red-300" onClick={() => setJugador(null)}>
                Cerrar Sesión
              </button>
            </div>

            {/* Componente Financiero */}
            <FinancialDisplay financials={jugador.financials} />

            {/* Zona de Dados */}
            <div className="bg-slate-800/50 p-6 rounded-lg border border-dashed border-slate-600 text-center relative overflow-hidden group">
              
              <div className={`text-5xl mb-3 transition-all duration-300 ${isRolling ? "animate-spin opacity-100" : "opacity-30 group-hover:opacity-50"}`}>
                🎲
              </div>

              <p className="text-slate-400 mb-4 text-[10px] uppercase tracking-widest font-bold">
                Casilla Actual
                <br/>
                <span className="text-4xl text-white font-mono transition-all duration-300 inline-block mt-1">
                  {jugador.position}
                </span>
              </p>
              
              <button 
                onClick={handleDiceRoll}
                disabled={isRolling}
                className={`w-full bg-lobo-neon-blue hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform ${isRolling ? "opacity-50 cursor-not-allowed" : "hover:scale-105 active:scale-95"}`}
              >
                {isRolling ? "Calculando..." : "LANZAR DADOS"}
              </button>
            </div>

            {/* Logs del Chat */}
            <div className="mt-4 bg-black rounded p-2 h-24 overflow-hidden border border-slate-800 text-[10px] font-mono text-green-400 shadow-inner">
              {logs.map((log, i) => (
                <div key={i} className="opacity-90 border-b border-white/5 pb-1 mb-1 last:border-0">
                  <span className="text-green-600 mr-2">&gt;</span> 
                  {log}
                </div>
              ))}
            </div>

          </div>
        ) : (
          <div className="space-y-5 animate-fade-in">
             <input 
                type="text" 
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ingresa tu Alias..."
                className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-white placeholder-slate-600 focus:border-lobo-neon-blue outline-none transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
              />
            <button 
              onClick={handleRegister} 
              className="w-full bg-lobo-neion-red hover:bg-red-500 text-white font-bold py-3 rounded-lg shadow-lg transition-transform hover:-translate-y-1"
            >
              INICIAR SESIÓN
            </button>
            {mensaje && <p className="text-center text-xs text-yellow-500 bg-yellow-900/20 p-2 rounded">{mensaje}</p>}
          </div>
        )}

        <div className="mt-8 text-[10px] text-slate-600 text-center flex justify-between border-t border-slate-800 pt-2">
          <span>v3.0 Cloud Ready</span>
          <span className={backendStatus.includes("En Línea") ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{backendStatus}</span>
        </div>
      </div>
    </div>
  );
}

export default App;