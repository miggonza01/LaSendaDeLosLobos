// =============================================================================
// 📄 ARCHIVO: src/App.jsx
// 📄 VERSIÓN: 5.2 (RECONEXIÓN SEGURA + AUDIO + MULTI-ROOM)
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';

// --- IMPORTACIÓN DE COMPONENTES VISUALES ---
import FinancialDisplay from './components/FinancialDisplay';
import Leaderboard from './components/Leaderboard';
import EventCard from './components/EventCard';

// -----------------------------------------------------------------------------
// 🔊 SISTEMA DE AUDIO (ROBUSTO)
// -----------------------------------------------------------------------------
const AUDIO_CLIPS = {
  // 🎲 DADO: Usamos el archivo local que colocaste en /public para respuesta inmediata
  dice: new Audio("/dice-142528.mp3"), 
  
  // 💰 OTROS: Usamos CDNs fiables para no llenar tu proyecto de archivos pesados
  cash: new Audio("/cashier-quotka-chingquot-sound-effect-129698.mp3"), 
  alert: new Audio("/alert-444816.mp3"), 
  victory: new Audio("/level-passed-143039.mp3")
};

// Función auxiliar para reproducir sonido de forma segura (evita crash si falla)
const playSound = (key) => {
  try {
    const sound = AUDIO_CLIPS[key];
    if (sound) {
      sound.currentTime = 0; // Reinicia el audio para permitir repeticiones rápidas
      sound.volume = 0.5;    // Volumen equilibrado
      
      // Intentamos reproducir y capturamos errores de autoplay (común en Chrome)
      sound.play().catch(error => console.warn("Audio bloqueado por navegador:", error));
    }
  } catch (e) { console.error("Error sistema audio:", e); }
};

// -----------------------------------------------------------------------------
// 🏆 COMPONENTE: PANTALLA DE VICTORIA (MODAL)
// -----------------------------------------------------------------------------
const VictoryScreen = ({ nickname, onReset }) => (
  <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 animate-fade-in p-4 backdrop-blur-sm">
    <div className="text-6xl mb-4 animate-bounce">🏆</div>
    <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 text-center mb-4 drop-shadow-lg">
      ¡LIBERTAD FINANCIERA!
    </h1>
    <p className="text-xl text-white mb-8 text-center max-w-lg">
      <span className="font-bold text-yellow-400">{nickname}</span> ha escapado de la Carrera de la Rata.
    </p>
    <button 
      onClick={onReset} 
      className="bg-white text-black font-bold py-3 px-8 rounded-full hover:bg-yellow-400 transition-all shadow-[0_0_20px_rgba(255,215,0,0.5)] transform hover:scale-105"
    >
      Jugar Otra Vez
    </button>
  </div>
);

