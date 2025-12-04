# ==============================================================================
# 📄 ARCHIVO: board.py
# 🔍 ROL: Configuración del Tablero y Eventos
# ==============================================================================
import random

# Tamaño del tablero circular
CASILLAS_TOTALES = 30

# Mapa de Eventos: Clave = Número de Casilla
BOARD_MAP = {
    # 🔴 TRAMPAS (Gastos/Deuda)
    3:  {"tipo": "LOBO_NEGRO", "titulo": "iPhone 15 Pro", "costo": 1200, "descripcion": "Compra impulsiva a crédito."},
    7:  {"tipo": "LOBO_NEGRO", "titulo": "Cena de Lujo", "costo": 300, "descripcion": "Invitación a amigos con tarjeta."},
    12: {"tipo": "LOBO_NEGRO", "titulo": "Mecánico", "costo": 800, "descripcion": "El auto se averió."},
    18: {"tipo": "LOBO_NEGRO", "titulo": "Boda Ex", "costo": 500, "descripcion": "Regalo y traje costoso."},
    22: {"tipo": "LOBO_NEGRO", "titulo": "Estafa Cripto", "costo": 2000, "descripcion": "Inversión fallida en memecoin."},
    27: {"tipo": "LOBO_NEGRO", "titulo": "Dentista", "costo": 1500, "descripcion": "Urgencia médica no asegurada."},

    # 🟢 INVERSIONES (Generan Ingreso Pasivo)
    5:  {"tipo": "LOBO_BLANCO", "titulo": "Dropshipping", "costo": 500, "flujo_extra": 100, "descripcion": "Ventas automatizadas."},
    9:  {"tipo": "LOBO_BLANCO", "titulo": "Food Truck", "costo": 1500, "flujo_extra": 350, "descripcion": "Negocio de tacos."},
    14: {"tipo": "LOBO_BLANCO", "titulo": "YouTube", "costo": 800, "flujo_extra": 150, "descripcion": "Canal monetizado."},
    16: {"tipo": "LOBO_BLANCO", "titulo": "Airbnb", "costo": 3000, "flujo_extra": 500, "descripcion": "Alquiler de estudio."},
    20: {"tipo": "LOBO_BLANCO", "titulo": "Vending", "costo": 2500, "flujo_extra": 400, "descripcion": "Máquinas expendedoras."},
    25: {"tipo": "LOBO_BLANCO", "titulo": "SaaS App", "costo": 4000, "flujo_extra": 800, "descripcion": "Software por suscripción."},
    29: {"tipo": "LOBO_BLANCO", "titulo": "Angel Investor", "costo": 6000, "flujo_extra": 1500, "descripcion": "Inversión en Startup."}
}

# Eventos de relleno para casillas vacías
MENSAJES_NEUTROS = [
    {"titulo": "Relax", "descripcion": "Día tranquilo en casa."},
    {"titulo": "Estudio", "descripcion": "Leíste un libro de finanzas."},
    {"titulo": "Ahorro", "descripcion": "Evitaste comprar café caro."},
]

def obtener_evento(posicion):
    """Retorna el evento de la casilla o uno neutro aleatorio."""
    evento = BOARD_MAP.get(posicion)
    if evento: return evento
    
    m = random.choice(MENSAJES_NEUTROS)
    return {"tipo": "NEUTRO", "titulo": m["titulo"], "descripcion": m["descripcion"], "costo": 0}