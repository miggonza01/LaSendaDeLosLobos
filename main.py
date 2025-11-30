# ==============================================================================
# 📄 ARCHIVO: main.py (VERSIÓN FINAL: LOGICA 1.1 + BLINDAJE + RESET + EVENT CARDS 🃏)
# ==============================================================================

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
# Este gestor de contexto maneja el inicio y cierre de recursos (BD).
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    print("--- MOTOR DE JUEGO INICIADO: BD CONECTADA ---")
    yield
    print("--- SISTEMA APAGADO ---")

# --- INSTANCIA DE LA APP ---
app = FastAPI(
    title="La Senda de los Lobos",
    version="1.4.0 Event Cards", # Versión incrementada por funcionalidad visual
    lifespan=lifespan
)

# --- SEGURIDAD (CORS) ---
# Configuración permisiva para evitar bloqueos en despliegues cloud (Render/Vercel).
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
    """Endpoint de verificación de salud del sistema."""
    return {"estado": "En Línea 🟢", "mensaje": "Bienvenido a la Senda"}

@app.post("/players", response_model=PlayerRead, status_code=201)
async def registrar_jugador(jugador_entrada: PlayerCreate):
    """
    Registra un nuevo jugador. Valida unicidad del nickname en la BD.
    """
    existente = await Player.find_one(Player.nickname == jugador_entrada.nickname)
    if existente:
        raise HTTPException(status_code=400, detail="¡Ese apodo ya pertenece a otro lobo! Elige otro.")

    nuevo_jugador = Player(nickname=jugador_entrada.nickname)
    await nuevo_jugador.create()
    return nuevo_jugador

@app.get("/players", response_model=list[PlayerRead])
async def listar_jugadores():
    """Devuelve la lista completa de jugadores registrados."""
    return await Player.find_all().to_list()

# ⬇️⬇️⬇️ NUEVO BLOQUE INSERTADO (HERRAMIENTA DE SISTEMA) ⬇️⬇️⬇️

@app.delete("/reset_game", tags=["Sistema"])
async def reiniciar_juego():
    """
    ⚠️ ZONA DE PELIGRO: BORRADO TOTAL
    ---------------------------------
    Este endpoint elimina TODOS los documentos de la colección 'Players'.
    Se utiliza para reiniciar la partida y limpiar el Ranking Global.
    
    Verbo HTTP: DELETE
    Acción en BD: Player.delete_all() (Método destructivo de Beanie)
    """
    # 1. Ejecución de limpieza masiva en MongoDB
    await Player.delete_all()
    
    # 2. Confirmación al cliente (Feedback visual)
    return {"mensaje": "💥 ¡El meteorito ha caído! Todos los registros han sido borrados."}

# ⬆️⬆️⬆️ FIN DEL NUEVO BLOQUE ⬆️⬆️⬆️

# ==============================================================================
# RUTAS WEBSOCKET (MOTOR DE JUEGO EN TIEMPO REAL)
# ==============================================================================

