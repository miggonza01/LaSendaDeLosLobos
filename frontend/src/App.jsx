// =============================================================================
// 📄 ARCHIVO: src/App.jsx
// 📄 VERSIÓN: 7.1 (FIX: ACTUALIZACIÓN DE POSICIÓN VISUAL)
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import FinancialDisplay from './components/FinancialDisplay';
import Leaderboard from './components/Leaderboard';
import EventCard from './components/EventCard';
// Mantenemos la importación opcional.
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

const playSound = (key) => {
  try {
    const sound = AUDIO_CLIPS[key];
    if (sound) { 
      sound.currentTime = 0; 
      sound.volume = 0.5; 
      sound.play().catch(() => {}); 
    }
  } catch (error) { console.error("Error audio:", error); }
};

// -----------------------------------------------------------------------------
// 🏆 PANTALLA DE VICTORIA
// -----------------------------------------------------------------------------
const VictoryScreen = ({ nickname, onReset }) => (
  <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 animate-fade-in p-4 backdrop-blur-sm">
    <div className="text-6xl mb-4 animate-bounce">🏆</div>
    <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 text-center mb-4">
      ¡LIBERTAD FINANCIERA!
    </h1>
    <p className="text-xl text-white mb-8 text-center">
      <span className="font-bold text-yellow-400">{nickname}</span> ha ganado.
    </p>
    <button onClick={onReset} className="bg-white text-black font-bold py-3 px-8 rounded-full hover:bg-yellow-400 transition-colors shadow-lg">Reiniciar</button>
  </div>
);

