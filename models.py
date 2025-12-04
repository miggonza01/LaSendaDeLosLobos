# ==============================================================================
# 📄 ARCHIVO: models.py
# 🔍 ROL: Definición de Esquemas de Base de Datos (Beanie)
# ==============================================================================

from beanie import Document
from pydantic import BaseModel, Field, BeforeValidator
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from typing import Annotated
from bson import Decimal128

# Helper para convertir Decimal128 de Mongo a Decimal de Python
def convert_decimal(v):
    if isinstance(v, Decimal128): return v.to_decimal()
    return v

PyDecimal = Annotated[Decimal, BeforeValidator(convert_decimal)]

# --- MODELO FINANCIERO EMBEBIDO ---
class FinancialState(BaseModel):
    cash: PyDecimal = Field(default=Decimal("0.00"), max_digits=20, decimal_places=2)
    net_worth: PyDecimal = Field(default=Decimal("0.00"), alias="netWorth")
    toxic_debt: PyDecimal = Field(default=Decimal("0.00"), alias="toxicDebt")
    passive_income: PyDecimal = Field(default=Decimal("0.00"), alias="passiveIncome")
    
    class Config:
        populate_by_name = True
        json_encoders = {Decimal: str}

# --- DOCUMENTO: SESIÓN DE JUEGO ---
class GameSession(Document):
    code: str
    created_at: datetime = Field(default_factory=datetime.now)
    is_active: bool = True
    # Configuración dinámica de la sala
    salary: PyDecimal = Field(default=Decimal("2500.00"))
    winning_score: PyDecimal = Field(default=Decimal("1000000.00"))
    
    class Settings:
        name = "game_sessions"

# --- DOCUMENTO: JUGADOR ---
class Player(Document):
    nickname: str
    session_id: str = "GLOBAL"
    financials: FinancialState = Field(default_factory=FinancialState)
    position: int = 0
    laps_completed: int = 0
    created_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "players"

    # Método de cálculo de patrimonio
    def calculate_net_worth(self, assets_value: Decimal = Decimal("0.00")):
        total_assets = self.financials.cash + assets_value
        total_liabilities = self.financials.toxic_debt
        self.financials.net_worth = total_assets - total_liabilities
        return self.financials.net_worth

    # Método de lógica Payday (recibe salario dinámico)
    def apply_payday_logic(self, salary_amount: Decimal):
        INTEREST_RATE = Decimal("0.05") 
        self.financials.cash += salary_amount + self.financials.passive_income
        
        if self.financials.toxic_debt > 0:
            interest = self.financials.toxic_debt * INTEREST_RATE
            self.financials.toxic_debt += interest.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        
        self.calculate_net_worth()