@app.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    """
    Maneja la conexión persistente con el jugador.
    Incluye: Lógica de juego, Chat, Ranking en tiempo real y Manejo de Errores.
    """
    await manager.connect(websocket)

    # --------------------------------------------------------------------------
    # 🆕 FUNCIÓN AUXILIAR: ENVIAR RANKING GLOBAL (LEADERBOARD)
    # --------------------------------------------------------------------------
    async def enviar_ranking_global():
        """
        Consulta, formatea y emite el Top 5 de jugadores por Patrimonio Neto.
        """
        # 1. Consulta a MongoDB: Orden descendente (-) por net_worth
        top_players = await Player.find_all().sort("-financials.net_worth").limit(5).to_list()
        
        # 2. Serialización manual para JSON
        ranking_data = []
        for p in top_players:
            ranking_data.append({
                "nickname": p.nickname,
                "net_worth": str(p.financials.net_worth), # Decimal -> String
                "is_me": str(p.id) == player_id # Identificador para la UI del cliente
            })
            
        # 3. Broadcast del evento LEADERBOARD
        package = {
            "type": "LEADERBOARD",
            "payload": ranking_data
        }
        await manager.broadcast(json.dumps(package))

    try:
        # 🚀 INICIO: Enviar estado del ranking al conectar
        await enviar_ranking_global()

        while True:
            # Espera activa de mensajes del cliente
            data = await websocket.receive_text()
            
            # --- LÓGICA DE JUEGO PRINCIPAL ---
            if "lanzado los dados" in data:
                jugador_actual = await Player.get(player_id)
                
                if jugador_actual:
                    # 1. CÁLCULO DE MOVIMIENTO
                    dado = random.randint(1, 6)
                    posicion_previa = jugador_actual.position
                    nueva_posicion_bruta = posicion_previa + dado
                    
                    # 2. LOGICA DE VUELTA (PAYDAY)
                    mensaje_payday = ""
                    monto_payday_real = Decimal(0) # Variable para guardar cuánto ganamos realmente
                    CASILLAS_TOTALES = 20
                    
                    if nueva_posicion_bruta > CASILLAS_TOTALES:
                        # Jugador completó una vuelta
                        jugador_actual.position = nueva_posicion_bruta - CASILLAS_TOTALES
                        jugador_actual.laps_completed += 1
                        
                        # --- CORRECCIÓN MATEMÁTICA ---
                        # 1. Guardamos cuánto dinero tenía ANTES del pago
                        dinero_antes = jugador_actual.financials.cash
                        
                        # 2. Aplicamos la lógica (Salario - Intereses + Rentas)
                        jugador_actual.apply_payday_logic() 
                        
                        # 3. Calculamos la diferencia exacta para mostrarla
                        monto_payday_real = jugador_actual.financials.cash - dinero_antes
                        
                        mensaje_payday = " 💰 ¡PAYDAY! (Salario + Intereses)."
                    else:
                        jugador_actual.position = nueva_posicion_bruta
                    
                    # 3. RESOLUCIÓN DE EVENTOS (Casillas)
                    evento = obtener_evento(jugador_actual.position)
                    mensaje_evento = ""
                    
                    # --- Lógica de Lobo Negro (Conserva textos detallados del archivo original) ---
                    if evento and evento["tipo"] == "LOBO_NEGRO":
                        costo = Decimal(evento["costo"])
                        if jugador_actual.financials.cash >= costo:
                            jugador_actual.financials.cash -= costo
                            mensaje_evento = f" 📉 Pagaste ${costo} por {evento['titulo']}."
                        else:
                            # Mecánica de Deuda Tóxica
                            remanente = costo - jugador_actual.financials.cash
                            jugador_actual.financials.cash = Decimal(0)
                            jugador_actual.financials.toxic_debt += remanente
                            mensaje_evento = f" 🐺 ¡DEUDA TÓXICA! Compraste {evento['titulo']} a crédito."
                        jugador_actual.calculate_net_worth()

                    # --- Lógica de Lobo Blanco (Inversión) ---
                    elif evento and evento["tipo"] == "LOBO_BLANCO":
                        costo = Decimal(evento["costo"])
                        flujo = Decimal(evento["flujo_extra"])
                        if jugador_actual.financials.cash >= costo:
                            jugador_actual.financials.cash -= costo
                            jugador_actual.financials.passive_income += flujo
                            mensaje_evento = f" 📈 ¡INVERSIÓN! Compraste {evento['titulo']}. Ganas +${flujo}/vuelta."
                        else:
                            mensaje_evento = f" 🔒 Oportunidad perdida: {evento['titulo']}. Faltan ${costo}."
                        jugador_actual.calculate_net_worth()

                    # 4. PERSISTENCIA
                    await jugador_actual.save()
                    
                    # 5. VERIFICACIÓN DE VICTORIA
                    META_VICTORIA = Decimal("1000000.00") # Meta ajustada para testing
                    tipo_mensaje = "UPDATE_PLAYER"
                    mensaje_log = ""
                    
                    if jugador_actual.financials.net_worth >= META_VICTORIA:
                        tipo_mensaje = "VICTORY"
                        mensaje_log = f"🏆 ¡{jugador_actual.nickname} HA ESCAPADO DE LA CARRERA DE LA RATA!"
                    else:
                        mensaje_log = f"🎲 {jugador_actual.nickname} sacó un {dado} -> Casilla {jugador_actual.position}.{mensaje_payday}{mensaje_evento}"
                    
                    # ⬇️⬇️⬇️ NUEVO CÓDIGO INSERTADO (CARTAS VISUALES) ⬇️⬇️⬇️

                    # 6. PREPARAR DATOS DEL EVENTO (PARA LA CARTA VISUAL)
                    # Si hubo un evento (Lobo Negro/Blanco) o Payday, lo empaquetamos.
                    datos_carta = None
                    
                    if mensaje_payday:
                        # Formateamos el símbolo dependiendo si ganó o perdió dinero en el Payday
                        signo = "+" if monto_payday_real >= 0 else "-"
                        
                        datos_carta = {
                            "tipo": "PAYDAY",
                            "titulo": "¡DÍA DE PAGO!",
                            "descripcion": "Cobraste salario y rentas. El banco cobró intereses.",
                            # AQUI ESTÁ EL CAMBIO FINAL: Usamos el valor calculado
                            "monto": f"{signo} ${abs(monto_payday_real)}"
                        }
                    elif evento:
                        # Si caímos en una casilla especial
                        datos_carta = {
                            "tipo": evento["tipo"], # LOBO_NEGRO o LOBO_BLANCO
                            "titulo": evento["titulo"],
                            "descripcion": evento["descripcion"],
                            "monto": f"${evento.get('costo', 0)}"
                        }

                    # 7. ENVIAR PAQUETE (Ahora con 'last_event')
                    update_package = {
                        "type": tipo_mensaje, # VICTORY o UPDATE_PLAYER
                        "payload": {
                            "player_id": str(jugador_actual.id),
                            "new_position": jugador_actual.position,
                            "new_cash": str(jugador_actual.financials.cash),
                            "new_debt": str(jugador_actual.financials.toxic_debt),
                            "new_net_worth": str(jugador_actual.financials.net_worth),
                            "new_passive_income": str(jugador_actual.financials.passive_income),
                            
                            # --- NUEVO CAMPO: La carta a mostrar ---
                            "last_event": datos_carta 
                        },
                        "message": mensaje_log
                    }
                    
                    await manager.broadcast(json.dumps(update_package))
                    await enviar_ranking_global()

                    # ⬆️⬆️⬆️ FIN DEL NUEVO CÓDIGO ⬆️⬆️⬆️
            
            else:
                # Lógica de Chat
                chat_package = {
                    "type": "CHAT", 
                    "message": f"Jugador {player_id} > {data}"
                }
                await manager.broadcast(json.dumps(chat_package))
            
    # --- BLINDAJE DE CONEXIÓN ---
    except (WebSocketDisconnect, RuntimeError):
        manager.disconnect(websocket)
        try:
            # Intentamos notificar a los demás que el jugador se fue
            disconnect_msg = {
                "type": "SYSTEM", 
                "message": f"--- {player_id} desconectado ---"
            }
            await manager.broadcast(json.dumps(disconnect_msg))
        except:
            pass