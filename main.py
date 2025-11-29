# ==============================================================================
# 📄 ARCHIVO: main.py (VERSIÓN BLINDADA Y CORREGIDA)
# ==============================================================================

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
# --- IMPORTACIÓN CRÍTICA PARA MATEMÁTICAS FINANCIERAS ---
from decimal import Decimal 
# --------------------------------------------------------
import random
import json

# Importaciones locales
from database import init_db
from models import Player
from schemas import PlayerCreate, PlayerRead
from connection_manager import manager
from board import obtener_evento

# --- CICLO DE VIDA ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    print("--- MOTOR DE JUEGO INICIADO: BD CONECTADA ---")
    yield
    print("--- SISTEMA APAGADO ---")

# --- INSTANCIA DE LA APP ---
app = FastAPI(
    title="La Senda de los Lobos",
    version="0.4.1 Fix",
    lifespan=lifespan
)

# --- SEGURIDAD (CORS) ---
origins = ["*"]
#    "http://localhost:5173",
#    "http://127.0.0.1:5173",
#]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# RUTAS HTTP
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

# ==============================================================================
# RUTAS WEBSOCKET (MOTOR DE JUEGO)
# ==============================================================================

@app.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            
            # --- LÓGICA DE JUEGO ---
            if "lanzado los dados" in data:
                jugador_actual = await Player.get(player_id)
                
                if jugador_actual:
                    # 1. MOVER
                    dado = random.randint(1, 6)
                    posicion_previa = jugador_actual.position
                    nueva_posicion_bruta = posicion_previa + dado
                    
                    # 2. PROCESAR VUELTA (PAYDAY)
                    mensaje_payday = ""
                    CASILLAS_TOTALES = 20
                    
                    if nueva_posicion_bruta > CASILLAS_TOTALES:
                        jugador_actual.position = nueva_posicion_bruta - CASILLAS_TOTALES
                        jugador_actual.laps_completed += 1
                        jugador_actual.apply_payday_logic()
                        mensaje_payday = " 💰 ¡PAYDAY! (Salario + Intereses)."
                    else:
                        jugador_actual.position = nueva_posicion_bruta
                    
                    # 3. CHEQUEO DE EVENTOS (EL LOBO MUERDE)
                    evento = obtener_evento(jugador_actual.position)
                    mensaje_evento = ""
                    
                    if evento and evento["tipo"] == "LOBO_NEGRO":
                        # Convertimos el costo a Decimal para operar con dinero
                        # ESTA LÍNEA ES LA QUE FALLABA ANTES
                        costo = Decimal(evento["costo"])
                        
                        if jugador_actual.financials.cash >= costo:
                            jugador_actual.financials.cash -= costo
                            mensaje_evento = f" 📉 Pagaste ${costo} por {evento['titulo']}."
                        else:
                            remanente = costo - jugador_actual.financials.cash
                            jugador_actual.financials.cash = Decimal(0)
                            jugador_actual.financials.toxic_debt += remanente
                            mensaje_evento = f" 🐺 ¡DEUDA TÓXICA! Compraste {evento['titulo']} a crédito."
                        
                        # Recalcular patrimonio
                        jugador_actual.calculate_net_worth()

                        # ... (Bloque if evento["tipo"] == "LOBO_NEGRO" termina arriba) ...

                    elif evento and evento["tipo"] == "LOBO_BLANCO":
                        costo = Decimal(evento["costo"])
                        flujo = Decimal(evento["flujo_extra"])
                        
                        # Lógica de Compra Automática (Si tienes cash, inviertes)
                        if jugador_actual.financials.cash >= costo:
                            # 1. Pagamos
                            jugador_actual.financials.cash -= costo
                            
                            # 2. Aumentamos nuestro Ingreso Pasivo (La clave de la riqueza)
                            jugador_actual.financials.passive_income += flujo
                            
                            mensaje_evento = f" 📈 ¡INVERSIÓN! Compraste {evento['titulo']}. Ahora ganas +${flujo}/vuelta."
                        else:
                            mensaje_evento = f" 🔒 Oportunidad perdida: {evento['titulo']}. Necesitabas ${costo}."
                        
                        jugador_actual.calculate_net_worth()

                    # 4. GUARDAR
                    await jugador_actual.save()
                    
                    # 5. INFORMAR AL FRONTEND
                    mensaje_log = f"🎲 {jugador_actual.nickname} sacó un {dado} -> Casilla {jugador_actual.position}.{mensaje_payday}{mensaje_evento}"
                    
                    update_package = {
                        "type": "UPDATE_PLAYER",
                        "payload": {
                            "player_id": str(jugador_actual.id),
                            "new_position": jugador_actual.position,
                            "new_cash": str(jugador_actual.financials.cash),
                            "new_debt": str(jugador_actual.financials.toxic_debt),
                            "new_net_worth": str(jugador_actual.financials.net_worth),
                            "new_passive_income": str(jugador_actual.financials.passive_income)
                        },
                        "message": mensaje_log
                    }
                    
                    await manager.broadcast(json.dumps(update_package))
                
            else:
                # Chat normal
                chat_package = {
                    "type": "CHAT",
                    "message": f"Jugador {player_id} > {data}"
                }
                await manager.broadcast(json.dumps(chat_package))
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        disconnect_package = {
            "type": "SYSTEM",
            "message": f"--- {player_id} se desconectó ---"
        }
        await manager.broadcast(json.dumps(disconnect_package))