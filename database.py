import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from dotenv import load_dotenv

# --- NUEVA LÍNEA: Importamos el modelo Player ---
from models import Player 

load_dotenv()
MONGO_URL = os.getenv("MONGO_URI")

async def init_db():
    if not MONGO_URL:
        print("ERROR CRÍTICO: No se encontró la variable MONGO_URI en el archivo .env")
        return

    client = AsyncIOMotorClient(MONGO_URL)
    database = client.get_default_database()
    
    # --- LÍNEA MODIFICADA: Agregamos Player a la lista ---
    await init_beanie(database=database, document_models=[Player])
    
    print("--- CONEXIÓN A BASE DE DATOS EXITOSA Y MODELOS CARGADOS ---")