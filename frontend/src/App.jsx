// =============================================================================
// 📄 ARCHIVO: src/App.jsx
// 📄 VERSIÓN: 8.4 (FIX: LOGS HISTORY & ROOM ID)
// 📝 DESCRIPCIÓN: Controlador principal. Se corrigen la visualización de la
//    sala en la vista de estudiante y la actualización del historial de texto.
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';

// --- IMPORTACIÓN DE COMPONENTES VISUALES ---
import FinancialDisplay from './components/FinancialDisplay';
import Leaderboard from './components/Leaderboard';
import EventCard from './components/EventCard';
import TeacherDashboard from './components/TeacherDashboard'; 

// -----------------------------------------------------------------------------
// 🔊 SISTEMA DE AUDIO
// -----------------------------------------------------------------------------
const AUDIO_CLIPS = {
  dice: new Audio("/dice-142528.mp3"), 
  cash: new Audio("https://actions.google.com/sounds/v1/cartoon/clinking_coins.ogg"), 
  alert: new Audio("https://actions.google.com/sounds/v1/cartoon/cartoon_cowbell.ogg"), 
  victory: new Audio("https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg") 
};

// Función auxiliar para reproducción segura
const playSound = (key) => {
  try {
    const sound = AUDIO_CLIPS[key];
    if (sound) { 
      sound.currentTime = 0; 
      sound.volume = 0.5; 
      sound.play().catch(() => {}); 
    }
  } catch (error) { 
    console.error("Error crítico en sistema de audio:", error); 
  }
};

// -----------------------------------------------------------------------------
// 🏆 COMPONENTE: PANTALLA DE VICTORIA
// -----------------------------------------------------------------------------
const VictoryScreen = ({ nickname, onReset }) => (
  <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 animate-fade-in p-4 backdrop-blur-sm">
    <div className="text-6xl mb-4 animate-bounce">🏆</div>
    <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 text-center mb-4">
      ¡LIBERTAD FINANCIERA!
    </h1>
    <p className="text-xl text-white mb-8 text-center">
      <span className="font-bold text-yellow-400">{nickname}</span> ha ganado el juego.
    </p>
    <button onClick={onReset} className="bg-white text-black font-bold py-3 px-8 rounded-full hover:bg-yellow-400 shadow-lg transition-transform hover:scale-105">
        Reiniciar Partida
    </button>
  </div>
);

