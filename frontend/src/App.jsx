// =============================================================================
// 📄 ARCHIVO: src/App.jsx
// 📄 VERSIÓN: 8.2 (UI UPDATE & LOGS FIX)
// 📝 DESCRIPCIÓN: Controlador principal de la interfaz. Maneja la conexión
//    WebSocket, el enrutamiento de vistas (Alumno/Profesor) y el estado global.
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';

// --- IMPORTACIÓN DE COMPONENTES VISUALES ---
// FinancialDisplay: Muestra las 4 columnas de dinero (Efectivo, Flujo, Patrimonio, Deuda)
import FinancialDisplay from './components/FinancialDisplay';
// Leaderboard: Muestra la tabla de posiciones en tiempo real
import Leaderboard from './components/Leaderboard';
// EventCard: Muestra las tarjetas emergentes (Lobos y Payday)
import EventCard from './components/EventCard';
// TeacherDashboard: Vista exclusiva para el proyector del profesor
import TeacherDashboard from './components/TeacherDashboard'; 

// -----------------------------------------------------------------------------
// 🔊 SISTEMA DE AUDIO
// -----------------------------------------------------------------------------
// Precargamos los audios para evitar latencia al reproducirlos.
const AUDIO_CLIPS = {
  dice: new Audio("/dice-142528.mp3"), // Archivo local en public/
  // Archivos en nube para efectos genéricos
  cash: new Audio("https://actions.google.com/sounds/v1/cartoon/clinking_coins.ogg"), 
  alert: new Audio("https://actions.google.com/sounds/v1/cartoon/cartoon_cowbell.ogg"), 
  victory: new Audio("https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg") 
};

// Función auxiliar para manejar la reproducción segura (evita errores de Autoplay policy)
const playSound = (key) => {
  try {
    const sound = AUDIO_CLIPS[key];
    if (sound) { 
      sound.currentTime = 0; // Reinicia el audio para permitir sonidos repetidos rápidos
      sound.volume = 0.5;    // Volumen medio
      // El catch vacío silencia errores si el usuario no ha interactuado aún con la página
      sound.play().catch(() => {}); 
    }
  } catch (error) { 
    console.error("Error crítico en sistema de audio:", error); 
  }
};

