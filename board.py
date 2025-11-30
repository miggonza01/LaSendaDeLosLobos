# ==============================================================================
# 📄 ARCHIVO: board.py
# ==============================================================================

# 1. IMPORTACIÓN NECESARIA
import random  # Agregado para seleccionar mensajes aleatorios de relleno

# ==============================================================================
# 🗺️ EL MAPA DEL TABLERO (Configuración de Casillas) - VERSIÓN 2.0 EXPANDIDA
# ==============================================================================
# Aquí definimos qué pasa en cada número.
# Si la casilla no está aquí, es una casilla "Vacía" (descanso/neutra).

BOARD_MAP = {
    # --------------------------------------------------------------------------
    # 📉 TRAMPAS DE DEUDA (LOBOS NEGROS) - MECÁNICA DE DOLOR
    # --------------------------------------------------------------------------
    # Casillas fijas que generan gastos obligatorios. Enseñan que los imprevistos
    # y los gastos hormiga son enemigos del patrimonio.
    
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

    # --------------------------------------------------------------------------
    # 📈 INVERSIONES (LOBOS BLANCOS) - MECÁNICA DE ALIVIO Y CRECIMIENTO
    # --------------------------------------------------------------------------
    # Aumentadas a 5 opciones para mejorar el ritmo del juego.
    # Permiten convertir Efectivo (Cash) en Flujo de Caja (Passive Income).
    
    # OPCIÓN 1: NIVEL ENTRADA (Bajo costo, bajo retorno)
    5: {
        "tipo": "LOBO_BLANCO",
        "titulo": "Tienda de Dropshipping",
        "costo": 500,
        "flujo_extra": 100,
        "descripcion": "Ventas automatizadas. Ingreso pequeño pero constante."
    },
    
    # OPCIÓN 2: NIVEL MEDIO-BAJO (Nueva adición)
    # Requiere un poco de ahorro previo.
    8: {
        "tipo": "LOBO_BLANCO",
        "titulo": "Food Truck",
        "costo": 1500,
        "flujo_extra": 350,
        "descripcion": "Un camión de tacos en una zona concurrida."
    },
    
    # OPCIÓN 3: NIVEL MEDIO (Bien raíz clásico)
    10: {
        "tipo": "LOBO_BLANCO",
        "titulo": "Departamento de Alquiler",
        "costo": 2000,
        "flujo_extra": 400,
        "descripcion": "Compraste un estudio y lo pusiste en Airbnb."
    },
    
    # OPCIÓN 4: PROPIEDAD INTELECTUAL (Nueva adición)
    # Alta rentabilidad relativa al costo, pero nicho específico.
    14: {
        "tipo": "LOBO_BLANCO",
        "titulo": "Canal de YouTube",
        "costo": 800,
        "flujo_extra": 150,
        "descripcion": "Monetización de contenido educativo."
    },
    
    # OPCIÓN 5: NIVEL "BALLENA" (High Risk / High Reward)
    # Actualizado: Costo subió a 5000, pero el retorno es masivo (1200).
    # Esta casilla puede ganar el juego sola si se compra temprano.
    15: {
        "tipo": "LOBO_BLANCO",
        "titulo": "Acciones de Tech Startup",
        "costo": 5000,
        "flujo_extra": 1200,
        "descripcion": "Invertiste temprano en el próximo Unicornio."
    }
}

# ==============================================================================
# --- MENSAJES DE RELLENO (DIDÁCTICA INVISIBLE) ---
# ==============================================================================
# Aparecen en las casillas vacías (ahora son menos debido a las nuevas inversiones).
# Mantienen la inmersión sin afectar el balance económico.

MENSAJES_NEUTROS = [
    {
        "titulo": "Día Tranquilo",
        "descripcion": "Decidiste cocinar en casa en lugar de pedir delivery. Ahorraste dinero invisible."
    },
    {
        "titulo": "Lectura Financiera",
        "descripcion": "Leíste un capítulo sobre interés compuesto. Tu mente se expande."
    },
    {
        "titulo": "Resistencia",
        "descripcion": "Pasaste frente a la tienda de ofertas y no entraste. ¡Voluntad de acero!"
    },
    {
        "titulo": "Análisis de Mercado",
        "descripcion": "Revisaste tus inversiones. Todo parece estable por ahora."
    },
    {
        "titulo": "Networking",
        "descripcion": "Tomaste un café con un mentor. Aprendiste sobre deuda buena vs deuda mala."
    },
    {
        "titulo": "Planificación",
        "descripcion": "Revisaste tu presupuesto mensual. El orden trae riqueza."
    }
]

def obtener_evento(posicion):
    """
    Función Maestra para determinar qué sucede en la casilla actual.
    
    Lógica:
    1. Busca si la posición actual (int) existe en el diccionario BOARD_MAP.
    2. Si existe (es un Lobo Negro o Blanco), devuelve ese objeto.
    3. Si NO existe (es un espacio vacío), genera proceduralmente un evento NEUTRO
       seleccionando uno al azar de la lista MENSAJES_NEUTROS.
       
    Args:
        posicion (int): El número de la casilla donde cayó el jugador.
        
    Returns:
        dict: Un diccionario con la estructura del evento (tipo, titulo, descripcion, etc.)
    """
    # Intentamos obtener el evento definido manualmente
    evento_real = BOARD_MAP.get(posicion)
    
    if evento_real:
        # ¡Bingo! Es una casilla especial (Gasto o Inversión)
        return evento_real
    else:
        # Es una casilla vacía. Para no mostrar "nada", generamos narrativa.
        mensaje = random.choice(MENSAJES_NEUTROS)
        
        # Construimos un objeto de evento "falso" o neutro on-the-fly
        return {
            "tipo": "NEUTRO", # Tipo nuevo para que el Frontend sepa que no hay impacto visual fuerte
            "titulo": mensaje["titulo"],
            "descripcion": mensaje["descripcion"],
            "costo": 0 # Importante: Costo 0 para que no afecte la matemática financiera
        }