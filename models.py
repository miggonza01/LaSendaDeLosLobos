from beanie import Document
from pydantic import BaseModel, Field, BeforeValidator
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from typing import Annotated, Optional
from bson import Decimal128

# ==============================================================================
# 🔧 HERRAMIENTA DE TRADUCCIÓN (BSON -> PYTHON)
# ==============================================================================
def convert_decimal(v):
    """
    Si recibimos un Decimal128 de MongoDB, lo convertimos a Decimal de Python.
    Si ya es Decimal o float, lo dejamos pasar.
    """
    if isinstance(v, Decimal128):
        return v.to_decimal()
    return v

# Definimos un "Super Tipo" de Decimal que sabe autoconvertirse.
# Annotated le dice a Pydantic: "Antes de validar, pasa el dato por convert_decimal"
PyDecimal = Annotated[Decimal, BeforeValidator(convert_decimal)]

# ==============================================================================
# MODELOS DE DATOS
# ==============================================================================

# --- INPUT: Lo que el usuario nos envía ---
class PlayerRegistration(BaseModel):
    nickname: str = Field(..., min_length=3, max_length=20, description="Tu nombre de Lobo")

# --- MODELO INTERNO: LA HOJA DE BALANCE ---
class FinancialState(BaseModel):
    # NOTA: Usamos PyDecimal en lugar de Decimal puro para evitar el error de validación
    
    cash: PyDecimal = Field(default=Decimal("0.00"), max_digits=20, decimal_places=2)
    # Efectivo disponible.
    
    net_worth: PyDecimal = Field(default=Decimal("0.00"), alias="netWorth")
    # Patrimonio Neto.
    
    toxic_debt: PyDecimal = Field(default=Decimal("0.00"), alias="toxicDebt")
    # Deuda Mala.
    
    passive_income: PyDecimal = Field(default=Decimal("0.00"), alias="passiveIncome")
    # Flujo de caja.

    class Config:
        # Esto ayuda a serializar a JSON
        json_encoders = {Decimal: str}
        populate_by_name = True

# --- MODELO PRINCIPAL: EL JUGADOR ---
class Player(Document):
    nickname: str
    financials: FinancialState = Field(default_factory=FinancialState)
    position: int = 0
    laps_completed: int = 0
    is_frozen: bool = False
    created_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "players"

    class Config:
        json_schema_extra = {
            "example": {
                "nickname": "LoboDeWallSt",
                "position": 0,
                "laps_completed": 0
            }
        }

    # ==========================================
    # 🧠 CEREBRO MATEMÁTICO (Lógica de Negocio)
    # ==========================================

    def calculate_net_worth(self, assets_value: Decimal = Decimal("0.00")):
        """
        Fórmula: Patrimonio = (Activos + Efectivo) - (Deudas)
        """
        total_assets = self.financials.cash + assets_value
        total_liabilities = self.financials.toxic_debt
        
        self.financials.net_worth = total_assets - total_liabilities
        return self.financials.net_worth

    def apply_payday_logic(self):
        """
        Evento PAYDAY: Salario + Ingreso Pasivo - Interés Deuda
        """
        SALARY = Decimal("1000.00")
        INTEREST_RATE = Decimal("0.05") 

        # 1. INGRESOS (Salario + Lo que ganan tus activos)
        # --- CAMBIO AQUÍ ---
        total_income = SALARY + self.financials.passive_income
        self.financials.cash += total_income

        # 2. Castigo por Deuda (Interés Compuesto)
        if self.financials.toxic_debt > 0:
            interest = self.financials.toxic_debt * INTEREST_RATE
            interest = interest.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            self.financials.toxic_debt += interest

        # Recalculamos el patrimonio neto
        self.calculate_net_worth()