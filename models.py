# ==============================================================================
# 📄 ARCHIVO: models.py (VERSIÓN 2.0: MULTI-SESIÓN Y FORMATO ROBUSTO)
# ==============================================================================

from beanie import Document
from pydantic import BaseModel, Field, BeforeValidator
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from typing import Annotated, Optional, List # Añadido List para futuras expansiones
from bson import Decimal128

# ==============================================================================
# 🔧 HERRAMIENTAS DE TRADUCCIÓN (BSON -> PYTHON)
# ==============================================================================
def convert_decimal(v):
    """
    Convierte Decimal128 de MongoDB a Decimal nativo de Python.
    Crucial para que las matemáticas financieras funcionen sin errores de tipo.
    """
    if isinstance(v, Decimal128):
        return v.to_decimal()
    return v

# Definimos un "Super Tipo" de Decimal que sabe autoconvertirse.
PyDecimal = Annotated[Decimal, BeforeValidator(convert_decimal)]

# ==============================================================================
# 📥 DTOs (DATA TRANSFER OBJECTS)
# ==============================================================================

# Input para el registro de jugador (Lo mantenemos para compatibilidad con main.py)
class PlayerRegistration(BaseModel):
    nickname: str = Field(..., min_length=3, max_length=20, description="Tu nombre de Lobo")

# ==============================================================================
# 🏦 MODELOS FINANCIEROS (EMBEDDED)
# ==============================================================================

class FinancialState(BaseModel):
    """
    Representa la billetera y hoja de balance del jugador.
    Se incrusta dentro del documento del jugador.
    """
    # Usamos alias para compatibilidad Frontend (camelCase) <-> Backend (snake_case)
    cash: PyDecimal = Field(default=Decimal("0.00"), max_digits=20, decimal_places=2)
    
    net_worth: PyDecimal = Field(
        default=Decimal("0.00"), 
        alias="netWorth" # El frontend espera 'netWorth'
    )
    
    toxic_debt: PyDecimal = Field(
        default=Decimal("0.00"), 
        alias="toxicDebt" # El frontend espera 'toxicDebt'
    )
    
    passive_income: PyDecimal = Field(
        default=Decimal("0.00"), 
        alias="passiveIncome" # El frontend espera 'passiveIncome'
    )

    class Config:
        # Permite poblar el modelo usando tanto 'net_worth' como 'netWorth'
        populate_by_name = True
        # Asegura que al convertir a JSON, los decimales sean strings (evita errores de float)
        json_encoders = {Decimal: str}

# ==============================================================================
# 🎮 MODELO: SESIÓN DE JUEGO (NUEVO)
# ==============================================================================

class GameSession(Document):
    """
    Representa una 'Clase' o 'Partida'. 
    Permite tener múltiples grupos jugando simultáneamente sin mezclarse.
    """
    code: str  # El código que el profe comparte (Ej. "FINANZAS-2024")
    created_at: datetime = Field(default_factory=datetime.now)
    is_active: bool = True
    
    class Settings:
        name = "game_sessions" # Nombre de la colección en MongoDB

# ==============================================================================
# 🐺 MODELO: JUGADOR (ACTUALIZADO)
# ==============================================================================

class Player(Document):
    nickname: str
    
    # NUEVO CAMPO: Vinculamos al jugador con una sesión específica
    # Por defecto "GLOBAL" para no romper partidas existentes si no se especifica.
    session_id: str = "GLOBAL" 
    
    financials: FinancialState = Field(default_factory=FinancialState)
    position: int = 0
    laps_completed: int = 0
    created_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "players"

    # ==========================================
    # 🧠 CEREBRO MATEMÁTICO (Lógica de Negocio)
    # ==========================================

    def calculate_net_worth(self, assets_value: Decimal = Decimal("0.00")):
        """
        Fórmula: Patrimonio = (Activos + Efectivo) - (Deudas)
        Se llama cada vez que cambia el dinero o se compra algo.
        """
        total_assets = self.financials.cash + assets_value
        total_liabilities = self.financials.toxic_debt
        
        self.financials.net_worth = total_assets - total_liabilities
        return self.financials.net_worth

    def apply_payday_logic(self):
        """
        Evento PAYDAY (Vuelta Completa):
        1. Cobra Salario + Ingresos Pasivos
        2. Paga Intereses de Deuda
        """
        SALARY = Decimal("2500.00")
        
        # --- CAMBIO DE BALANCE ---
        # Bajamos la tasa del 10% al 5% para que sea más recuperable.
        INTEREST_RATE = Decimal("0.05") 
        
        # 1. INGRESOS
        total_income = SALARY + self.financials.passive_income
        self.financials.cash += total_income

        # 2. INTERESES (El dinero cuesta dinero)
        if self.financials.toxic_debt > 0:
            interest = self.financials.toxic_debt * INTEREST_RATE
            # Redondeo financiero estándar (2 decimales)
            interest = interest.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            self.financials.toxic_debt += interest

        # Recalculamos patrimonio tras los movimientos de caja
        self.calculate_net_worth()