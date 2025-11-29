# ==============================================================================
# 🗺️ EL MAPA DEL TABLERO (Configuración de Casillas)
# ==============================================================================
# Aquí definimos qué pasa en cada número.
# Si la casilla no está aquí, es una casilla "Vacía" (descanso).

BOARD_MAP = {
    # --- TRAMPAS DE DEUDA (LOBOS NEGROS) ---
    # Casillas que te obligan a gastar. Si no tienes efectivo, generan deuda.
    
    3: {
        "tipo": "LOBO_NEGRO",
        "titulo": "iPhone 15 Pro",
        "costo": 1200,
        "descripcion": "Lo compraste por impulso a 24 cuotas. ¡Duele!"
    },
    
    7: {
        "tipo": "LOBO_NEGRO",
        "titulo": "Cena de Lujo",
        "costo": 300,
        "descripcion": "Invitaste a todos y pagaste con tarjeta."
    },
    
    12: {
        "tipo": "LOBO_NEGRO",
        "titulo": "Reparación del Auto",
        "costo": 800,
        "descripcion": "El radiador explotó. Gasto de emergencia."
    },
    
    18: {
        "tipo": "LOBO_NEGRO",
        "titulo": "Boda de tu Ex",
        "costo": 500,
        "descripcion": "Regalo costoso y traje nuevo."
    },


    # --- INVERSIONES (LOBOS BLANCOS) ---
    # Casillas que te permiten comprar Activos.
    # ROI = Retorno de Inversión (Cuánto te paga por vuelta).
    
    5: {
        "tipo": "LOBO_BLANCO",
        "titulo": "Tienda de Dropshipping",
        "costo": 500,
        "flujo_extra": 100, # Te paga $100 extras cada Payday
        "descripcion": "Automatizaste ventas en línea. Ingreso pequeño pero constante."
    },
    
    10: {
        "tipo": "LOBO_BLANCO",
        "titulo": "Departamento de Alquiler",
        "costo": 2000,
        "flujo_extra": 400,
        "descripcion": "Compraste un estudio y lo pusiste en Airbnb."
    },
    
    15: {
        "tipo": "LOBO_BLANCO",
        "titulo": "Acciones de Tech Startup",
        "costo": 5000,
        "flujo_extra": 1200,
        "descripcion": "Invertiste temprano en el próximo Unicornio."
    }
}

def obtener_evento(posicion):
    """Devuelve el evento de la casilla o None si está vacía"""
    return BOARD_MAP.get(posicion)