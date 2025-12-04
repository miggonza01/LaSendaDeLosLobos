# ==============================================================================
# 📄 ARCHIVO: database.py
# 🔍 ROL: Inicialización de Motor + Beanie
# ==============================================================================

import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from dotenv import load_dotenv
from models import Player, GameSession 

load_dotenv()
MONGO_URL = os.getenv("MONGO_URI")

async def init_db():
    if not MONGO_URL:
        print("🔴 ERROR: Falta MONGO_URI")
        return

    client = AsyncIOMotorClient(MONGO_URL)
    database = client.get_default_database()
    
    # Registramos ambos modelos
    await init_beanie(database=database, document_models=[Player, GameSession])
    print("--- 🟢 BD CONECTADA ---")