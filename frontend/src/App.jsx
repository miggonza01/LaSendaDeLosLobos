// =============================================================================
// 📄 ARCHIVO: src/App.jsx
// 📄 VERSIÓN: 4.2 (MASTER EDITION: Cloud + Victory + Leaderboard + Event Cards)
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';

// Importamos los componentes visuales externos para mantener el código limpio
import FinancialDisplay from './components/FinancialDisplay';
import Leaderboard from './components/Leaderboard'; 
import EventCard from './components/EventCard'; // <--- INTEGRACIÓN CARTA DE EVENTO (Paso 1: Importar)

// -----------------------------------------------------------------------------
// 🏆 COMPONENTE INTERNO: PANTALLA DE VICTORIA (MODAL)
// -----------------------------------------------------------------------------
// Se muestra sobre todo el juego cuando el servidor envía la señal "VICTORY".
const VictoryScreen = ({ nickname, onReset }) => (
  // 'fixed inset-0': Cubre toda la pantalla.
  // 'z-50': Asegura que esté encima de todo.
  // 'backdrop-blur-sm': Efecto de cristal borroso en el fondo.
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
  // ---------------------------------------------------------------------------
  // 1. CONFIGURACIÓN DE ENTORNO (CLOUD READY)
  // ---------------------------------------------------------------------------
  // Vite expone las variables de entorno con 'import.meta.env'.
  // Si VITE_API_URL existe (en Vercel), la usa. Si no, usa localhost (en tu PC).
  const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  // ---------------------------------------------------------------------------
  // 2. GESTIÓN DE ESTADO (MEMORIA REACTIVA)
  // ---------------------------------------------------------------------------
  
  // Datos del Usuario
  const [nickname, setNickname] = useState("");
  const [jugador, setJugador] = useState(null); // Objeto completo del jugador (dinero, posición, etc.)
  
  // Datos del Juego
  const [leaderboard, setLeaderboard] = useState([]); // Lista del Top 5
  const [winner, setWinner] = useState(false);        // ¿Alguien ganó?
  const [logs, setLogs] = useState([]);               // Historial del chat
  const [isRolling, setIsRolling] = useState(false);  // Animación de dados
  
  // INTEGRACIÓN CARTA DE EVENTO (Paso 2: Estado)
  // Almacena el objeto del evento actual (título, descripción) o null si no hay carta.
  const [currentCard, setCurrentCard] = useState(null);

  // Feedback del Sistema
  const [mensaje, setMensaje] = useState("");
  const [backendStatus, setBackendStatus] = useState("Conectando...");
  
  // Referencia mutable para el WebSocket (Persiste entre renderizados sin causar re-render)
  const ws = useRef(null);

  // ---------------------------------------------------------------------------
  // 🔧 FUNCIONES AUXILIARES
  // ---------------------------------------------------------------------------
  
  // Agrega mensajes al log visual (limitado a los últimos 5 para no saturar)
  const addLog = (text) => {
    setLogs((prev) => [text, ...prev].slice(0, 5));
  };

  // Limpia todo para volver a la pantalla de inicio (Login)
  const resetGame = () => {
    setJugador(null);
    setWinner(false);
    setNickname("");
    setLogs([]);
    setMensaje("");
    setLeaderboard([]);
    setCurrentCard(null); // Limpiamos carta si hubiera una
    // Cerramos el socket si existe
    if (ws.current) ws.current.close();
  };

  // ---------------------------------------------------------------------------
  // 3. HEALTH CHECK (VERIFICACIÓN DE VIDA)
  // ---------------------------------------------------------------------------
  // Se ejecuta una sola vez al cargar la página ([]).
  useEffect(() => {
    fetch(`${API_URL}/`)
      .then((res) => {
        if (res.ok) setBackendStatus("En Línea 🟢");
        else setBackendStatus("Error Servidor 🔴");
      })
      .catch(() => setBackendStatus("Desconectado 🔴"));
  }, [API_URL]);

  // ---------------------------------------------------------------------------
  // 4. MOTOR WEBSOCKET (COMUNICACIÓN EN TIEMPO REAL)
  // ---------------------------------------------------------------------------
  // Se ejecuta cada vez que el objeto 'jugador' cambia (al loguearse).
  useEffect(() => {
    if (jugador) {
      // A. Detección de Protocolo (Seguridad SSL)
      // Si la web está en HTTPS (Vercel), el socket DEBE ser WSS (Secure).
      const wsProtocol = API_URL.startsWith("https") ? "wss" : "ws";
      const wsBase = API_URL.replace(/^http(s)?:\/\//, ''); // Quitamos el http://
      
      // B. Abrir la conexión
      const socket = new WebSocket(`${wsProtocol}://${wsBase}/ws/${jugador._id}`);
      
      // C. Eventos del Socket
      socket.onopen = () => {
        addLog("✅ Conexión Neural Establecida");
      };

      socket.onmessage = (event) => {
        try {
          // Parseamos el mensaje JSON que viene de Python
          const data = JSON.parse(event.data);

          // INTEGRACIÓN CARTA DE EVENTO (Paso 3: WebSocket Logic)
          // Lógica Unificada de Actualización de Estado
          const updateData = () => {
             // Solo actualizamos si el mensaje es para MÍ id
             if (data.payload.player_id === jugador._id) {
                
                // 1. Actualizamos al Jugador (Datos Financieros y Posición)
                setJugador((prev) => ({
                    ...prev, // Mantenemos nombre e ID
                    position: data.payload.new_position,
                    financials: {
                      ...prev.financials,
                      cash: data.payload.new_cash,
                      toxicDebt: data.payload.new_debt,
                      netWorth: data.payload.new_net_worth,
                      passiveIncome: data.payload.new_passive_income 
                    }
                }));

                // 2. --- NUEVO: ¿HAY CARTA PARA MOSTRAR? ---
                // Si el backend envía 'last_event', lo guardamos en el estado 'currentCard'
                // Esto disparará el renderizado del componente <EventCard />
                if (data.payload.last_event) {
                    setCurrentCard(data.payload.last_event);
                }
            }
          };

          // --- ENRUTADOR DE MENSAJES ---
          
          if (data.type === "UPDATE_PLAYER") {
            // Movimiento normal o evento financiero
            addLog(data.message); 
            updateData(); // Llamamos a la nueva función unificada
          }
          else if (data.type === "LEADERBOARD") {
            // Actualización de la Tabla de Posiciones
            setLeaderboard(data.payload);
          } 
          else if (data.type === "VICTORY") {
            // Alguien ganó
            addLog(data.message);
            updateData(); // Actualizamos para ver los números finales
            
            // Si el ganador soy YO, mostramos la pantalla dorada
            if (data.payload.player_id === jugador._id) {
                setWinner(true);
            }
          }
          else if (data.type === "CHAT" || data.type === "SYSTEM") {
            addLog(data.message);
          }

        } catch (error) {
          console.error("Error procesando mensaje:", error);
          // Si falla el JSON, mostramos el texto crudo por seguridad
          addLog(event.data);
        }
      };

      socket.onclose = () => {
        addLog("❌ Conexión Cerrada");
      };

      // Guardamos la referencia para poder usarla fuera del useEffect (ej. al tirar dados)
      ws.current = socket;

      // D. Limpieza: Si el componente se desmonta, cerramos la conexión
      return () => {
        socket.close();
      };
    }
  }, [jugador, API_URL]); 

  // ---------------------------------------------------------------------------
  // 5. REGISTRO (API REST)
  // ---------------------------------------------------------------------------
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
        setJugador(data); // Esto activará el useEffect del WebSocket
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

  // ---------------------------------------------------------------------------
  // 6. ACCIONES DE JUEGO
  // ---------------------------------------------------------------------------
  const handleDiceRoll = () => {
    // Verificamos que el socket esté abierto antes de enviar
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      addLog("⚠️ Error: Sin conexión al servidor");
      return;
    }

    setIsRolling(true); // Activa animación visual
    
    // Retardo artificial para "sentir" el dado
    setTimeout(() => {
      ws.current.send(`🎲 ${jugador.nickname} ha lanzado los dados...`);
      setIsRolling(false);
    }, 800);
  };

  // ---------------------------------------------------------------------------
  // 7. RENDERIZADO (VISTA HTML/JSX)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-lobo-dark text-white p-4 font-mono transition-colors duration-500 relative">
      
      {/* CAPA DE VICTORIA (Condicional) */}
      {winner && <VictoryScreen nickname={jugador?.nickname} onReset={resetGame} />}

      {/* INTEGRACIÓN CARTA DE EVENTO (Paso 4: Renderizado) */}
      {/* Si existe una 'currentCard' en el estado, mostramos el componente. */}
      {/* Pasamos 'onClose' para que el componente pueda limpiarse a sí mismo (y al estado) al terminar. */}
      {currentCard && (
        <EventCard 
          eventData={currentCard} 
          onClose={() => setCurrentCard(null)} 
        />
      )}

      {/* CONTENEDOR PRINCIPAL */}
      <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden p-8 relative">
        
        {/* Barra Neón Decorativa */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-lobo-neion-red via-purple-500 to-lobo-neon-blue"></div>

        <h1 className="text-3xl font-bold mb-6 text-center tracking-tighter">
          LA SENDA <span className="text-lobo-neion-red">DE LOS LOBOS</span>
        </h1>

        {/* --- CAMBIO DE VISTAS --- */}
        {jugador ? (
          
          // === VISTA DE JUEGO (DASHBOARD) ===
          <div className="w-full animate-fade-in">
            
            {/* Cabecera */}
            <div className="flex justify-between items-end mb-4 border-b border-slate-800 pb-2">
              <h2 className="text-xl font-bold">Hola, {jugador.nickname}</h2>
              <button 
                className="text-xs text-red-400 underline hover:text-red-300" 
                onClick={resetGame}
              >
                Cerrar Sesión
              </button>
            </div>

            {/* 1. Panel Financiero */}
            <FinancialDisplay financials={jugador.financials} />

            {/* 2. Ranking Global */}
            <Leaderboard players={leaderboard} myNickname={jugador.nickname} />

            {/* 3. Zona de Acción (Dados) */}
            <div className="mt-4 bg-slate-800/50 p-6 rounded-lg border border-dashed border-slate-600 text-center relative overflow-hidden group">
              
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

            {/* 4. Log de Eventos */}
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
          
          // === VISTA DE LOGIN ===
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

        {/* Footer */}
        <div className="mt-8 text-[10px] text-slate-600 text-center flex justify-between border-t border-slate-800 pt-2">
          <span>v4.2 Master (Events)</span>
          <span className={backendStatus.includes("En Línea") ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{backendStatus}</span>
        </div>
      </div>
    </div>
  );
}

export default App;