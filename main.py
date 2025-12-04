# ==============================================================================
# 📄 ARCHIVO: main.py
# 🛠️ VERSIÓN: 4.0.0 (DECISIONES INTERACTIVAS)
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
from connection_manager import manager 
from board import obtener_evento, CASILLAS_TOTALES

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    print("--- 🚀 MOTOR LISTO (v4.0 Interactive) ---")
    yield
    print("--- 🛑 APAGANDO ---")

app = FastAPI(title="La Senda de los Lobos", version="4.0.0", lifespan=lifespan)

origins = ["*"] 
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- RUTAS HTTP (Sin cambios) ---
@app.get("/")
def bienvenida(): return {"estado": "En Línea 🟢"}

@app.post("/sessions", response_model=SessionRead, status_code=201)
async def crear_sesion(sesion_entrada: SessionCreate):
    existente = await GameSession.find_one(GameSession.code == sesion_entrada.code)
    if existente: raise HTTPException(status_code=400, detail="¡Código en uso!")
    
    # Valores default seguros
    s = sesion_entrada.salary if sesion_entrada.salary is not None else Decimal("2500.00")
    w = sesion_entrada.winning_score if sesion_entrada.winning_score is not None else Decimal("1000000.00")
    
    nueva_sesion = GameSession(code=sesion_entrada.code, salary=s, winning_score=w)
    await nueva_sesion.create()
    return nueva_sesion

@app.post("/players", response_model=PlayerRead, status_code=201)
async def registrar_jugador(jugador_entrada: PlayerCreate):
    sesion = await GameSession.find_one(GameSession.code == jugador_entrada.game_code)
    if not sesion: raise HTTPException(status_code=404, detail="Código de sala no válido")

    existente = await Player.find_one(Player.nickname == jugador_entrada.nickname, Player.session_id == str(sesion.id))
    if existente: raise HTTPException(status_code=400, detail="Nombre ocupado en esta sala.")

    nuevo_jugador = Player(nickname=jugador_entrada.nickname, session_id=str(sesion.id))
    await nuevo_jugador.create()
    return nuevo_jugador

@app.delete("/reset_game", tags=["Sistema"])
async def reiniciar_juego():
    await Player.delete_all()
    await GameSession.delete_all()
    return {"mensaje": "💥 Base de datos purgada"}

