# ==============================================================================
# 📄 ARCHIVO: main.py (VERSIÓN DEFINITIVA: 2.0.0 MASTER HYBRID)
# ==============================================================================
# Esta versión fusiona la corrección de base de datos (Atomic Ranking)
# con la corrección de interfaz (Event Queue) sin perder ninguna funcionalidad.

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
# --- IMPORTACIÓN CRÍTICA PARA MATEMÁTICAS FINANCIERAS (No usar Float) ---
from decimal import Decimal 
# ------------------------------------------------------------------------
import random
import json

# Importaciones locales del proyecto
from database import init_db
from models import Player
from schemas import PlayerCreate, PlayerRead
from connection_manager import manager
from board import obtener_evento

# --- CICLO DE VIDA (LIFESPAN) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    print("--- MOTOR DE JUEGO INICIADO: BD CONECTADA ---")
    yield
    print("--- SISTEMA APAGADO ---")

# --- INSTANCIA DE LA APP ---
app = FastAPI(
    title="La Senda de los Lobos",
    version="2.0.0 Master Hybrid", 
    lifespan=lifespan
)

# --- SEGURIDAD (CORS) ---
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# RUTAS HTTP (API REST)
# ==============================================================================

@app.get("/")
def bienvenida():
    return {"estado": "En Línea 🟢", "mensaje": "Bienvenido a la Senda"}

@app.post("/players", response_model=PlayerRead, status_code=201)
async def registrar_jugador(jugador_entrada: PlayerCreate):
    existente = await Player.find_one(Player.nickname == jugador_entrada.nickname)
    if existente:
        raise HTTPException(status_code=400, detail="¡Ese apodo ya pertenece a otro lobo! Elige otro.")

    nuevo_jugador = Player(nickname=jugador_entrada.nickname)
    await nuevo_jugador.create()
    return nuevo_jugador

@app.get("/players", response_model=list[PlayerRead])
async def listar_jugadores():
    return await Player.find_all().to_list()

@app.delete("/reset_game", tags=["Sistema"])
async def reiniciar_juego():
    await Player.delete_all()
    return {"mensaje": "💥 ¡El meteorito ha caído! Todos los registros han sido borrados."}

# ==============================================================================
# RUTAS WEBSOCKET (MOTOR DE JUEGO EN TIEMPO REAL)
# ==============================================================================