// =============================================================================
// ⚛️ COMPONENTE PRINCIPAL APP
// =============================================================================
function App() {
  const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  // --- ESTADOS ---
  const [gameCode, setGameCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [jugador, setJugador] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [role, setRole] = useState(null); 
  const [isTeacherDashboard, setIsTeacherDashboard] = useState(false);

  const [leaderboard, setLeaderboard] = useState([]);
  const [logs, setLog] = useState(["Esperando inicio..."]);
  const [configSalary, setConfigSalary] = useState("2500");
  const [configGoal, setConfigGoal] = useState("1000000");
  const [cardQueue, setCardQueue] = useState([]); 
  const [isRolling, setIsRolling] = useState(false);
  const [winner, setWinner] = useState(false);

  const [wsStatus, setWsStatus] = useState("Espera ⚪");
  const [debugInfo, setDebugInfo] = useState(""); 

  const ws = useRef(null);
  const isTeacherRef = useRef(isTeacherDashboard);
  const gameCodeRef = useRef(gameCode);

  useEffect(() => { isTeacherRef.current = isTeacherDashboard; }, [isTeacherDashboard]);
  useEffect(() => { gameCodeRef.current = gameCode; }, [gameCode]);

  const addLog = (msg) => setLog(prev => [...prev.slice(-4), msg]);

  // 1. HEALTH CHECK
  useEffect(() => {
    fetch(`${API_URL}/`)
      .then(() => setBackendStatus("Online 🟢"))
      .catch((err) => {
          console.error(err);
          setBackendStatus("Offline 🔴");
          setDebugInfo(`Error HTTP: ${API_URL}`);
      });
  }, [API_URL]);
  const [backendStatus, setBackendStatus] = useState("Conectando...");

  // 2. MOTOR WEBSOCKET
  useEffect(() => {
    if (!jugador) {
        setWsStatus("Inactivo ⚪");
        return;
    }

    const idJugador = jugador.id || jugador._id;
    const protocol = API_URL.startsWith("https") ? "wss" : "ws";
    const host = API_URL.replace(/^http(s)?:\/\//, '').replace(/\/$/, "");
    const url = `${protocol}://${host}/ws/${idJugador}`;

    setDebugInfo(`WS: ${url}`);
    setWsStatus("Conectando... 🟡");

    const socket = new WebSocket(url);

    socket.onopen = () => {
        setWsStatus("Conectado 🟢");
        addLog(`✅ Sala: ${gameCodeRef.current}`);
        setDebugInfo(""); 
    };
    
    socket.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            
            if (data.type === "UPDATE_PLAYER") {
                if (data.payload.player_id === idJugador) {
                    setJugador(prev => ({ 
                        ...prev, 
                        // --- CORRECCIÓN CRÍTICA AQUÍ ---
                        // Mapeamos explícitamente 'new_position' a 'position'
                        // para que React actualice el número en pantalla.
                        position: data.payload.new_position,
                        laps_completed: prev.laps_completed, // Mantenemos el dato previo si no viene
                        
                        financials: { 
                            cash: data.payload.new_cash,
                            netWorth: data.payload.new_net_worth,
                            toxicDebt: data.payload.new_debt,
                            passiveIncome: data.payload.new_passive_income
                        }
                    }));
                    
                    if (data.payload.event_queue?.length) {
                        setCardQueue(prev => [...prev, ...data.payload.event_queue]);
                        if (!isTeacherRef.current) {
                            const evts = data.payload.event_queue;
                            if(evts.some(ev => ev.tipo === "LOBO_NEGRO")) playSound("alert");
                            else playSound("cash");
                        }
                    }
                } else {
                    addLog(`Movimiento en tablero: ${data.payload.new_position}`);
                }
            } else if (data.type === "LEADERBOARD") {
                setLeaderboard(data.payload);
            } else if (data.type === "VICTORY") {
                addLog(data.message);
                if (data.payload?.player_id === idJugador && !isTeacherRef.current) {
                    setWinner(true);
                    playSound("victory");
                }
            } else if (data.type === "CHAT") {
                addLog(data.message);
            }
        } catch (err) { 
            console.error("Error parseando mensaje WS:", err);
        }
    };

    socket.onclose = (event) => {
        setWsStatus("Desconectado 🔴");
        console.log(`WS Cerrado: ${event.code}`);
        if (event.code === 1008) {
            alert("⚠️ Sesión expirada.");
            setJugador(null);
            setNickname("");
            setRole(null);
        }
    };

    socket.onerror = (error) => {
        console.error("WS Error:", error);
        setWsStatus("Error ⚠️");
    };

    ws.current = socket;

    return () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close();
        }
    };
  }, [jugador, API_URL]); 

  // 3. HANDLERS
  const handleRegister = async () => {
      if(!nickname || !gameCode) return setMensaje("Faltan datos");
      setMensaje("Entrando...");
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
      } else {
          addLog("⚠️ No hay conexión");
      }
  };

  const resetGame = () => {
      if(ws.current) ws.current.close();
      setJugador(null);
      setWinner(false);
      setNickname("");
      setCardQueue([]);
  };

  const handleGlobalReset = async () => {
      if(confirm("¿Borrar todo?")) {
          await fetch(`${API_URL}/reset_game`, {method: 'DELETE'});
          window.location.reload();
      }
  };

  // 4. RENDER
  if (jugador && isTeacherDashboard) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-6">
            {typeof TeacherDashboard !== 'undefined' ? (
                <TeacherDashboard gameCode={gameCode} playersData={leaderboard} onReset={handleGlobalReset} connectedCount={leaderboard.length - 1} />
            ) : (
                <div className="w-full max-w-4xl text-center">
                    <h1 className="text-4xl text-lobo-neion-red font-bold mb-4">PANEL DOCENTE</h1>
                    <button onClick={resetGame} className="mt-4 underline">Salir</button>
                </div>
            )}
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
                <div className="bg-slate-800 p-4 rounded-xl border-l-4 border-lobo-neion-red flex justify-between">
                    <div>
                        <h2 className="text-xl font-bold">🐺 {jugador.nickname}</h2>
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-400">WS: {wsStatus}</span>
                            {debugInfo && <span className="text-[9px] text-red-400">{debugInfo}</span>}
                        </div>
                    </div>
                    <button onClick={resetGame} className="text-xs underline">Salir</button>
                </div>
                <FinancialDisplay financials={jugador.financials} />
                <div className="bg-slate-800 p-4 rounded-xl h-48 overflow-y-auto text-xs">
                   {logs.map((l, i) => <p key={i} className="border-b border-slate-700 pb-1">{l}</p>)}
                </div>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="bg-slate-800 p-6 rounded-xl min-h-[300px] flex items-center justify-center">
                    <div className="text-center">
                        <h1 className="text-6xl font-black">{jugador.position}</h1>
                        <p className="text-lobo-neion-red font-bold text-sm">POSICIÓN ACTUAL</p>
                    </div>
                </div>
                <button onClick={lanzarDados} disabled={isRolling || wsStatus.includes("Desconectado") || wsStatus.includes("Inactivo")} className="w-full bg-lobo-neion-red hover:bg-red-600 py-6 rounded-xl font-black text-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isRolling ? "🎲 ..." : "LANZAR DADOS"}
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
        <h1 className="text-4xl font-black text-center text-white mb-8">LA SENDA <span className="text-lobo-neion-red">DE LOS LOBOS</span></h1>
        <p className="text-center text-slate-500 mb-4 text-xs">Estado API: {backendStatus}</p>
        
        {!role ? (
          <div className="grid grid-cols-2 gap-4">
             <button onClick={() => setRole('STUDENT')} className="bg-slate-800 hover:bg-slate-700 p-6 rounded-xl border border-slate-700 text-white font-bold">🎓 ESTUDIANTE</button>
             <button onClick={() => setRole('PROFESSOR')} className="bg-slate-800 hover:bg-slate-700 p-6 rounded-xl border border-slate-700 text-white font-bold">👨‍🏫 PROFESOR</button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <button onClick={() => setRole(null)} className="text-xs text-slate-500 mb-2">← Volver</button>
            {role === 'STUDENT' ? (
                  <>
                    <input type="text" value={gameCode} onChange={(e) => setGameCode(e.target.value.toUpperCase())} placeholder="CÓDIGO SALA" className="w-full bg-slate-800 p-3 rounded text-white border border-slate-600"/>
                    <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="APODO" className="w-full bg-slate-800 p-3 rounded text-white border border-slate-600"/>
                    <button onClick={handleRegister} className="w-full bg-lobo-neon-blue py-3 rounded font-bold text-white shadow-lg">ENTRAR</button>
                  </>
              ) : (
                  <>
                    <input type="text" value={gameCode} onChange={(e) => setGameCode(e.target.value.toUpperCase())} placeholder="NUEVO CÓDIGO" className="w-full bg-slate-800 p-3 rounded text-white border border-slate-600"/>
                    <div className="flex gap-2">
                        <input type="number" value={configSalary} onChange={(e) => setConfigSalary(e.target.value)} className="w-full bg-slate-800 p-2 rounded text-white border border-slate-600"/>
                        <input type="number" value={configGoal} onChange={(e) => setConfigGoal(e.target.value)} className="w-full bg-slate-800 p-2 rounded text-white border border-slate-600"/>
                    </div>
                    <button onClick={handleCreateSession} className="w-full bg-lobo-neion-red py-3 rounded font-bold text-white shadow-lg">CREAR</button>
                  </>
              )}
            {mensaje && <p className="text-center text-xs text-yellow-500 mt-2">{mensaje}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;