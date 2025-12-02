# ==============================================================================
# 📄 ARCHIVO: database.py (VERSIÓN 2.0: SOPORTE MULTI-MODELO)
# ==============================================================================

import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from dotenv import load_dotenv

# --- IMPORTACIÓN DE MODELOS (ENTIDADES) ---
# Ahora importamos tanto el Jugador (Player) como la Sesión (GameSession).
# Esto conecta la lógica de Python con las colecciones de MongoDB.
from models import Player, GameSession 

# Carga de variables de entorno (.env) para seguridad
load_dotenv()
MONGO_URL = os.getenv("MONGO_URI")

async def init_db():
    """
    Inicializa la conexión asíncrona con MongoDB Atlas.
    Registra todos los modelos de documentos para que Beanie (ODM) pueda usarlos.
    """
    
    # 1. Validación de seguridad
    if not MONGO_URL:
        print("🔴 ERROR CRÍTICO: No se encontró la variable MONGO_URI en el archivo .env")
        return

    # 2. Cliente Motor (El conductor asíncrono)
    client = AsyncIOMotorClient(MONGO_URL)
    
    # 3. Selección de Base de Datos (Usa la definida en la URI o 'test' por defecto)
    database = client.get_default_database()
    
    # 4. INICIALIZACIÓN DE BEANIE (REGISTRO DE MODELOS)
    # Aquí le decimos a la base de datos: "Estos son los tipos de objetos que vas a guardar".
    # --- CAMBIO CRÍTICO: Agregamos 'GameSession' a la lista ---
    await init_beanie(
        database=database, 
        document_models=[
            Player,       # Colección 'players'
            GameSession   # Colección 'game_sessions' (NUEVA)
        ]
    )
    
    print("--- 🟢 CONEXIÓN A BASE DE DATOS EXITOSA: JUGADORES Y SESIONES LISTOS ---")