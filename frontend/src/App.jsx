// =============================================================================
// 📄 ARCHIVO: src/App.jsx
// 📄 VERSIÓN: 4.5 (MASTER EDITION: Queue + Ranking Fix + Audio FX 🎵)
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';

// Importamos los componentes visuales externos
import FinancialDisplay from './components/FinancialDisplay';
import Leaderboard from './components/Leaderboard'; 
import EventCard from './components/EventCard'; 

// ⬇️⬇️⬇️ NUEVO SISTEMA DE AUDIO (INYECTADO) ⬇️⬇️⬇️
// Definimos los efectos de sonido usando URLs de CDN estables (Google Sounds).
const AUDIO_CLIPS = {
  // 🎲 DADO: Usamos el archivo local de Pixabay que subiste.
  // Al ponerlo en la carpeta 'public', accedemos a él con la barra "/" inicial.
  dice: new Audio("/dice-142528.mp3"),
  cash: new Audio("https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3"), 
  alert: new Audio("https://actions.google.com/sounds/v1/cartoon/cartoon_cowbell.ogg"), 
  victory: new Audio("https://cdn.pixabay.com/audio/2021/08/04/audio_12b0c7443c.mp3") 
};

// Función auxiliar para reproducir sonido de forma segura (evita errores de autoplay)
const playSound = (key) => {
  try {
    const sound = AUDIO_CLIPS[key];
    if (sound) {
      sound.currentTime = 0; // Reinicia el audio si ya estaba sonando (para repeticiones rápidas)
      sound.volume = 0.4;    // Volumen moderado
      sound.play().catch(e => console.warn("Audio autoplay bloqueado por el navegador", e));
    }
  } catch (e) { console.error(e); }
};
// ⬆️⬆️⬆️ FIN DEL SISTEMA DE AUDIO ⬆️⬆️⬆️

// -----------------------------------------------------------------------------
// 🏆 COMPONENTE INTERNO: PANTALLA DE VICTORIA
// -----------------------------------------------------------------------------
const VictoryScreen = ({ nickname, onReset }) => (
  <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-50 animate-fade-in p-4 backdrop-blur-sm">
    <div className="text-8xl mb-6 animate-bounce">🏆</div>
    <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-500 to-yellow-600 text-center mb-6 drop-shadow-lg">
      ¡LIBERTAD FINANCIERA!
    </h1>
    <p className="text-xl md:text-2xl text-slate-300 mb-10 text-center max-w-2xl leading-relaxed">
      El agente <span className="font-bold text-yellow-400">{nickname}</span> ha escapado de la "Carrera de la Rata".
      <br/>
      Sus activos ahora pagan su estilo de vida.
    </p>
    <button 
      onClick={onReset}
      className="bg-white text-black font-bold py-4 px-10 rounded-full hover:bg-yellow-400 transition-all transform hover:scale-110 shadow-[0_0_30px_rgba(255,215,0,0.6)]"
    >
      Jugar Nueva Partida
    </button>
  </div>
);

