# ==============================================================================
# 📄 ARCHIVO: main.py 
# 🛠️ VERSIÓN: 3.3.0 (SOPORTE PARA TABLERO VISUAL)
# 📝 DESCRIPCIÓN: Backend principal. Se ha actualizado el payload del Ranking
#    para incluir coordenadas de posición, permitiendo el renderizado gráfico.
# ==============================================================================

# Framework y WebSockets
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
# Middleware para permitir conexiones desde el Frontend (React)
from fastapi.middleware.cors import CORSMiddleware
# Manejo del ciclo de vida (Startup/Shutdown)
from contextlib import asynccontextmanager
# Tipos de datos financieros exactos
from decimal import Decimal 
# Utilidades estándar
import random
import json

# --- MÓDULOS DEL PROYECTO ---
from database import init_db
from models import Player, GameSession 
from schemas import PlayerCreate, PlayerRead, SessionCreate, SessionRead
from connection_manager import manager 
# Importamos la lógica del tablero y constantes
from board import obtener_evento, CASILLAS_TOTALES

# --- CICLO DE VIDA ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Se ejecuta al iniciar la aplicación.
    Conecta a la Base de Datos antes de recibir tráfico.
    """
    await init_db()
    print("--- 🚀 MOTOR DE JUEGO LISTO (v3.3 Visual Support) ---")
    yield
    print("--- 🛑 APAGANDO SISTEMA ---")

# Instancia de la App
app = FastAPI(title="La Senda de los Lobos", version="3.3.0", lifespan=lifespan)

# Configuración de Seguridad (CORS)
# Permitimos todos los orígenes (*) para facilitar el desarrollo y despliegue.
origins = ["*"] 
app.add_middleware(
    CORSMiddleware, 
    allow_origins=origins, 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# ==============================================================================
# RUTAS HTTP (REST API)
# ==============================================================================

@app.get("/")
def bienvenida():
    return {"estado": "En Línea 🟢", "version": "3.3.0"}

@app.post("/sessions", response_model=SessionRead, status_code=201)
async def crear_sesion(sesion_entrada: SessionCreate):
    """
    Crea una nueva sala de juego con reglas personalizadas.
    """
    # 1. Validar unicidad del código
    existente = await GameSession.find_one(GameSession.code == sesion_entrada.code)
    if existente:
        raise HTTPException(status_code=400, detail="¡Código en uso!")
    
    # 2. Configurar reglas (usando defaults si no se proveen)
    salario = sesion_entrada.salary if sesion_entrada.salary is not None else Decimal("2500.00")
    meta = sesion_entrada.winning_score if sesion_entrada.winning_score is not None else Decimal("1000000.00")

    # 3. Guardar en BD
    nueva_sesion = GameSession(code=sesion_entrada.code, salary=salario, winning_score=meta)
    await nueva_sesion.create()
    return nueva_sesion

@app.post("/players", response_model=PlayerRead, status_code=201)
async def registrar_jugador(jugador_entrada: PlayerCreate):
    """
    Registra un alumno en una sala específica.
    """
    # 1. Validar existencia de la sala
    sesion = await GameSession.find_one(GameSession.code == jugador_entrada.game_code)
    if not sesion:
        raise HTTPException(status_code=404, detail="Código de sala no válido")

    # 2. Validar nombre único en esa sala
    existente = await Player.find_one(
        Player.nickname == jugador_entrada.nickname,
        Player.session_id == str(sesion.id)
    )
    if existente:
        raise HTTPException(status_code=400, detail="Nombre ocupado en esta sala.")

    # 3. Crear jugador
    nuevo_jugador = Player(nickname=jugador_entrada.nickname, session_id=str(sesion.id))
    await nuevo_jugador.create()
    return nuevo_jugador

@app.delete("/reset_game", tags=["Sistema"])
async def reiniciar_juego():
    """Botón de pánico: Borra todo."""
    await Player.delete_all()
    await GameSession.delete_all()
    return {"mensaje": "💥 Base de datos purgada"}

# ==============================================================================
# RUTAS WEBSOCKET (MOTOR EN TIEMPO REAL)
# ==============================================================================

@app.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    """
    Maneja la conexión persistente con cada jugador.
    Gestiona el flujo de juego, actualizaciones y eventos.
    """
    # 1. ACEPTAR CONEXIÓN (CRÍTICO: SIEMPRE PRIMERO)
    await websocket.accept()
    
    session_id = None 
    
    try:
        # 2. RECUPERAR DATOS DEL JUGADOR
        jugador_inicial = await Player.get(player_id)
        if not jugador_inicial:
            # Si el jugador no existe en BD (ej. tras un reset), cerramos con código de error.
            await websocket.close(code=1008)
            return
        
        session_id = jugador_inicial.session_id
        
        # 3. CARGAR REGLAS DE LA SALA (Salario y Meta)
        sesion_actual = await GameSession.get(session_id)
        # Defaults de seguridad por si la sesión fue borrada manualmente
        SALARIO = sesion_actual.salary if sesion_actual else Decimal("2500.00")
        META = sesion_actual.winning_score if sesion_actual else Decimal("1000000.00")

        # 4. REGISTRAR EN EL GESTOR DE CONEXIONES
        await manager.connect(websocket, session_id)
        
        # --- FUNCIÓN AUXILIAR: ENVIAR RANKING Y POSICIONES ---
        # Esta función actualiza la tabla de líderes Y el tablero visual.
        async def enviar_ranking_sala():
            # Aumentamos el límite a 30 para intentar mostrar a toda la clase en el tablero visual
            top_players = await Player.find(Player.session_id == session_id)\
                                      .sort("-financials.net_worth")\
                                      .limit(30).to_list()
            ranking_data = []
            for p in top_players:
                ranking_data.append({
                    "id": str(p.id),          # ID: Necesario para identificar la ficha única en el Frontend
                    "nickname": p.nickname,   # Nombre: Para mostrar en la tabla y tooltip
                    "net_worth": str(p.financials.net_worth), # Dinero: Para ordenar la tabla
                    "position": p.position,   # <--- DATO CRÍTICO: Coordenada para el Tablero SVG
                    "is_me": str(p.id) == player_id # Booleano: Para resaltar al usuario actual
                })
            
            # Broadcast del paquete LEADERBOARD a toda la sala
            await manager.broadcast(json.dumps({
                "type": "LEADERBOARD", 
                "payload": ranking_data
            }), session_id)

        # 5. ENVIAR ESTADO INICIAL AL CONECTARSE
        await enviar_ranking_sala()

        # 6. BUCLE PRINCIPAL (ESCUCHA DE MENSAJES)
        while True:
            data = await websocket.receive_text()
            
            # --- EVENTO: LANZAR DADOS ---
            if "lanzado los dados" in data:
                # Recargar jugador para asegurar datos frescos
                jugador_actual = await Player.get(player_id)
                if not jugador_actual: break

                # A. MECÁNICA DE MOVIMIENTO
                dado = random.randint(1, 6)
                pos = jugador_actual.position + dado
                msg_payday = ""
                cola = [] # Cola de eventos visuales
                
                # B. MECÁNICA DE PAYDAY (VUELTA AL TABLERO)
                if pos > CASILLAS_TOTALES:
                    jugador_actual.position = pos - CASILLAS_TOTALES
                    jugador_actual.laps_completed += 1
                    
                    dinero_prev = jugador_actual.financials.cash
                    # Aplicar salario configurado por el profesor
                    jugador_actual.apply_payday_logic(salary_amount=SALARIO)
                    diff = jugador_actual.financials.cash - dinero_prev
                    
                    msg_payday = " 💰 ¡PAYDAY!"
                    cola.append({
                        "tipo": "PAYDAY", "titulo": "¡PAYDAY!", 
                        "descripcion": "Salario + Rentas.", 
                        "monto": f"+${diff}"
                    })
                else:
                    jugador_actual.position = pos
                
                # C. MECÁNICA DE EVENTOS (CASILLAS)
                evt = obtener_evento(jugador_actual.position)
                desc = evt["descripcion"] if evt else ""
                monto = None
                
                if evt:
                    # Gasto (Lobo Negro)
                    if evt["tipo"] == "LOBO_NEGRO":
                        costo = Decimal(evt["costo"])
                        monto = f"-${costo}"
                        if jugador_actual.financials.cash >= costo:
                            jugador_actual.financials.cash -= costo
                        else:
                            # Deuda automática
                            rem = costo - jugador_actual.financials.cash
                            jugador_actual.financials.cash = Decimal(0)
                            jugador_actual.financials.toxic_debt += rem
                    
                    # Inversión (Lobo Blanco)
                    elif evt["tipo"] == "LOBO_BLANCO":
                        costo = Decimal(evt["costo"])
                        flujo = Decimal(evt["flujo_extra"])
                        monto = f"-${costo}"
                        if jugador_actual.financials.cash >= costo:
                            jugador_actual.financials.cash -= costo
                            jugador_actual.financials.passive_income += flujo
                        else:
                            # Feedback de oportunidad perdida
                            desc = "Oportunidad perdida por falta de efectivo."
                            monto = None

                    # Agregar a la cola visual
                    cola.append({
                        "tipo": evt["tipo"], "titulo": evt["titulo"], 
                        "descripcion": desc, "monto": monto
                    })

                # D. GUARDADO Y CÁLCULO PATRIMONIAL
                # Valoramos activos a 10x su flujo para reflejar riqueza en el ranking
                val_activos = jugador_actual.financials.passive_income * Decimal("10")
                jugador_actual.calculate_net_worth(assets_value=val_activos)
                
                # Guardado atómico (.set)
                await jugador_actual.set({
                    Player.position: jugador_actual.position,
                    Player.laps_completed: jugador_actual.laps_completed,
                    Player.financials: jugador_actual.financials
                })

                # E. RESPUESTA AL CLIENTE
                # Verificar Victoria
                tipo_msg = "VICTORY" if jugador_actual.financials.net_worth >= META else "UPDATE_PLAYER"
                log = f"🎲 {jugador_actual.nickname} sacó un {dado} -> Casilla {jugador_actual.position}"

                # Paquete de actualización individual
                pkg = {
                    "type": tipo_msg,
                    "payload": {
                        "player_id": str(jugador_actual.id),
                        "nickname": jugador_actual.nickname, # Nombre para historial del profe
                        "new_position": jugador_actual.position,
                        "dice_value": dado, # Dato para animación de dado
                        "game_target": str(META), # Dato para barra de progreso
                        "new_cash": str(jugador_actual.financials.cash),
                        "new_debt": str(jugador_actual.financials.toxic_debt),
                        "new_net_worth": str(jugador_actual.financials.net_worth),
                        "new_passive_income": str(jugador_actual.financials.passive_income),
                        "event_queue": cola # Cartas a mostrar
                    },
                    "message": log
                }
                
                # Broadcast del evento del jugador a la sala
                await manager.broadcast(json.dumps(pkg), session_id)
                
                # F. ACTUALIZAR RANKING Y TABLERO VISUAL PARA TODOS
                await enviar_ranking_sala()

            # --- EVENTO: CHAT ---
            else:
                await manager.broadcast(json.dumps({
                    "type": "CHAT", 
                    "message": f"💬 {data}"
                }), session_id)

    # --- MANEJO DE DESCONEXIÓN ---
    except WebSocketDisconnect:
        if session_id: manager.disconnect(websocket, session_id)
    except Exception as e:
        # Log de error silencioso para no ensuciar consola en producción
        # print(f"Error WS: {e}") 
        if session_id: manager.disconnect(websocket, session_id)