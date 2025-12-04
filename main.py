# ==============================================================================
# 📄 ARCHIVO: main.py (VERSIÓN 3.2: VISIBILIDAD TOTAL)
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
    print("--- 🚀 MOTOR LISTO v3.2 ---")
    yield
    print("--- 🛑 APAGANDO ---")

app = FastAPI(title="La Senda de los Lobos", version="3.2.0", lifespan=lifespan)

origins = ["*"] 
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- RUTAS HTTP ---
@app.get("/")
def bienvenida():
    return {"estado": "En Línea 🟢"}

@app.post("/sessions", response_model=SessionRead, status_code=201)
async def crear_sesion(sesion_entrada: SessionCreate):
    existente = await GameSession.find_one(GameSession.code == sesion_entrada.code)
    if existente:
        raise HTTPException(status_code=400, detail="¡Código en uso!")
    
    # Si viene None, usamos defaults
    salario = sesion_entrada.salary if sesion_entrada.salary is not None else Decimal("2500.00")
    meta = sesion_entrada.winning_score if sesion_entrada.winning_score is not None else Decimal("1000000.00")

    nueva_sesion = GameSession(code=sesion_entrada.code, salary=salario, winning_score=meta)
    await nueva_sesion.create()
    return nueva_sesion

@app.post("/players", response_model=PlayerRead, status_code=201)
async def registrar_jugador(jugador_entrada: PlayerCreate):
    sesion = await GameSession.find_one(GameSession.code == jugador_entrada.game_code)
    if not sesion:
        raise HTTPException(status_code=404, detail="Código de sala no válido")

    existente = await Player.find_one(
        Player.nickname == jugador_entrada.nickname,
        Player.session_id == str(sesion.id)
    )
    if existente:
        raise HTTPException(status_code=400, detail="Nombre ocupado en esta sala.")

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
        
        # Recuperar reglas
        sesion_actual = await GameSession.get(session_id)
        SALARIO = sesion_actual.salary if sesion_actual else Decimal("2500.00")
        META = sesion_actual.winning_score if sesion_actual else Decimal("1000000.00")

        await manager.connect(websocket, session_id)
        
        async def enviar_ranking():
            top = await Player.find(Player.session_id == session_id).sort("-financials.net_worth").limit(10).to_list()
            data = [{"nickname": p.nickname, "net_worth": str(p.financials.net_worth), "is_me": str(p.id) == player_id} for p in top]
            await manager.broadcast(json.dumps({"type": "LEADERBOARD", "payload": data}), session_id)

        await enviar_ranking()

        while True:
            data = await websocket.receive_text()
            
            if "lanzado los dados" in data:
                jugador_actual = await Player.get(player_id)
                if not jugador_actual: break

                # 1. Movimiento
                dado = random.randint(1, 6)
                pos = jugador_actual.position + dado
                msg_payday = ""
                cola = []
                
                # 2. Payday
                if pos > CASILLAS_TOTALES:
                    jugador_actual.position = pos - CASILLAS_TOTALES
                    jugador_actual.laps_completed += 1
                    dinero_prev = jugador_actual.financials.cash
                    jugador_actual.apply_payday_logic(salary_amount=SALARIO)
                    diff = jugador_actual.financials.cash - dinero_prev
                    msg_payday = " 💰 ¡PAYDAY!"
                    cola.append({"tipo": "PAYDAY", "titulo": "¡PAYDAY!", "descripcion": "Salario + Rentas.", "monto": f"+${diff}"})
                else:
                    jugador_actual.position = pos
                
                # 3. Eventos
                evt = obtener_evento(jugador_actual.position)
                desc = evt["descripcion"] if evt else ""
                monto = None
                
                if evt:
                    if evt["tipo"] == "LOBO_NEGRO":
                        costo = Decimal(evt["costo"])
                        monto = f"-${costo}"
                        if jugador_actual.financials.cash >= costo:
                            jugador_actual.financials.cash -= costo
                        else:
                            rem = costo - jugador_actual.financials.cash
                            jugador_actual.financials.cash = Decimal(0)
                            jugador_actual.financials.toxic_debt += rem
                    
                    elif evt["tipo"] == "LOBO_BLANCO":
                        costo = Decimal(evt["costo"])
                        flujo = Decimal(evt["flujo_extra"])
                        monto = f"-${costo}"
                        if jugador_actual.financials.cash >= costo:
                            jugador_actual.financials.cash -= costo
                            jugador_actual.financials.passive_income += flujo
                        else:
                            desc = "Oportunidad perdida por falta de efectivo."
                            monto = None

                    cola.append({"tipo": evt["tipo"], "titulo": evt["titulo"], "descripcion": desc, "monto": monto})

                # 4. Guardado
                val_activos = jugador_actual.financials.passive_income * Decimal("10")
                jugador_actual.calculate_net_worth(assets_value=val_activos)
                await jugador_actual.set({
                    Player.position: jugador_actual.position,
                    Player.laps_completed: jugador_actual.laps_completed,
                    Player.financials: jugador_actual.financials
                })

                # 5. Respuesta
                tipo_msg = "VICTORY" if jugador_actual.financials.net_worth >= META else "UPDATE_PLAYER"
                log = f"🎲 {jugador_actual.nickname} sacó un {dado} -> Casilla {jugador_actual.position}"

                pkg = {
                    "type": tipo_msg,
                    "payload": {
                        "player_id": str(jugador_actual.id),
                        "nickname": jugador_actual.nickname, # Enviamos nombre para que el profe sepa quién jugó
                        "new_position": jugador_actual.position,
                        "dice_value": dado, # <--- DATO NUEVO: Valor del dado
                        "game_target": str(META), # <--- DATO NUEVO: Meta del juego
                        "new_cash": str(jugador_actual.financials.cash),
                        "new_debt": str(jugador_actual.financials.toxic_debt),
                        "new_net_worth": str(jugador_actual.financials.net_worth),
                        "new_passive_income": str(jugador_actual.financials.passive_income),
                        "event_queue": cola
                    },
                    "message": log
                }
                await manager.broadcast(json.dumps(pkg), session_id)
                await enviar_ranking()

            else:
                await manager.broadcast(json.dumps({"type": "CHAT", "message": f"💬 {data}"}), session_id)

    except WebSocketDisconnect:
        if session_id: manager.disconnect(websocket, session_id)
    except Exception as e:
        if session_id: manager.disconnect(websocket, session_id)