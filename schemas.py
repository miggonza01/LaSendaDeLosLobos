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


# 2. INPUT: Lo que el usuario envía para registrarse
class PlayerCreate(BaseModel):
    nickname: str = Field(..., min_length=3, max_length=20, description="Tu nombre único")


# 3. OUTPUT: Lo que mostramos al público
class PlayerRead(BaseModel):
    # --- AQUÍ ESTABA EL ERROR ---
    # Usamos nuestro tipo personalizado PyObjectId en lugar de Optional[str] simple
    id: Optional[PyObjectId] = Field(None, alias="_id") 
    
    nickname: str
    position: int
    
    # Datos financieros
    financials: FinancialSchema 
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)