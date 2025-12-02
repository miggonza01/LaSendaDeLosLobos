# ==============================================================================
# 📄 ARCHIVO: schemas.py (VERSIÓN 2.0: SESIONES Y DTOs)
# ==============================================================================

from pydantic import BaseModel, Field, ConfigDict, BeforeValidator
from decimal import Decimal
from typing import Optional, Annotated

# ==============================================================================
# 🔧 HERRAMIENTAS DE TRADUCCIÓN
# ==============================================================================

# 1. Convertidor de ObjectId a String
# Si MongoDB nos da un ObjectId, lo volvemos texto para que React lo entienda.
def stringify_id(v):
    if v is None:
        return None
    return str(v)

# Creamos un tipo de dato personalizado "PyObjectId"
# Esto le dice a Pydantic: "Antes de validar esto como string, pásalo por la función stringify_id"
PyObjectId = Annotated[str, BeforeValidator(stringify_id)]


# ==============================================================================
# SCHEMAS (Data Transfer Objects)
# ==============================================================================

# 1. SUB-SCHEMA: La parte financiera (Lectura)
class FinancialSchema(BaseModel):
    cash: Decimal
    net_worth: Decimal = Field(..., alias="netWorth")
    toxic_debt: Decimal = Field(..., alias="toxicDebt")
    passive_income: Decimal = Field(..., alias="passiveIncome")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ⬇️⬇️⬇️ NUEVOS SCHEMAS PARA GESTIÓN DE SESIONES (PROFESOR) ⬇️⬇️⬇️

class SessionCreate(BaseModel):
    """
    DTO para crear una nueva partida o clase.
    El profesor envía esto.
    """
    code: str = Field(..., min_length=3, max_length=20, description="Código único de la sala (Ej. CLASE-A)")

class SessionRead(BaseModel):
    """
    DTO para leer la información de una sesión.
    """
    id: Optional[PyObjectId] = Field(None, alias="_id")
    code: str
    is_active: bool

# ⬆️⬆️⬆️ FIN DE SCHEMAS DE SESIÓN ⬆️⬆️⬆️


# 2. INPUT: Lo que el usuario envía para registrarse (ACTUALIZADO)
class PlayerCreate(BaseModel):
    """
    Ahora el alumno debe enviar su Nickname Y el Código de la sala.
    """
    nickname: str = Field(..., min_length=3, max_length=20, description="Tu nombre único")
    
    # --- NUEVO CAMPO: CÓDIGO DE JUEGO ---
    # Vincula al jugador con una sesión específica creada por el profesor.
    game_code: str = Field(..., description="Código de la sala a la que te unes") 


# 3. OUTPUT: Lo que mostramos al público (ACTUALIZADO)
class PlayerRead(BaseModel):
    id: Optional[PyObjectId] = Field(None, alias="_id")
    nickname: str
    
    # --- NUEVO CAMPO: ID DE SESIÓN ---
    # Útil para filtrar o depurar a qué partida pertenece el jugador
    session_id: str 
    
    position: int
    laps_completed: int = 0 # Mantenemos este campo para la lógica del frontend
    
    financials: FinancialSchema 

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)