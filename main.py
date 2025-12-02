# ==============================================================================
# 📄 ARCHIVO: main.py (VERSIÓN 2.5.0: DEBUG & STABILITY IMPROVED)
# ==============================================================================
# CAMBIOS PRINCIPALES:
#   1. Mejor manejo de excepciones en WebSocket
#   2. Validación explícita de estado del socket
#   3. Logging más descriptivo para debugging
# ==============================================================================

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from decimal import Decimal 
import random
import json

from database import init_db
from models import Player, GameSession 
from schemas import PlayerCreate, PlayerRead, SessionCreate, SessionRead
from connection_manager import manager  # ← Ahora usa la versión 2.6
from board import obtener_evento

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestor de ciclo de vida de la aplicación.
    Inicializa la base de datos al arrancar.
    """
    await init_db()
    print("--- 🚀 MOTOR DE JUEGO INICIADO (v2.5) ---")
    yield
    print("--- 🛑 SISTEMA APAGADO ---")

# Configuración de la aplicación FastAPI
app = FastAPI(
    title="La Senda de los Lobos", 
    version="2.5.0", 
    lifespan=lifespan,
    description="Juego educativo de finanzas con soporte multi-sala"
)

# Configuración CORS (permitir conexiones desde frontend)
origins = ["*"]  # En producción, restringir a dominios específicos
app.add_middleware(
    CORSMiddleware, 
    allow_origins=origins, 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# --- RUTAS HTTP (Sin cambios críticos) ---
@app.get("/")
def bienvenida():
    return {"estado": "En Línea 🟢", "modo": "Multi-Sala Activo", "version": "2.5.0"}

@app.post("/sessions", response_model=SessionRead, status_code=201)
async def crear_sesion(sesion_entrada: SessionCreate):
    existente = await GameSession.find_one(GameSession.code == sesion_entrada.code)
    if existente:
        raise HTTPException(status_code=400, detail="¡Código en uso!")
    nueva_sesion = GameSession(code=sesion_entrada.code)
    await nueva_sesion.create()
    return nueva_sesion

@app.post("/players", response_model=PlayerRead, status_code=201)
async def registrar_jugador(jugador_entrada: PlayerCreate):
    sesion = await GameSession.find_one(GameSession.code == jugador_entrada.game_code)
    if not sesion:
        raise HTTPException(status_code=404, detail="¡Código de sala no existe!")

    existente = await Player.find_one(
        Player.nickname == jugador_entrada.nickname,
        Player.session_id == str(sesion.id)
    )
    if existente:
        raise HTTPException(status_code=400, detail="Nombre ocupado en esta sala.")

    nuevo_jugador = Player(nickname=jugador_entrada.nickname, session_id=str(sesion.id))
    await nuevo_jugador.create()
    return nuevo_jugador

@app.get("/players", response_model=list[PlayerRead])
async def listar_jugadores():
    return await Player.find_all().to_list()

@app.delete("/reset_game", tags=["Sistema"])
async def reiniciar_juego():
    await Player.delete_all()
    await GameSession.delete_all()
    return {"mensaje": "💥 Reset Global"}

# ==============================================================================
# 🎮 RUTA WEBSOCKET (MEJORADA Y ROBUSTA)
# ==============================================================================

@app.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    """
    Endpoint WebSocket principal para comunicación en tiempo real.
    
    Args:
        websocket: Conexión WebSocket establecida por el cliente
        player_id: ID único del jugador (proveniente de MongoDB)
    
    Flujo:
        1. Aceptar conexión (obligatorio antes de cualquier operación)
        2. Validar que el jugador exista en base de datos
        3. Registrar en el ConnectionManager
        4. Bucle principal de mensajes
        5. Limpieza al desconectar
    
    Mejoras v2.5:
        - Validación explícita después de accept()
        - Manejo granular de excepciones
        - Logging descriptivo para debugging
    """
    
    # [PASO 1] ACEPTAR CONEXIÓN (CRÍTICO)
    try:
        await websocket.accept()
        print(f"--- ✅ WS: Conexión aceptada para jugador {player_id[:8]}...")
    except Exception as e:
        print(f"--- ❌ WS: Error aceptando conexión para {player_id}: {e}")
        return  # Salir temprano si no se puede aceptar
    
    # Variables de sesión (para limpieza)
    session_id = None
    jugador_identificado = None
    
    try:
        # [PASO 2] VALIDAR JUGADOR EN BASE DE DATOS
        jugador_inicial = await Player.get(player_id)
        if not jugador_inicial:
            print(f"--- 🔴 WS: Jugador {player_id} no encontrado en BD. Cerrando.")
            await websocket.close(code=1008, reason="Jugador no encontrado")
            return
        
        jugador_identificado = jugador_inicial
        session_id = jugador_inicial.session_id
        print(f"--- 🔍 WS: Jugador '{jugador_inicial.nickname}' identificado, sala: {session_id}")
        
        # [PASO 3] REGISTRAR EN MANAGER (DESPUÉS de accept() y validación)
        await manager.connect(websocket, session_id)
        
        # --- FUNCIÓN AUXILIAR: ENVÍO DE RANKING ---
        async def enviar_ranking_sala():
            """Calcula y envía el ranking actualizado de la sala a todos."""
            try:
                # Obtener top 5 jugadores de esta sala, ordenados por patrimonio neto
                top_players = await Player.find(
                    Player.session_id == session_id
                ).sort("-financials.net_worth").limit(5).to_list()
                
                # Formatear datos para el frontend
                ranking_data = []
                for p in top_players:
                    ranking_data.append({
                        "nickname": p.nickname,
                        "net_worth": str(p.financials.net_worth), 
                        "is_me": str(p.id) == player_id
                    })
                
                # Broadcast del ranking actualizado
                await manager.broadcast(
                    json.dumps({
                        "type": "LEADERBOARD", 
                        "payload": ranking_data
                    }), 
                    session_id
                )
                
                print(f"--- 📈 WS: Ranking enviado a sala {session_id} ({len(ranking_data)} jugadores)")
                
            except Exception as e:
                print(f"--- ⚠️  WS: Error enviando ranking: {e}")
        
        # [PASO 4] ENVIAR ESTADO INICIAL AL CLIENTE
        await enviar_ranking_sala()
        
        # Mensaje de bienvenida personalizado
        welcome_msg = json.dumps({
            "type": "SYSTEM",
            "message": f"🎮 ¡Bienvenido {jugador_inicial.nickname}! Sala: {session_id}"
        })
        await websocket.send_text(welcome_msg)
        
        print(f"--- 🎯 WS: Jugador {jugador_inicial.nickname} listo en sala {session_id}")
        
        # [PASO 5] BUCLE PRINCIPAL DE MENSAJES
        while True:
            # Esperar mensaje del cliente (esto bloquea hasta recibir algo)
            data = await websocket.receive_text()
            print(f"--- 📨 WS: Mensaje recibido de {jugador_inicial.nickname}: {data[:50]}...")
            
            # DETECTAR LANZAMIENTO DE DADOS
            if "lanzado los dados" in data:
                # Recargar jugador desde BD (estado más reciente)
                jugador_actual = await Player.get(player_id)
                
                if not jugador_actual:
                    print(f"--- ⚠️  WS: Jugador {player_id} desapareció de BD durante partida")
                    break  # Salir del bucle
                
                # --- LÓGICA DE MOVIMIENTO ---
                dado = random.randint(1, 6)
                nueva_posicion = jugador_actual.position + dado
                
                mensaje_payday = ""
                CASILLAS_TOTALES = 20
                cola_de_eventos = []
                
                # Lógica Payday (completar vuelta)
                if nueva_posicion > CASILLAS_TOTALES:
                    jugador_actual.position = nueva_posicion - CASILLAS_TOTALES
                    jugador_actual.laps_completed += 1
                    
                    dinero_antes = jugador_actual.financials.cash
                    jugador_actual.apply_payday_logic()
                    monto_payday_real = jugador_actual.financials.cash - dinero_antes
                    
                    mensaje_payday = " 💰 ¡PAYDAY!."
                    signo = "+" if monto_payday_real >= 0 else "-"
                    
                    cola_de_eventos.append({
                        "tipo": "PAYDAY", 
                        "titulo": "¡PAYDAY!", 
                        "descripcion": "Salario + Rentas.", 
                        "monto": f"{signo} ${abs(monto_payday_real)}"
                    })
                else:
                    jugador_actual.position = nueva_posicion
                
                # --- LÓGICA DE EVENTOS (TABLERO) ---
                evento = obtener_evento(jugador_actual.position)
                descripcion_visual = evento["descripcion"] if evento else ""
                monto_visual = None
                
                if evento:
                    if evento["tipo"] == "LOBO_NEGRO":
                        costo = Decimal(evento["costo"])
                        monto_visual = f"-${costo}"
                        
                        if jugador_actual.financials.cash >= costo:
                            jugador_actual.financials.cash -= costo
                        else:
                            remanente = costo - jugador_actual.financials.cash
                            jugador_actual.financials.cash = Decimal(0)
                            jugador_actual.financials.toxic_debt += remanente

                    elif evento["tipo"] == "LOBO_BLANCO":
                        costo = Decimal(evento["costo"])
                        flujo = Decimal(evento["flujo_extra"])
                        monto_visual = f"-${costo}"
                        
                        if jugador_actual.financials.cash >= costo:
                            jugador_actual.financials.cash -= costo
                            jugador_actual.financials.passive_income += flujo
                        else:
                            descripcion_visual = "Oportunidad perdida por falta de efectivo."
                            monto_visual = None

                    # Agregar evento a la cola visual
                    cola_de_eventos.append({
                        "tipo": evento["tipo"] if evento else "NEUTRO", 
                        "titulo": evento["titulo"] if evento else "",
                        "descripcion": descripcion_visual, 
                        "monto": monto_visual
                    })

                # --- CÁLCULO DE PATRIMONIO NETO ---
                valor_activos_estimado = jugador_actual.financials.passive_income * Decimal("10")
                jugador_actual.calculate_net_worth(assets_value=valor_activos_estimado)

                # --- GUARDADO EN BASE DE DATOS ---
                await jugador_actual.set({
                    Player.position: jugador_actual.position,
                    Player.laps_completed: jugador_actual.laps_completed,
                    Player.financials: jugador_actual.financials
                })

                # --- VERIFICACIÓN DE VICTORIA ---
                META_VICTORIA = Decimal("1000000.00")
                tipo_mensaje = "VICTORY" if jugador_actual.financials.net_worth >= META_VICTORIA else "UPDATE_PLAYER"
                mensaje_log = f"🎲 {jugador_actual.nickname} ({jugador_actual.position})"
                
                if mensaje_payday:
                    mensaje_log += mensaje_payday

                # --- CONSTRUCCIÓN DE PAQUETE DE RESPUESTA ---
                pkg = {
                    "type": tipo_mensaje,
                    "payload": {
                        "player_id": str(jugador_actual.id),
                        "new_position": jugador_actual.position,
                        "new_cash": str(jugador_actual.financials.cash),
                        "new_debt": str(jugador_actual.financials.toxic_debt),
                        "new_net_worth": str(jugador_actual.financials.net_worth),
                        "new_passive_income": str(jugador_actual.financials.passive_income),
                        "event_queue": cola_de_eventos
                    },
                    "message": mensaje_log
                }
                
                # --- ENVÍO A TODA LA SALA ---
                await manager.broadcast(json.dumps(pkg), session_id)
                
                # --- ACTUALIZAR RANKING ---
                await enviar_ranking_sala()
                
                print(f"--- 🎲 WS: Dados procesados para {jugador_actual.nickname}, posición: {jugador_actual.position}")

            else:
                # MENSAJE DE CHAT SIMPLE
                chat_pkg = {
                    "type": "CHAT", 
                    "message": f"{jugador_inicial.nickname}: {data}"
                } 
                await manager.broadcast(json.dumps(chat_pkg), session_id)

    except WebSocketDisconnect as e:
        # [PASO 6A] DESCONEXIÓN LIMPIA (CLIENTE CERRÓ CONEXIÓN)
        print(f"--- 👋 WS: Desconexión limpia de {player_id} ({getattr(jugador_identificado, 'nickname', 'DESCONOCIDO')})")
        if session_id:
            manager.disconnect(websocket, session_id)
            
    except Exception as e:
        # [PASO 6B] ERROR INESPERADO
        error_type = type(e).__name__
        error_msg = str(e)
        
        print(f"--- ⚠️  [WS ERROR CRÍTICO]: {error_type}: {error_msg}")
        
        # Intentar enviar mensaje de error al cliente (si aún está conectado)
        try:
            error_response = json.dumps({
                "type": "SYSTEM",
                "message": f"Error interno: {error_type}"
            })
            await websocket.send_text(error_response)
        except:
            pass  # El socket ya está cerrado
        
        # Limpieza en el manager
        if session_id:
            manager.disconnect(websocket, session_id)
            
        print(f"--- 🧹 WS: Limpieza completada para error de {player_id}")