// =============================================================================
// ⚛️ COMPONENTE PRINCIPAL APP
// =============================================================================
function App() {
  const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  // ---------------------------------------------------------------------------
  // 1. ESTADOS (STATE)
  // ---------------------------------------------------------------------------
  const [gameCode, setGameCode] = useState(""); 
  const [nickname, setNickname] = useState(""); 
  const [role, setRole] = useState(null);       
  const [jugador, setJugador] = useState(null); 
  
  const [leaderboard, setLeaderboard] = useState([]); 
  const [globalActivity, setGlobalActivity] = useState([]); 
  
  const [configSalary, setConfigSalary] = useState("2500");
  const [configGoal, setConfigGoal] = useState("1000000");
  const [gameTarget, setGameTarget] = useState("1000000"); 

  const [mensaje, setMensaje] = useState("");   
  const [backendStatus, setBackendStatus] = useState("Conectando..."); 
  
  const [logs, setLog] = useState(["Esperando inicio..."]); 
  const [cardQueue, setCardQueue] = useState([]); 
  const [isRolling, setIsRolling] = useState(false); 
  const [lastDice, setLastDice] = useState(null);    
  const [winner, setWinner] = useState(false);       
  
  const [isTeacherDashboard, setIsTeacherDashboard] = useState(false);
  const [wsStatus, setWsStatus] = useState("⚪"); 

  const ws = useRef(null);
  const isTeacherRef = useRef(isTeacherDashboard);
  const gameCodeRef = useRef(gameCode);

  useEffect(() => { isTeacherRef.current = isTeacherDashboard; }, [isTeacherDashboard]);
  useEffect(() => { gameCodeRef.current = gameCode; }, [gameCode]);

  // Helper para añadir logs al historial local
  const addLog = (msg) => setLog(prev => [...prev.slice(-4), msg]);

  // ---------------------------------------------------------------------------
  // 2. EFECTOS (SIDE EFFECTS)
  // ---------------------------------------------------------------------------

  // Health Check
  useEffect(() => {
    fetch(`${API_URL}/`)
      .then(() => setBackendStatus("En Línea 🟢")) 
      .catch(() => setBackendStatus("Offline 🔴"));
  }, [API_URL]);

  // MOTOR WEBSOCKET
  useEffect(() => {
    if (!jugador) return;

    const idJugador = jugador.id || jugador._id;
    const protocol = API_URL.startsWith("https") ? "wss" : "ws";
    const host = API_URL.replace(/^http(s)?:\/\//, '').replace(/\/$/, "");
    const url = `${protocol}://${host}/ws/${idJugador}`;

    if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

    setWsStatus("🟡");
    const socket = new WebSocket(url);

    socket.onopen = () => setWsStatus("🟢");
    
    socket.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            
            // CASO: ACTUALIZACIÓN DE JUGADOR
            if (data.type === "UPDATE_PLAYER") {
                const payload = data.payload;
                
                // 🛠️ CORRECCIÓN QUIRÚRGICA 1: ACTUALIZACIÓN DEL LOG
                // Antes esto estaba solo en el 'else' o no existía para el propio jugador.
                // Ahora lo ejecutamos siempre para que el historial se mueva.
                addLog(data.message); 

                // Lógica Profesor
                if (payload.event_queue && payload.event_queue.length > 0) {
                    setGlobalActivity(prev => [{
                        player: payload.nickname || "Jugador",
                        position: payload.new_position,
                        events: payload.event_queue
                    }, ...prev].slice(0, 20)); 
                }

                // Lógica Alumno (Si soy yo)
                if (payload.player_id === idJugador) {
                    setJugador(prev => ({ 
                        ...prev, 
                        ...payload, 
                        position: payload.new_position, 
                        financials: { 
                            cash: payload.new_cash,
                            netWorth: payload.new_net_worth,
                            toxicDebt: payload.new_debt,
                            passiveIncome: payload.new_passive_income
                        }
                    }));
                    
                    if (payload.game_target) setGameTarget(payload.game_target);
                    if (payload.dice_value) setLastDice(payload.dice_value);

                    if (payload.event_queue?.length) {
                        setCardQueue(prev => [...prev, ...payload.event_queue]);
                        if (!isTeacherRef.current) {
                            const evts = payload.event_queue;
                            if (evts.some(ev => ev.tipo === "LOBO_NEGRO")) playSound("alert");
                            else playSound("cash");
                        }
                    }
                }
            } 
            else if (data.type === "LEADERBOARD") {
                setLeaderboard(data.payload);
            } 
            else if (data.type === "VICTORY") {
                addLog(data.message);
                if (data.payload?.player_id === idJugador && !isTeacherRef.current) {
                    setWinner(true);
                    playSound("victory");
                }
            }
            // Mensajes de chat o sistema
            else if (data.type === "CHAT" || data.type === "SYSTEM") {
                addLog(data.message);
            }

        } catch (err) { console.error(err); }
    };

    socket.onclose = (evt) => {
        setWsStatus("🔴");
        if (evt.code === 1008) {
            alert("Sesión inválida.");
            setJugador(null);
            setRole(null);
        }
    };

    ws.current = socket;
    return () => { if (ws.current) ws.current.close(); };
  }, [jugador, API_URL]); 

  // ---------------------------------------------------------------------------
  // 3. HANDLERS
  // ---------------------------------------------------------------------------
  const handleRegister = async () => {
      if(!nickname || !gameCode) return setMensaje("Faltan datos");
      setMensaje("Conectando...");
      try {
          const res = await fetch(`${API_URL}/players`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ nickname, game_code: gameCode })
          });
          const data = await res.json();
          if(!res.ok) throw new Error(data.detail);
          setJugador(data);
          setIsTeacherDashboard(false);
          setMensaje("");
      } catch(e) { setMensaje(e.message); }
  };

  const handleCreateSession = async () => {
      if(!gameCode) return setMensaje("Falta Código");
      setMensaje("Creando...");
      try {
          const res1 = await fetch(`${API_URL}/sessions`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ code: gameCode, salary: Number(configSalary), winning_score: Number(configGoal) })
          });
          if(!res1.ok) throw new Error((await res1.json()).detail);
          
          const res2 = await fetch(`${API_URL}/players`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ nickname: "HOST_PROFESOR", game_code: gameCode })
          });
          const data = await res2.json();
          if(!res2.ok) throw new Error(data.detail);
          
          setJugador(data);
          setIsTeacherDashboard(true);
          setMensaje("");
      } catch(e) { setMensaje(e.message); }
  };

  const lanzarDados = () => {
      if(ws.current?.readyState === WebSocket.OPEN) {
          setIsRolling(true);
          playSound("dice");
          ws.current.send("lanzado los dados");
          setTimeout(() => setIsRolling(false), 800);
      }
  };

  const resetGame = () => {
      if(ws.current) ws.current.close();
      setJugador(null);
      setWinner(false);
      setGlobalActivity([]);
      setIsTeacherDashboard(false);
  };

  const handleGlobalReset = async () => {
      if(confirm("¿Borrar DB?")) {
          await fetch(`${API_URL}/reset_game`, {method: 'DELETE'});
          window.location.reload();
      }
  };

  // ---------------------------------------------------------------------------
  // 4. RENDERIZADO
  // ---------------------------------------------------------------------------
  
  if (jugador && isTeacherDashboard) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-6">
            <TeacherDashboard 
                gameCode={gameCode} 
                playersData={leaderboard} 
                onReset={handleGlobalReset} 
                connectedCount={leaderboard.length - 1} 
                globalActivity={globalActivity} 
            />
        </div>
      );
  }

  if (jugador && !isTeacherDashboard) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 font-mono">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            {winner && <VictoryScreen nickname={jugador.nickname} onReset={resetGame} />}
            {cardQueue.length > 0 && <EventCard eventData={cardQueue[0]} onClose={() => setCardQueue(prev => prev.slice(1))} />}

            <div className="lg:col-span-4 space-y-4">
                <div className="bg-slate-800 p-4 rounded-xl border-l-4 border-lobo-neion-red flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">🐺 {jugador.nickname}</h2>
                        
                        {/* 🛠️ CORRECCIÓN QUIRÚRGICA 2: VISUALIZACIÓN DE SALA */}
                        <p className="text-xs text-lobo-neon-blue font-bold mt-1">
                            SALA: <span className="text-white tracking-wider">{gameCode}</span>
                        </p>
                        
                        <p className="text-[10px] text-slate-500 mt-1">
                            Estado: {wsStatus}
                        </p>
                    </div>
                    <button onClick={resetGame} className="text-xs text-red-400 hover:text-white underline">Salir</button>
                </div>
                
                <FinancialDisplay financials={jugador.financials} target={gameTarget} />
                
                {/* CAJA DE LOGS / HISTORIAL */}
                <div className="bg-slate-800 p-4 rounded-xl h-48 overflow-y-auto text-xs font-mono border border-slate-700">
                   <p className="text-slate-500 border-b border-slate-700 pb-1 mb-1 font-bold">HISTORIAL DE JUEGO</p>
                   <div className="flex flex-col gap-1">
                       {logs.map((l, i) => (
                           <p key={i} className="text-slate-300 border-l-2 border-slate-600 pl-2">
                               {l}
                           </p>
                       ))}
                   </div>
                </div>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="bg-slate-800 p-6 rounded-xl min-h-[300px] flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="text-center z-10">
                        {lastDice && (
                            <div className="text-3xl text-yellow-400 font-black mb-4 animate-bounce drop-shadow-md">
                                🎲 {lastDice}
                            </div>
                        )}
                        <h1 className="text-7xl font-black text-white">{jugador.position}</h1>
                        <p className="text-lobo-neion-red font-bold text-sm tracking-widest mt-2">CASILLA ACTUAL</p>
                    </div>
                </div>
                <button 
                    onClick={lanzarDados} 
                    disabled={isRolling || wsStatus.includes("🔴")} 
                    className={`w-full bg-lobo-neion-red hover:bg-red-600 py-6 rounded-xl font-black text-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {isRolling ? "🎲 RODANDO..." : "LANZAR DADOS"}
                </button>
            </div>

            <div className="lg:col-span-3">
                <Leaderboard players={leaderboard.filter(p => p.nickname !== "HOST_PROFESOR")} myNickname={jugador.nickname} />
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
        <h1 className="text-4xl font-black text-center text-white mb-8">
            LA SENDA <span className="text-lobo-neion-red">DE LOS LOBOS</span>
        </h1>
        
        <p className="text-center text-slate-500 mb-4 text-xs">
            Estado API: {backendStatus}
        </p>
        
        {!role ? (
          <div className="grid grid-cols-2 gap-4">
             <button onClick={() => setRole('STUDENT')} className="bg-slate-800 hover:bg-slate-700 p-6 rounded-xl border border-slate-700 text-white font-bold transition-all hover:scale-105">
                🎓 ESTUDIANTE
             </button>
             <button onClick={() => setRole('PROFESSOR')} className="bg-slate-800 hover:bg-slate-700 p-6 rounded-xl border border-slate-700 text-white font-bold transition-all hover:scale-105">
                👨‍🏫 PROFESOR
             </button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <button onClick={() => setRole(null)} className="text-xs text-slate-500 mb-2 hover:text-white">← Volver</button>
            
            {role === 'STUDENT' ? (
                  <>
                    <input type="text" value={gameCode} onChange={(e) => setGameCode(e.target.value.toUpperCase())} placeholder="CÓDIGO SALA" className="w-full bg-slate-800 p-3 rounded text-white border border-slate-600 focus:border-lobo-neion-blue outline-none uppercase"/>
                    <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="APODO" className="w-full bg-slate-800 p-3 rounded text-white border border-slate-600 focus:border-lobo-neion-blue outline-none"/>
                    <button onClick={handleRegister} className="w-full bg-lobo-neon-blue py-3 rounded font-bold text-white shadow-lg hover:bg-blue-600 transition-colors">
                        ENTRAR AHORA
                    </button>
                  </>
              ) : (
                  <>
                    <div className="bg-slate-800 p-3 rounded text-xs text-slate-400 mb-2">
                        <p className="font-bold text-white mb-1">Configuración de la Partida</p>
                        Define las reglas económicas para esta sesión.
                    </div>
                    <input type="text" value={gameCode} onChange={(e) => setGameCode(e.target.value.toUpperCase())} placeholder="NUEVO CÓDIGO DE SALA" className="w-full bg-slate-800 p-3 rounded text-white border border-slate-600 focus:border-lobo-neion-red outline-none uppercase"/>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-[10px] text-slate-400 ml-1">Salario por turno</label>
                            <input type="number" value={configSalary} onChange={(e) => setConfigSalary(e.target.value)} className="w-full bg-slate-800 p-2 rounded text-white border border-slate-600 focus:border-lobo-neion-red outline-none"/>
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] text-slate-400 ml-1">Meta para ganar (Patrimonio)</label>
                            <input type="number" value={configGoal} onChange={(e) => setConfigGoal(e.target.value)} className="w-full bg-slate-800 p-2 rounded text-white border border-slate-600 focus:border-lobo-neion-red outline-none"/>
                        </div>
                    </div>
                    <button onClick={handleCreateSession} className="w-full bg-lobo-neion-red py-3 rounded font-bold text-white shadow-lg hover:bg-red-600 transition-colors">
                        CREAR SALA
                    </button>
                  </>
              )}
            {mensaje && <p className="text-center text-xs text-yellow-500 mt-2 bg-yellow-900/20 p-2 rounded">{mensaje}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;