// -----------------------------------------------------------------------------
// 🏆 COMPONENTE: PANTALLA DE VICTORIA (MODAL)
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
  // Configuración de URL: Intenta leer variable de entorno (Vercel), si no usa localhost.
  const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  // ---------------------------------------------------------------------------
  // 1. ESTADOS DE LA APLICACIÓN (STATE)
  // ---------------------------------------------------------------------------
  
  // Datos de Sesión
  const [gameCode, setGameCode] = useState(""); // Código de la sala (Ej. CLASE-A)
  const [nickname, setNickname] = useState(""); // Nombre del usuario
  const [role, setRole] = useState(null);       // Rol seleccionado: 'STUDENT' o 'PROFESSOR'
  
  // Datos del Jugador y Juego
  const [jugador, setJugador] = useState(null); // Objeto completo del jugador (traído del backend)
  const [leaderboard, setLeaderboard] = useState([]); // Lista de ranking
  const [globalActivity, setGlobalActivity] = useState([]); // Historial para el dashboard del profesor
  
  // Configuración de la Sala (Inputs del Profesor)
  const [configSalary, setConfigSalary] = useState("2500");
  const [configGoal, setConfigGoal] = useState("1000000");
  const [gameTarget, setGameTarget] = useState("1000000"); // Meta visual para la barra de progreso

  // Estados de Interfaz (UI)
  const [mensaje, setMensaje] = useState("");   // Mensajes de error/éxito en login
  const [backendStatus, setBackendStatus] = useState("Conectando..."); // Estado del servidor API
  const [logs, setLog] = useState(["Esperando inicio..."]); // Chat de sistema (Corrección: Variable 'logs')
  const [cardQueue, setCardQueue] = useState([]); // Cola de cartas de eventos
  const [isRolling, setIsRolling] = useState(false); // Animación de dados
  const [lastDice, setLastDice] = useState(null);    // Último número sacado
  const [winner, setWinner] = useState(false);       // Estado de victoria
  
  // Estado interno para saber si estamos mostrando el panel de profesor
  const [isTeacherDashboard, setIsTeacherDashboard] = useState(false);
  const [wsStatus, setWsStatus] = useState("⚪"); // Indicador visual de conexión (semáforo)

  // Referencias (Refs) para manejo de WebSocket sin re-renderizados
  const ws = useRef(null);
  
  // Refs espejo: Permiten acceder al valor más reciente del estado dentro del EventListener del WebSocket
  // sin tener que reiniciar la conexión cada vez que el estado cambia.
  const isTeacherRef = useRef(isTeacherDashboard);
  const gameCodeRef = useRef(gameCode);

  // Sincronización de Refs
  useEffect(() => { isTeacherRef.current = isTeacherDashboard; }, [isTeacherDashboard]);
  useEffect(() => { gameCodeRef.current = gameCode; }, [gameCode]);

  // Helper para añadir logs (mantiene máximo 4 líneas para no saturar la UI)
  const addLog = (msg) => setLog(prev => [...prev.slice(-4), msg]);

  // ---------------------------------------------------------------------------
  // 2. EFECTOS (SIDE EFFECTS)
  // ---------------------------------------------------------------------------

  // Health Check: Verifica si el backend está disponible al cargar la página
  useEffect(() => {
    fetch(`${API_URL}/`)
      .then(() => {}) // Conexión exitosa
      .catch(() => console.log("Backend offline")); // Fallo silencioso en consola
  }, [API_URL]);

  // MOTOR WEBSOCKET: Maneja la comunicación en tiempo real
  useEffect(() => {
    // Solo intentamos conectar si hay un jugador autenticado
    if (!jugador) return;

    // Construcción dinámica de la URL del WebSocket (ws:// o wss://)
    const idJugador = jugador.id || jugador._id;
    const protocol = API_URL.startsWith("https") ? "wss" : "ws";
    const host = API_URL.replace(/^http(s)?:\/\//, '').replace(/\/$/, "");
    const url = `${protocol}://${host}/ws/${idJugador}`;

    // Evitar reconexión si ya existe un socket abierto
    if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

    setWsStatus("🟡"); // Amarillo: Conectando
    const socket = new WebSocket(url);

    // Evento: Conexión Abierta
    socket.onopen = () => setWsStatus("🟢"); // Verde: Conectado
    
    // Evento: Mensaje Recibido
    socket.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            
            // CASO A: Actualización de Estado de Jugador
            if (data.type === "UPDATE_PLAYER") {
                const payload = data.payload;
                
                // LÓGICA PROFESOR: Alimentar bitácora de actividad global
                if (payload.event_queue && payload.event_queue.length > 0) {
                    setGlobalActivity(prev => [{
                        player: payload.nickname || "Jugador",
                        position: payload.new_position,
                        events: payload.event_queue
                    }, ...prev].slice(0, 20)); 
                }

                // LÓGICA ALUMNO: Si el mensaje es para MÍ, actualizo mi tablero
                if (payload.player_id === idJugador) {
                    setJugador(prev => ({ 
                        ...prev, 
                        ...payload, // Mantiene datos base
                        position: payload.new_position, // Actualiza posición visual
                        financials: { 
                            cash: payload.new_cash,
                            netWorth: payload.new_net_worth,
                            toxicDebt: payload.new_debt,
                            passiveIncome: payload.new_passive_income
                        }
                    }));
                    
                    // Actualizar estados visuales
                    if (payload.game_target) setGameTarget(payload.game_target);
                    if (payload.dice_value) setLastDice(payload.dice_value);

                    // Procesar eventos visuales (Cartas)
                    if (payload.event_queue?.length) {
                        setCardQueue(prev => [...prev, ...payload.event_queue]);
                        // Sonidos (Solo si no es el profesor observando)
                        if (!isTeacherRef.current) {
                            const evts = payload.event_queue;
                            if (evts.some(ev => ev.tipo === "LOBO_NEGRO")) playSound("alert");
                            else playSound("cash");
                        }
                    }
                }
            } 
            // CASO B: Actualización de Ranking
            else if (data.type === "LEADERBOARD") {
                setLeaderboard(data.payload);
            } 
            // CASO C: Victoria
            else if (data.type === "VICTORY") {
                addLog(data.message);
                if (data.payload?.player_id === idJugador && !isTeacherRef.current) {
                    setWinner(true);
                    playSound("victory");
                }
            }
        } catch (err) { console.error("Error WS:", err); }
    };

    // Evento: Cierre de Conexión
    socket.onclose = (evt) => {
        setWsStatus("🔴"); // Rojo: Desconectado
        // Código 1008: Policy Violation (Usado por Backend cuando no encuentra al jugador en BD)
        if (evt.code === 1008) {
            alert("⚠️ La sesión ha expirado o la sala se cerró.");
            setJugador(null);
            setRole(null);
        }
    };

    ws.current = socket;
    
    // Cleanup al desmontar el componente (cierra conexión)
    return () => { if (ws.current) ws.current.close(); };
  }, [jugador, API_URL]); 

  // ---------------------------------------------------------------------------
  // 3. HANDLERS (MANEJADORES DE ACCIÓN)
  // ---------------------------------------------------------------------------
  
  // Alumno: Unirse a Sala
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

  // Profesor: Crear Sala
  const handleCreateSession = async () => {
      if(!gameCode) return setMensaje("Falta Código");
      setMensaje("Creando...");
      try {
          // 1. Crear Sesión con reglas
          const res1 = await fetch(`${API_URL}/sessions`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ 
                  code: gameCode, 
                  salary: Number(configSalary), 
                  winning_score: Number(configGoal) 
              })
          });
          if(!res1.ok) throw new Error((await res1.json()).detail);
          
          // 2. Auto-entrar como Profesor (Host)
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

  // Acción de Juego: Lanzar Dados
  const lanzarDados = () => {
      if(ws.current?.readyState === WebSocket.OPEN) {
          setIsRolling(true);
          playSound("dice");
          ws.current.send("lanzado los dados");
          setTimeout(() => setIsRolling(false), 800); // Duración de animación
      }
  };

  // Salir / Reset Local
  const resetGame = () => {
      if(ws.current) ws.current.close();
      setJugador(null);
      setWinner(false);
      setGlobalActivity([]);
      setIsTeacherDashboard(false);
  };

  // Reset Global (Solo Profesor) - Borra BD
  const handleGlobalReset = async () => {
      if(confirm("¿Estás seguro? Esto borrará TODA la base de datos.")) {
          await fetch(`${API_URL}/reset_game`, {method: 'DELETE'});
          window.location.reload();
      }
  };

  // ---------------------------------------------------------------------------
  // 4. RENDERIZADO DE VISTAS
  // ---------------------------------------------------------------------------
  
  // --- VISTA 1: DASHBOARD DEL PROFESOR ---
  if (jugador && isTeacherDashboard) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-6">
            {/* Pasamos los datos al componente TeacherDashboard */}
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

  // --- VISTA 2: INTERFAZ DEL ALUMNO (TABLERO) ---
  if (jugador && !isTeacherDashboard) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 font-mono">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Componentes Flotantes */}
            {winner && <VictoryScreen nickname={jugador.nickname} onReset={resetGame} />}
            {cardQueue.length > 0 && <EventCard eventData={cardQueue[0]} onClose={() => setCardQueue(prev => prev.slice(1))} />}

            {/* COLUMNA IZQUIERDA: Datos Financieros */}
            <div className="lg:col-span-4 space-y-4">
                <div className="bg-slate-800 p-4 rounded-xl border-l-4 border-lobo-neion-red flex justify-between">
                    <div>
                        <h2 className="text-xl font-bold">🐺 {jugador.nickname}</h2>
                        <span className="text-xs text-slate-400">WS: {wsStatus}</span>
                    </div>
                    <button onClick={resetGame} className="text-xs underline">Salir</button>
                </div>
                
                {/* Visualizador de Finanzas (Recibe meta para barra de progreso) */}
                <FinancialDisplay financials={jugador.financials} target={gameTarget} />
                
                {/* 🛠️ AQUÍ USAMOS LA VARIABLE 'logs' QUE DABA ERROR DE LINTER 🛠️ */}
                {/* Caja de historial de texto para el alumno */}
                <div className="bg-slate-800 p-4 rounded-xl h-48 overflow-y-auto text-xs font-mono border border-slate-700">
                   <p className="text-slate-500 border-b border-slate-700 pb-1 mb-1">Historial del Sistema:</p>
                   {logs.map((l, i) => (
                       <p key={i} className="mb-1 text-slate-300">{l}</p>
                   ))}
                </div>
            </div>

            {/* COLUMNA CENTRAL: Acción de Juego */}
            <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="bg-slate-800 p-6 rounded-xl min-h-[300px] flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="text-center z-10">
                        {/* Mostrar resultado del dado si existe */}
                        {lastDice && (
                            <div className="text-2xl text-yellow-400 font-bold mb-2 animate-bounce">
                                🎲 {lastDice}
                            </div>
                        )}
                        <h1 className="text-6xl font-black text-white">{jugador.position}</h1>
                        <p className="text-lobo-neion-red font-bold text-sm">POSICIÓN ACTUAL</p>
                    </div>
                </div>
                <button 
                    onClick={lanzarDados} 
                    disabled={isRolling} 
                    className="w-full bg-lobo-neion-red hover:bg-red-600 py-6 rounded-xl font-black text-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                >
                    {isRolling ? "🎲 ..." : "LANZAR DADOS"}
                </button>
            </div>

            {/* COLUMNA DERECHA: Ranking */}
            <div className="lg:col-span-3">
                <Leaderboard players={leaderboard.filter(p => p.nickname !== "HOST_PROFESOR")} myNickname={jugador.nickname} />
            </div>
        </div>
      </div>
    );
  }

  // --- VISTA 3: LOGIN / MENÚ PRINCIPAL ---
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
        <h1 className="text-4xl font-black text-center text-white mb-8">
            LA SENDA <span className="text-lobo-neion-red">DE LOS LOBOS</span>
        </h1>
        
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
            
            {/* Formulario Estudiante */}
            {role === 'STUDENT' ? (
                  <>
                    <input type="text" value={gameCode} onChange={(e) => setGameCode(e.target.value.toUpperCase())} placeholder="CÓDIGO DE SALA" className="w-full bg-slate-800 p-3 rounded text-white border border-slate-600 focus:border-lobo-neion-blue outline-none uppercase"/>
                    <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="TU APODO" className="w-full bg-slate-800 p-3 rounded text-white border border-slate-600 focus:border-lobo-neion-blue outline-none"/>
                    <button onClick={handleRegister} className="w-full bg-lobo-neon-blue py-3 rounded font-bold text-white shadow-lg hover:bg-blue-600 transition-colors">
                        ENTRAR AHORA
                    </button>
                  </>
              ) : (
                  /* Formulario Profesor (Con Textos Actualizados) */
                  <>
                    <div className="bg-slate-800 p-3 rounded text-xs text-slate-400 mb-2">
                        <p className="font-bold text-white mb-1">Configuración de la Partida</p>
                        Define las reglas económicas para esta sesión.
                    </div>
                    
                    {/* Campo Código */}
                    <input 
                        type="text" 
                        value={gameCode} 
                        onChange={(e) => setGameCode(e.target.value.toUpperCase())} 
                        placeholder="NUEVO CÓDIGO DE SALA" 
                        className="w-full bg-slate-800 p-3 rounded text-white border border-slate-600 focus:border-lobo-neion-red outline-none uppercase"
                    />
                    
                    {/* Campos de Configuración */}
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-[10px] text-slate-400 ml-1">Salario por turno</label>
                            <input 
                                type="number" 
                                value={configSalary} 
                                onChange={(e) => setConfigSalary(e.target.value)} 
                                className="w-full bg-slate-800 p-2 rounded text-white border border-slate-600 focus:border-lobo-neion-red outline-none"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] text-slate-400 ml-1">Meta para ganar (Patrimonio)</label>
                            <input 
                                type="number" 
                                value={configGoal} 
                                onChange={(e) => setConfigGoal(e.target.value)} 
                                className="w-full bg-slate-800 p-2 rounded text-white border border-slate-600 focus:border-lobo-neion-red outline-none"
                            />
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