function App() {
  const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  // --- ESTADOS ---
  const [nickname, setNickname] = useState("");
  const [jugador, setJugador] = useState(null); 
  const [leaderboard, setLeaderboard] = useState([]); 
  const [winner, setWinner] = useState(false);        
  const [logs, setLogs] = useState([]);               
  const [isRolling, setIsRolling] = useState(false);  
  
  // Mantenemos 'cardQueue' (Sistema moderno) en lugar de 'currentCard'
  const [cardQueue, setCardQueue] = useState([]); 

  const [mensaje, setMensaje] = useState("");
  const [backendStatus, setBackendStatus] = useState("Conectando...");
  
  const ws = useRef(null);

  // --- FUNCIONES AUXILIARES ---
  const addLog = (text) => {
    setLogs((prev) => [text, ...prev].slice(0, 5));
  };

  const resetGame = () => {
    setJugador(null);
    setWinner(false);
    setNickname("");
    setLogs([]);
    setMensaje("");
    setLeaderboard([]);
    setCardQueue([]); 
    if (ws.current) ws.current.close();
  };

  // --- HEALTH CHECK ---
  useEffect(() => {
    fetch(`${API_URL}/`)
      .then((res) => {
        if (res.ok) setBackendStatus("En Línea 🟢");
        else setBackendStatus("Error Servidor 🔴");
      })
      .catch(() => setBackendStatus("Desconectado 🔴"));
  }, [API_URL]);

  // --- MOTOR WEBSOCKET ---
  useEffect(() => {
    if (jugador) {
      // Blindaje de ID: Usa jugador.id o jugador._id según disponibilidad
      const idJugador = jugador.id || jugador._id;
      
      const wsProtocol = API_URL.startsWith("https") ? "wss" : "ws";
      const wsBase = API_URL.replace(/^http(s)?:\/\//, ''); 
      const socket = new WebSocket(`${wsProtocol}://${wsBase}/ws/${idJugador}`);
      
      socket.onopen = () => {
        addLog("✅ Conexión Neural Establecida");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          const updateData = () => {
             // Verificamos ID (Soporta ambos formatos de ID por seguridad)
             if (data.payload.player_id === jugador._id || data.payload.player_id === jugador.id) {
                
                setJugador((prev) => ({
                    ...prev, 
                    position: data.payload.new_position,
                    financials: {
                      ...prev.financials,
                      cash: data.payload.new_cash,
                      toxicDebt: data.payload.new_debt,
                      netWorth: data.payload.new_net_worth, 
                      passiveIncome: data.payload.new_passive_income 
                    }
                }));

                // Lógica de Cola de Eventos + AUDIO FX
                if (data.payload.event_queue && data.payload.event_queue.length > 0) {
                    
                    // 1. Actualizar Cola Visual
                    setCardQueue((prevQueue) => {
                        return [...prevQueue, ...data.payload.event_queue];
                    });

                    // ⬇️⬇️⬇️ 2. DETONADORES DE AUDIO (NUEVO) ⬇️⬇️⬇️
                    // Analizamos los eventos que llegaron para tocar el sonido correcto.
                    const incomingEvents = data.payload.event_queue;
                    
                    // ¿Hay dinero entrando? (Payday o Inversión)
                    const hasMoney = incomingEvents.some(e => e.tipo === "PAYDAY" || e.tipo === "LOBO_BLANCO");
                    // ¿Hay problemas? (Lobo Negro)
                    const hasTrouble = incomingEvents.some(e => e.tipo === "LOBO_NEGRO");

                    if (hasMoney) playSound("cash");
                    else if (hasTrouble) playSound("alert");
                    // ⬆️⬆️⬆️ FIN DETONADORES DE AUDIO ⬆️⬆️⬆️
                }
            }
          };

          if (data.type === "UPDATE_PLAYER") {
            addLog(data.message); 
            updateData(); 
          }
          else if (data.type === "LEADERBOARD") {
            setLeaderboard(data.payload);
          } 
          else if (data.type === "VICTORY") {
            addLog(data.message);
            updateData(); 
            if (data.payload.player_id === jugador._id || data.payload.player_id === jugador.id) {
                setWinner(true);
                playSound("victory"); // <--- SONIDO DE VICTORIA
            }
          }
          else if (data.type === "CHAT" || data.type === "SYSTEM") {
            addLog(data.message);
          }

        } catch (error) {
          console.error("Error procesando mensaje:", error);
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
  }, [jugador, API_URL]); 

  // --- REGISTRO Y DADOS ---
  const handleRegister = async () => {
    if (!nickname) return;
    setMensaje("Enviando solicitud...");
    try {
      const response = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname })
      });
      const data = await response.json();
      if (response.ok) {
        setJugador(data); 
        setMensaje("");
        setWinner(false);
      } else {
        setMensaje("Error: " + data.detail); 
      }
    } catch (error) {
      console.error(error);
      setMensaje("Error de conexión con la API");
    }
  };

  const handleDiceRoll = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      addLog("⚠️ Error: Sin conexión al servidor");
      return;
    }
    setIsRolling(true);
    playSound("dice"); // <--- SONIDO DE DADOS AL CLICAR
    
    setTimeout(() => {
      ws.current.send(`🎲 ${jugador.nickname} ha lanzado los dados...`);
      setIsRolling(false);
    }, 800);
  };

  // ===========================================================================
  // LOGICA DE FUSIÓN (SMART MERGE FIX PARA RANKING)
  // ===========================================================================
  const leaderboardFusionado = leaderboard.map((item) => {
    if (jugador && item.nickname === jugador.nickname) {
        return {
            ...item,
            net_worth: jugador.financials.netWorth 
        };
    }
    return item;
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-lobo-dark text-white p-4 font-mono transition-colors duration-500 relative">
      
      {winner && <VictoryScreen nickname={jugador?.nickname} onReset={resetGame} />}

      {/* Renderizado de Cola de Eventos */}
      {cardQueue.length > 0 && (
        <EventCard 
          eventData={cardQueue[0]} 
          onClose={() => {
            setCardQueue((prev) => prev.slice(1));
          }} 
        />
      )}

      <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden p-8 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-lobo-neion-red via-purple-500 to-lobo-neon-blue"></div>
        <h1 className="text-3xl font-bold mb-6 text-center tracking-tighter">
          LA SENDA <span className="text-lobo-neion-red">DE LOS LOBOS</span>
        </h1>

        {jugador ? (
          <div className="w-full animate-fade-in">
            <div className="flex justify-between items-end mb-4 border-b border-slate-800 pb-2">
              <h2 className="text-xl font-bold">Hola, {jugador.nickname}</h2>
              <button className="text-xs text-red-400 underline hover:text-red-300" onClick={resetGame}>Cerrar Sesión</button>
            </div>

            <FinancialDisplay financials={jugador.financials} />

            {/* Ranking Fusionado */}
            <Leaderboard players={leaderboardFusionado} myNickname={jugador.nickname} />

            <div className="mt-4 bg-slate-800/50 p-6 rounded-lg border border-dashed border-slate-600 text-center relative overflow-hidden group">
              <div className={`text-5xl mb-3 transition-all duration-300 ${isRolling ? "animate-spin opacity-100" : "opacity-30 group-hover:opacity-50"}`}>🎲</div>
              <p className="text-slate-400 mb-4 text-[10px] uppercase tracking-widest font-bold">
                Casilla Actual<br/>
                <span className="text-4xl text-white font-mono transition-all duration-300 inline-block mt-1">{jugador.position}</span>
              </p>
              <button 
                onClick={handleDiceRoll}
                disabled={isRolling}
                className={`w-full bg-lobo-neon-blue hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform ${isRolling ? "opacity-50 cursor-not-allowed" : "hover:scale-105 active:scale-95"}`}
              >
                {isRolling ? "Calculando..." : "LANZAR DADOS"}
              </button>
            </div>

            <div className="mt-4 bg-black rounded p-2 h-24 overflow-hidden border border-slate-800 text-[10px] font-mono text-green-400 shadow-inner">
              {logs.map((log, i) => (
                <div key={i} className="opacity-90 border-b border-white/5 pb-1 mb-1 last:border-0">
                  <span className="text-green-600 mr-2">&gt;</span> {log}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5 animate-fade-in">
             <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Ingresa tu Alias..." className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-white placeholder-slate-600 focus:border-lobo-neon-blue outline-none transition-colors" onKeyDown={(e) => e.key === 'Enter' && handleRegister()} />
            <button onClick={handleRegister} className="w-full bg-lobo-neion-red hover:bg-red-500 text-white font-bold py-3 rounded-lg shadow-lg transition-transform hover:-translate-y-1">INICIAR SESIÓN</button>
            {mensaje && <p className="text-center text-xs text-yellow-500 bg-yellow-900/20 p-2 rounded">{mensaje}</p>}
          </div>
        )}

        <div className="mt-8 text-[10px] text-slate-600 text-center flex justify-between border-t border-slate-800 pt-2">
          <span>v4.5 Master (Audio+Queue)</span>
          <span className={backendStatus.includes("En Línea") ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{backendStatus}</span>
        </div>
      </div>
    </div>
  );
}

export default App;