@app.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    await manager.connect(websocket)
    
    # --- FUNCIÓN DE RANKING (Scope Local) ---
    async def enviar_ranking_global():
        # Orden Descendente (El más rico primero: -financials.net_worth)
        top_players = await Player.find_all().sort("-financials.net_worth").limit(5).to_list()
        ranking_data = []
        for p in top_players:
            ranking_data.append({
                "nickname": p.nickname,
                # Convertimos Decimal a string para envío seguro
                "net_worth": str(p.financials.net_worth), 
                "is_me": str(p.id) == player_id
            })
        
        await manager.broadcast(json.dumps({
            "type": "LEADERBOARD",
            "payload": ranking_data
        }))

    try:
        # Enviar ranking inicial al conectar
        await enviar_ranking_global()

        while True:
            data = await websocket.receive_text()
            
            if "lanzado los dados" in data:
                jugador_actual = await Player.get(player_id)
                
                if jugador_actual:
                    # ------------------------------------------------------
                    # 1. MECÁNICA DE MOVIMIENTO
                    # ------------------------------------------------------
                    dado = random.randint(1, 6)
                    nueva_posicion = jugador_actual.position + dado
                    
                    # Variables locales para lógica de eventos
                    mensaje_payday = ""
                    monto_payday_real = Decimal(0)
                    CASILLAS_TOTALES = 20
                    
                    # 🚨 RESTAURADO: COLA DE EVENTOS (Para Frontend v4.4)
                    cola_de_eventos = [] 
                    
                    # ------------------------------------------------------
                    # 2. MECÁNICA DE PAYDAY (VUELTA COMPLETA)
                    # ------------------------------------------------------
                    if nueva_posicion > CASILLAS_TOTALES:
                        jugador_actual.position = nueva_posicion - CASILLAS_TOTALES
                        jugador_actual.laps_completed += 1
                        
                        # Cálculo diferencial para saber cuánto ganamos exactamente
                        dinero_antes = jugador_actual.financials.cash
                        jugador_actual.apply_payday_logic() 
                        monto_payday_real = jugador_actual.financials.cash - dinero_antes
                        
                        mensaje_payday = " 💰 ¡PAYDAY!."
                        
                        # 🚨 RESTAURADO: Agregar Payday a la cola
                        signo = "+" if monto_payday_real >= 0 else "-"
                        cola_de_eventos.append({
                            "tipo": "PAYDAY",
                            "titulo": "¡DÍA DE PAGO!",
                            "descripcion": "Cobraste salario y rentas. El banco cobró intereses.",
                            "monto": f"{signo} ${abs(monto_payday_real)}"
                        })
                    else:
                        jugador_actual.position = nueva_posicion
                    
                    # ------------------------------------------------------
                    # 3. MECÁNICA DE EVENTOS (CASILLAS)
                    # ------------------------------------------------------
                    evento = obtener_evento(jugador_actual.position)
                    
                    # Variables para feedback visual
                    descripcion_visual = evento["descripcion"] if evento else ""
                    monto_visual = None
                    mensaje_evento = ""
                    
                    if evento:
                        # --- CASO A: LOBO NEGRO (GASTO/DEUDA) ---
                        if evento["tipo"] == "LOBO_NEGRO":
                            costo = Decimal(evento["costo"])
                            monto_visual = f"-${costo}"
                            
                            if jugador_actual.financials.cash >= costo:
                                jugador_actual.financials.cash -= costo
                                mensaje_evento = f" 📉 Pagaste ${costo} por {evento['titulo']}."
                            else:
                                remanente = costo - jugador_actual.financials.cash
                                jugador_actual.financials.cash = Decimal(0)
                                jugador_actual.financials.toxic_debt += remanente
                                mensaje_evento = f" 🐺 ¡DEUDA! {evento['titulo']}."

                        # --- CASO B: LOBO BLANCO (INVERSIÓN) ---
                        elif evento["tipo"] == "LOBO_BLANCO":
                            costo = Decimal(evento["costo"])
                            flujo = Decimal(evento["flujo_extra"])
                            monto_visual = f"-${costo}"
                            
                            if jugador_actual.financials.cash >= costo:
                                jugador_actual.financials.cash -= costo
                                jugador_actual.financials.passive_income += flujo
                                mensaje_evento = f" 📈 ¡INVERSIÓN! {evento['titulo']}."
                            else:
                                mensaje_evento = f" 🔒 Sin fondos para: {evento['titulo']}."
                                descripcion_visual = "Oportunidad perdida por falta de efectivo."
                                monto_visual = None 

                        # --- CASO C: NEUTRO (NARRATIVA) ---
                        elif evento["tipo"] == "NEUTRO":
                            mensaje_evento = f" 🧘 {evento['titulo']}"
                            monto_visual = None

                        # 🚨 RESTAURADO: Agregar Evento a la cola
                        cola_de_eventos.append({
                            "tipo": evento["tipo"],
                            "titulo": evento["titulo"],
                            "descripcion": descripcion_visual,
                            "monto": monto_visual
                        })

                    # ------------------------------------------------------
                    # 4. RECÁLCULO FORZOSO DE PATRIMONIO (RANKING FIX)
                    # ------------------------------------------------------
                    # Calculamos el valor estimado de los activos (Ingreso Pasivo * 10).
                    valor_activos_estimado = jugador_actual.financials.passive_income * Decimal("10")
                    jugador_actual.calculate_net_worth(assets_value=valor_activos_estimado)

                    # ------------------------------------------------------
                    # 5. ESCRITURA ATÓMICA EN BD (RANKING FIX)
                    # ------------------------------------------------------
                    # Usamos .set() para escritura directa y evitar latencia de lectura posterior
                    await jugador_actual.set({
                        Player.position: jugador_actual.position,
                        Player.laps_completed: jugador_actual.laps_completed,
                        Player.financials: jugador_actual.financials
                    })
                    
                    # ------------------------------------------------------
                    # 6. ENVIAR RESPUESTA AL JUGADOR
                    # ------------------------------------------------------
                    META_VICTORIA = Decimal("1000000.00")
                    tipo_mensaje = "VICTORY" if jugador_actual.financials.net_worth >= META_VICTORIA else "UPDATE_PLAYER"
                    
                    mensaje_log = f"🎲 {jugador_actual.nickname} (Casilla {jugador_actual.position})"
                    if mensaje_payday: mensaje_log += mensaje_payday
                    if mensaje_evento: mensaje_log += mensaje_evento

                    update_package = {
                        "type": tipo_mensaje,
                        "payload": {
                            "player_id": str(jugador_actual.id),
                            "new_position": jugador_actual.position,
                            "new_cash": str(jugador_actual.financials.cash),
                            "new_debt": str(jugador_actual.financials.toxic_debt),
                            "new_net_worth": str(jugador_actual.financials.net_worth),
                            "new_passive_income": str(jugador_actual.financials.passive_income),
                            
                            # 🚨 CRÍTICO: Enviamos 'event_queue' (Lista), NO 'last_event'.
                            # Esto permite que el frontend v4.4 muestre múltiples cartas.
                            "event_queue": cola_de_eventos 
                        },
                        "message": mensaje_log
                    }
                    
                    await manager.broadcast(json.dumps(update_package))
                    
                    # 7. ACTUALIZAR RANKING GLOBAL
                    # Se ejecuta tras el .set() para asegurar datos frescos
                    await enviar_ranking_global()
                
            else:
                # Chat
                chat_package = {"type": "CHAT", "message": f"Jugador {player_id} > {data}"}
                await manager.broadcast(json.dumps(chat_package))
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        try:
            await manager.broadcast(json.dumps({"type": "SYSTEM", "message": f"--- {player_id} desconectado ---"}))
        except:
            pass