# --- WEBSOCKET ENGINE ---
@app.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    await websocket.accept()
    session_id = None 
    
    try:
        jugador_inicial = await Player.get(player_id)
        if not jugador_inicial:
            await websocket.close(code=1008)
            return
        
        session_id = jugador_inicial.session_id
        
        # Cargar configuración de la sala
        sesion_actual = await GameSession.get(session_id)
        SALARIO = sesion_actual.salary if sesion_actual else Decimal("2500.00")
        META = sesion_actual.winning_score if sesion_actual else Decimal("1000000.00")

        await manager.connect(websocket, session_id)
        
        # Función para enviar Ranking y Tablero Visual
        async def broadcast_ranking():
            top = await Player.find(Player.session_id == session_id).sort("-financials.net_worth").limit(30).to_list()
            data = [{"id": str(p.id), "nickname": p.nickname, "net_worth": str(p.financials.net_worth), "position": p.position, "is_me": str(p.id) == player_id} for p in top]
            await manager.broadcast(json.dumps({"type": "LEADERBOARD", "payload": data}), session_id)

        # Función para enviar Estado del Jugador (Actualización)
        async def broadcast_player_update(jugador, cola_eventos, log_message):
            # Recalcular patrimonio final
            val_activos = jugador.financials.passive_income * Decimal("10")
            jugador.calculate_net_worth(assets_value=val_activos)
            
            # Guardado Forzoso
            await jugador.set({
                Player.position: jugador.position,
                Player.laps_completed: jugador.laps_completed,
                Player.financials: jugador.financials
            })

            # Check Victoria
            tipo_msg = "VICTORY" if jugador.financials.net_worth >= META else "UPDATE_PLAYER"
            
            pkg = {
                "type": tipo_msg,
                "payload": {
                    "player_id": str(jugador.id),
                    "nickname": jugador.nickname,
                    "new_position": jugador.position,
                    "new_cash": str(jugador.financials.cash),
                    "new_debt": str(jugador.financials.toxic_debt),
                    "new_net_worth": str(jugador.financials.net_worth),
                    "new_passive_income": str(jugador.financials.passive_income),
                    "event_queue": cola_eventos, # Aquí va la información para el historial
                    "game_target": str(META)
                },
                "message": log_message
            }
            await manager.broadcast(json.dumps(pkg), session_id)
            await broadcast_ranking()

        # Estado inicial al conectar
        await broadcast_ranking()

        # --- BUCLE DE MENSAJES ---
        while True:
            raw_msg = await websocket.receive_text()
            
            # Recargar jugador para asegurar estado fresco
            jugador_actual = await Player.get(player_id)
            if not jugador_actual: break

            # 1. MOVIMIENTO (ROLL)
            if "lanzado los dados" in raw_msg or raw_msg == "ROLL":
                dado = random.randint(1, 6)
                pos = jugador_actual.position + dado
                msg_payday = ""
                cola = []
                
                # Payday Logic
                if pos > CASILLAS_TOTALES:
                    jugador_actual.position = pos - CASILLAS_TOTALES
                    jugador_actual.laps_completed += 1
                    cash_pre = jugador_actual.financials.cash
                    jugador_actual.apply_payday_logic(salary_amount=SALARIO)
                    diff = jugador_actual.financials.cash - cash_pre
                    msg_payday = " 💰 ¡PAYDAY!"
                    cola.append({"tipo": "PAYDAY", "titulo": "¡PAYDAY!", "descripcion": "Salario + Rentas", "monto": f"+${diff}"})
                else:
                    jugador_actual.position = pos
                
                # Event Logic
                evt = obtener_evento(jugador_actual.position)
                log_base = f"🎲 {jugador_actual.nickname} sacó {dado} -> Casilla {jugador_actual.position}" + msg_payday

                if evt:
                    # CASO A: INVERSIÓN (LOBO BLANCO) -> DETENER Y PREGUNTAR
                    if evt["tipo"] == "LOBO_BLANCO":
                        # Guardamos posición y posibles cambios de Payday, pero NO cobramos aún
                        await jugador_actual.set({
                            Player.position: jugador_actual.position,
                            Player.laps_completed: jugador_actual.laps_completed,
                            Player.financials: jugador_actual.financials
                        })
                        
                        # Si hubo Payday, enviamos actualización visual primero para que se vea el dinero extra
                        if cola:
                            await broadcast_player_update(jugador_actual, cola, log_base)
                        
                        # Enviamos señal de Decisión
                        pkg_decision = {
                            "type": "DECISION_NEEDED",
                            "payload": {
                                "player_id": str(jugador_actual.id),
                                "event_data": evt,
                                "dice_value": dado
                            },
                            "message": f"🤔 {jugador_actual.nickname} está evaluando una inversión..."
                        }
                        await manager.broadcast(json.dumps(pkg_decision), session_id)
                        continue # INTERRUMPIR EL FLUJO AQUÍ

                    # CASO B: GASTO AUTOMÁTICO (LOBO NEGRO)
                    elif evt["tipo"] == "LOBO_NEGRO":
                        costo = Decimal(evt["costo"])
                        if jugador_actual.financials.cash >= costo:
                            jugador_actual.financials.cash -= costo
                        else:
                            rem = costo - jugador_actual.financials.cash
                            jugador_actual.financials.cash = Decimal(0)
                            jugador_actual.financials.toxic_debt += rem
                        cola.append({"tipo": "LOBO_NEGRO", "titulo": evt["titulo"], "descripcion": evt["descripcion"], "monto": f"-${costo}"})

                    # CASO C: NEUTRO
                    elif evt["tipo"] == "NEUTRO":
                        # Opcional: Agregar evento neutro a la cola si se desea mostrar tarjeta gris
                        pass

                # Finalizar turno automático (Si no fue inversión)
                await broadcast_player_update(jugador_actual, cola, log_base)

            # 2. COMPRA CONFIRMADA (BUY)
            elif raw_msg == "BUY":
                evt = obtener_evento(jugador_actual.position)
                cola = []
                log = ""
                
                if evt and evt["tipo"] == "LOBO_BLANCO":
                    costo = Decimal(evt["costo"])
                    flujo = Decimal(evt["flujo_extra"])
                    
                    if jugador_actual.financials.cash >= costo:
                        jugador_actual.financials.cash -= costo
                        jugador_actual.financials.passive_income += flujo
                        # Añadimos a la cola para que salga en el historial del profesor y alumnos
                        cola.append({"tipo": "LOBO_BLANCO", "titulo": evt["titulo"], "descripcion": "Inversión Exitosa", "monto": f"-${costo}"})
                        log = f"📈 {jugador_actual.nickname} compró {evt['titulo']}"
                    else:
                        cola.append({"tipo": "LOBO_BLANCO", "titulo": evt["titulo"], "descripcion": "Fondos insuficientes", "monto": None})
                        log = f"🚫 {jugador_actual.nickname} no pudo comprar (Sin fondos)"
                
                await broadcast_player_update(jugador_actual, cola, log)

            # 3. PASAR TURNO (PASS)
            elif raw_msg == "PASS":
                evt = obtener_evento(jugador_actual.position)
                titulo = evt["titulo"] if evt else "Oportunidad"
                # Enviamos evento informativo al historial
                log = f"⏭️ {jugador_actual.nickname} dejó pasar {titulo}"
                await broadcast_player_update(jugador_actual, [], log)

            # 4. CHAT
            else:
                await manager.broadcast(json.dumps({"type": "CHAT", "message": f"💬 {jugador_actual.nickname}: {raw_msg}"}), session_id)

    except WebSocketDisconnect:
        if session_id: manager.disconnect(websocket, session_id)
    except Exception as e:
        if session_id: manager.disconnect(websocket, session_id)