// =============================================================================
// ⚛️ COMPONENTE PRINCIPAL: APP
// =============================================================================
function App() {
  // Configuración de URL (Local vs Nube)
  const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  // --- 1. ESTADOS DE SESIÓN Y USUARIO ---
  const [nickname, setNickname] = useState("");
  const [gameCode, setGameCode] = useState(""); // Código de sala (Ej. CLASE-A)
  const [mode, setMode] = useState("STUDENT");  // UI: 'STUDENT' (Unirse) o 'TEACHER' (Crear)
  const [jugador, setJugador] = useState(null); // Objeto completo del jugador logueado

  // --- 2. ESTADOS DEL JUEGO ---
  const [leaderboard, setLeaderboard] = useState([]);
  const [cardQueue, setCardQueue] = useState([]); // Cola de eventos (FIFO)
  const [logs, setLogs] = useState([]);
  const [winner, setWinner] = useState(false);
  
  // --- 3. ESTADOS DE UI/SISTEMA ---
  const [isRolling, setIsRolling] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [backendStatus, setBackendStatus] = useState("Conectando...");
  
  // Referencia mutable para el WebSocket (persiste entre renders)
  const ws = useRef(null);

  // Helper para añadir logs limitados a 5 líneas
  const addLog = (text) => setLogs((prev) => [text, ...prev].slice(0, 5));

  // ---------------------------------------------------------------------------
  // 🩺 HEALTH CHECK (Verifica si el backend respira)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetch(`${API_URL}/`)
      .then((res) => res.ok ? setBackendStatus("En Línea 🟢") : setBackendStatus("Error 🔴"))
      .catch(() => setBackendStatus("Desconectado 🔴"));
  }, [API_URL]);

  // ---------------------------------------------------------------------------
  // 🔌 MOTOR WEBSOCKET (RECONEXIÓN SEGURA - VERSIÓN 5.2)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Solo conectamos si hay un jugador registrado con ID válido
    if (jugador) {
      // Blindaje: Soportamos tanto 'id' (Pydantic) como '_id' (Mongo)
      const idJugador = jugador.id || jugador._id;
      
      // Detectar protocolo seguro (WSS) o inseguro (WS)
      const wsProtocol = API_URL.startsWith("https") ? "wss" : "ws";
      const wsBase = API_URL.replace(/^http(s)?:\/\//, '');
      
      // Construir URL WebSocket
      const wsUrl = `${wsProtocol}://${wsBase}/ws/${idJugador}`;
      console.log(`🔗 Intentando conexión WebSocket a: ${wsUrl}`);
      
      // Crear nueva instancia de WebSocket
      const socket = new WebSocket(wsUrl);
      
      // Configurar timeout de conexión (8 segundos)
      const connectionTimeout = setTimeout(() => {
        if (socket.readyState === WebSocket.CONNECTING) {
          console.warn("⏰ Timeout de conexión WebSocket, cerrando...");
          socket.close();
          addLog("❌ Timeout de conexión al servidor");
        }
      }, 8000);
      
      // Evento: Conexión establecida
      socket.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log(`✅ WebSocket conectado a sala: ${gameCode}`);
        addLog(`✅ Conectado a Sala: ${gameCode}`);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Función interna para actualizar el estado del jugador localmente
          const updateData = () => {
             if (data.payload && data.payload.player_id === idJugador) {
                // Actualización atómica de datos financieros y posición
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

                // Gestión de la Cola de Eventos Visuales
                if (data.payload.event_queue && data.payload.event_queue.length > 0) {
                    // Agregamos nuevos eventos al final de la cola
                    setCardQueue((prevQueue) => [...prevQueue, ...data.payload.event_queue]);
                    
                    // --- TRIGGERS DE AUDIO ---
                    const events = data.payload.event_queue;
                    // Si hay dinero involucrado (Payday o Inversión), suena caja registradora
                    if (events.some(e => e.tipo === "PAYDAY" || e.tipo === "LOBO_BLANCO")) playSound("cash");
                    // Si hay problemas (Lobo Negro), suena alerta
                    else if (events.some(e => e.tipo === "LOBO_NEGRO")) playSound("alert");
                }
            }
          };

          // --- ENRUTADOR DE MENSAJES ---
          if (data.type === "UPDATE_PLAYER") {
             addLog(data.message);
             updateData();
          }
          else if (data.type === "VICTORY") {
             addLog(data.message);
             updateData();
             // Si el ganador soy yo, activo la pantalla de victoria
             if (data.payload.player_id === idJugador) {
                setWinner(true);
                playSound("victory");
             }
          }
          else if (data.type === "LEADERBOARD") {
            setLeaderboard(data.payload);
          }
          else if (data.type === "CHAT" || data.type === "SYSTEM") {
            addLog(data.message);
          }
        } catch (error) { 
          console.error("Error procesando mensaje WS:", error); 
        }
      };

      socket.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log(`🔌 WebSocket cerrado. Código: ${event.code}, Razón: ${event.reason}`);
        addLog("❌ Desconectado del servidor");
        
        // Estrategia de reconexión inteligente
        // Solo reconectar si el cierre fue inesperado (no fue manual)
        if (event.code !== 1000 && event.code !== 1001) {
          console.log("🔄 Intentando reconexión en 2 segundos...");
          setTimeout(() => {
            // Verificar que aún estamos en el mismo estado
            if (jugador && (jugador.id === idJugador || jugador._id === idJugador)) {
              console.log("🔄 Forzando nueva conexión...");
              // Forzar nuevo render con jugador actualizado
              setJugador({...jugador});
            }
          }, 2000); // Delay de 2 segundos
        }
      };

      socket.onerror = (error) => {
        console.error("💥 Error WebSocket:", error);
        addLog("⚠️ Error de conexión en tiempo real");
      };

      // Guardar referencia para uso externo
      ws.current = socket;

      // Cleanup: Cerrar socket limpiamente al desmontar o cambiar dependencias
      return () => {
        clearTimeout(connectionTimeout);
        
        // Cerrar socket solo si está abierto o conectando
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
          console.log("🧹 Limpiando WebSocket anterior...");
          socket.close(1000, "Componente desmontado"); // Código 1000 = cierre normal
        }
      };
    }
    
    // 🛡️ DEPENDENCIAS COMPLETAS
    // Nota: gameCode está incluido para forzar nueva conexión al cambiar de sala
  }, [jugador, API_URL, gameCode]);

  // ---------------------------------------------------------------------------
  // 📡 ACCIONES DE RED (API REST)
  // ---------------------------------------------------------------------------

  // Acción 1: Unirse a una sala existente (Alumno)
  const handleRegister = async () => {
    if (!nickname || !gameCode) {
        setMensaje("Faltan datos: Nombre y Código obligatorios.");
        return;
    }
    setMensaje("Buscando sala...");
    try {
      const response = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            nickname: nickname,
            game_code: gameCode 
        })
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
      console.error("Error al registrarse:", error);
      setMensaje("Error de conexión con el servidor"); 
    }
  };

  // Acción 2: Crear una nueva sala (Profesor)
  const handleCreateSession = async () => {
      if (!gameCode) {
          setMensaje("Escribe un código para la nueva sala.");
          return;
      }
      setMensaje("Creando sala...");
      try {
        const response = await fetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: gameCode })
        });
        const data = await response.json();
        if (response.ok) {
            setMensaje(`✅ ¡Sala '${data.code}' creada! Compártela.`);
        } else {
            setMensaje("Error: " + data.detail);
        }
      } catch (error) { 
        console.error("Error al crear sesión:", error);
        setMensaje("Error de conexión con el servidor"); 
      }
  };

  // Acción 3: Lanzar los dados (WebSocket)
  const handleDiceRoll = () => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      addLog("⚠️ Esperando conexión...");
      return;
    }
    
    setIsRolling(true);
    playSound("dice"); // Sonido local inmediato
    
    setTimeout(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(`🎲 ${jugador.nickname} ha lanzado los dados...`);
      }
      setIsRolling(false);
    }, 800); // Retardo visual para simular la física del dado
  };

  // Acción 4: Reiniciar estado local
  const resetGame = () => {
    // Cerrar WebSocket si está abierto
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.close(1000, "Usuario salió del juego");
    }
    
    setJugador(null);
    setWinner(false);
    setNickname("");
    setCardQueue([]);
    // No borramos gameCode para facilitar el reingreso rápido
  };

  // ---------------------------------------------------------------------------
  // 🧠 LÓGICA VISUAL (Smart Merge para Ranking)
  // ---------------------------------------------------------------------------
  // Corrige el lag de la base de datos combinando el dato local con la lista del server
  const leaderboardFusionado = leaderboard.map((item) => {
    if (jugador && item.nickname === jugador.nickname) {
        return { ...item, net_worth: jugador.financials.netWorth };
    }
    return item;
  });

  // ---------------------------------------------------------------------------
  // 🎨 RENDERIZADO (JSX)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-lobo-dark text-white p-4 font-mono relative transition-colors duration-500">
      
      {/* Capas Superpuestas (Modales y Cartas) */}
      {winner && <VictoryScreen nickname={jugador?.nickname} onReset={resetGame} />}
      
      {/* Cola de Eventos: Muestra la primera carta y la elimina al cerrarse */}
      {cardQueue.length > 0 && (
        <EventCard 
            eventData={cardQueue[0]} 
            onClose={() => setCardQueue(prev => prev.slice(1))} 
        />
      )}

      {/* Contenedor Principal Estilo Cyberpunk */}
      <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden p-8 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-lobo-neion-red via-purple-500 to-lobo-neon-blue"></div>
        <h1 className="text-3xl font-bold mb-6 text-center tracking-tighter">
          LA SENDA <span className="text-lobo-neion-red">DE LOS LOBOS</span>
        </h1>

        {jugador ? (
          // === VISTA DE JUEGO (DASHBOARD) ===
          <div className="w-full animate-fade-in">
            <div className="flex justify-between items-end mb-4 border-b border-slate-800 pb-2">
              <div>
                <h2 className="text-xl font-bold">Hola, {jugador.nickname}</h2>
                <p className="text-[10px] text-slate-500">Sala: <span className="text-lobo-neon-blue font-bold">{gameCode}</span></p>
              </div>
              <button 
                className="text-xs text-red-400 underline hover:text-red-300" 
                onClick={resetGame}
              >
                Salir
              </button>
            </div>

            {/* Panel Financiero */}
            <FinancialDisplay financials={jugador.financials} />
            
            {/* Tabla de Posiciones (Con Smart Merge) */}
            <Leaderboard players={leaderboardFusionado} myNickname={jugador.nickname} />

            {/* Zona de Dados */}
            <div className="bg-slate-800/50 p-6 mt-4 rounded-lg border border-dashed border-slate-600 text-center relative overflow-hidden group">
              <div className={`text-5xl mb-3 transition-all duration-300 ${isRolling ? "animate-spin opacity-100" : "opacity-30 group-hover:opacity-50"}`}>🎲</div>
              <p className="text-slate-400 mb-4 text-[10px] uppercase tracking-widest font-bold">
                Casilla Actual<br/><span className="text-4xl text-white font-mono inline-block mt-1">{jugador.position}</span>
              </p>
              <button 
                onClick={handleDiceRoll} 
                disabled={isRolling} 
                className={`w-full bg-lobo-neon-blue hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform ${isRolling ? "opacity-50 cursor-not-allowed" : "hover:scale-105 active:scale-95"}`}
              >
                {isRolling ? "Calculando..." : "LANZAR DADOS"}
              </button>
            </div>

            {/* Log de Chat/Sistema */}
            <div className="mt-4 bg-black rounded p-2 h-24 overflow-hidden border border-slate-800 text-[10px] font-mono text-green-400 shadow-inner">
              {logs.map((log, i) => (
                <div key={i} className="opacity-90 border-b border-white/5 pb-1 mb-1 last:border-0">
                  <span className="text-green-600 mr-2">&gt;</span>{log}
                </div>
              ))}
            </div>
          </div>
        ) : (
          // === VISTA DE ACCESO (LOGIN / CREAR SALA) ===
          <div className="space-y-5 animate-fade-in">
              
              {/* Pestañas de Modo */}
              <div className="flex border-b border-slate-700 mb-4">
                <button 
                    onClick={() => { setMode("STUDENT"); setMensaje(""); }}
                    className={`flex-1 pb-2 text-sm font-bold transition-colors ${mode === "STUDENT" ? "text-lobo-neon-blue border-b-2 border-lobo-neon-blue" : "text-slate-500 hover:text-white"}`}
                >
                    UNIRSE A PARTIDA
                </button>
                <button 
                    onClick={() => { setMode("TEACHER"); setMensaje(""); }}
                    className={`flex-1 pb-2 text-sm font-bold transition-colors ${mode === "TEACHER" ? "text-lobo-neion-red border-b-2 border-lobo-neion-red" : "text-slate-500 hover:text-white"}`}
                >
                    CREAR SALA
                </button>
              </div>

              {/* Formulario Dinámico */}
              {mode === "STUDENT" ? (
                  <>
                    <input 
                        type="text" 
                        value={gameCode}
                        onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                        placeholder="CÓDIGO DE SALA (Ej. CLASE1)"
                        className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-white placeholder-slate-500 focus:border-lobo-neon-blue outline-none transition-colors uppercase font-mono tracking-wider"
                    />
                    <input 
                        type="text" 
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="TU APODO (Ej. LoboAlpha)"
                        className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-white placeholder-slate-500 focus:border-lobo-neon-blue outline-none transition-colors"
                        onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                    />
                    <button 
                      onClick={handleRegister} 
                      className="w-full bg-lobo-neon-blue hover:bg-blue-600 text-white font-bold py-3 rounded-lg shadow-lg transition-transform hover:-translate-y-1"
                    >
                        ENTRAR AHORA
                    </button>
                  </>
              ) : (
                  <>
                    <div className="bg-slate-800/50 p-4 rounded text-xs text-slate-400 mb-2 border border-slate-700">
                        👨‍🏫 <b>Modo Profesor:</b> Crea un código único para tu clase. Tus alumnos necesitarán este código para unirse.
                    </div>
                    <input 
                        type="text" 
                        value={gameCode}
                        onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                        placeholder="NUEVO CÓDIGO (Ej. FINANZAS-A)"
                        className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-white placeholder-slate-500 focus:border-lobo-neion-red outline-none transition-colors uppercase font-mono tracking-wider"
                    />
                    <button 
                      onClick={handleCreateSession} 
                      className="w-full bg-lobo-neion-red hover:bg-red-500 text-white font-bold py-3 rounded-lg shadow-lg transition-transform hover:-translate-y-1"
                    >
                        CREAR NUEVA SALA
                    </button>
                  </>
              )}

            {/* Mensajes de error/éxito */}
            {mensaje && (
              <p className={`text-center text-xs p-2 rounded ${mensaje.includes("✅") ? "bg-green-900/20 text-green-400" : "bg-yellow-900/20 text-yellow-500"}`}>
                {mensaje}
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-[10px] text-slate-600 text-center flex justify-between border-t border-slate-800 pt-2">
          <span>v5.2 (Reconexión Segura)</span>
          <span className={backendStatus.includes("En Línea") ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
            {backendStatus}
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;