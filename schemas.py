# ==============================================================================
# 📄 ARCHIVO: schemas.py
# 🔍 ROL: Esquemas Pydantic para validación API
# ==============================================================================

from pydantic import BaseModel, Field, ConfigDict, BeforeValidator
from decimal import Decimal
from typing import Optional, Annotated

def stringify_id(v):
    if v is None: return None
    return str(v)

PyObjectId = Annotated[str, BeforeValidator(stringify_id)]

class FinancialSchema(BaseModel):
    cash: Decimal
    net_worth: Decimal = Field(..., alias="netWorth")
    toxic_debt: Decimal = Field(..., alias="toxicDebt")
    passive_income: Decimal = Field(..., alias="passiveIncome")
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

# DTO Crear Sesión (Input Profesor)
class SessionCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=20)
    salary: Optional[Decimal] = Field(default=None)
    winning_score: Optional[Decimal] = Field(default=None)

# DTO Leer Sesión (Output)
class SessionRead(BaseModel):
    id: Optional[PyObjectId] = Field(None, alias="_id")
    code: str
    is_active: bool
    salary: Decimal 
    winning_score: Decimal

# DTO Crear Jugador (Input Alumno)
class PlayerCreate(BaseModel):
    nickname: str = Field(..., min_length=3, max_length=20)
    game_code: str = Field(...)

# DTO Leer Jugador (Output WebSocket/API)
class PlayerRead(BaseModel):
    id: Optional[PyObjectId] = Field(None, alias="_id")
    nickname: str
    position: int
    session_id: str 
    financials: FinancialSchema 
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)