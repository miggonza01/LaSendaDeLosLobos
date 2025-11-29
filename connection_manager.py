from fastapi import WebSocket
from typing import List

class ConnectionManager:
    """
    Clase encargada de mantener las conexiones activas.
    Funciona como una sala de chat grupal.
    """
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"--- NUEVA CONEXIÓN: Total {len(self.active_connections)} ---")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"--- DESCONEXIÓN: Total {len(self.active_connections)} ---")

    async def broadcast(self, message: str):
        """
        Envía un mensaje a TODOS.
        BLINDAJE: Si una conexión falla, la ignoramos para no tumbar el servidor.
        """
        # Iteramos sobre una copia de la lista para evitar errores si se modifica durante el bucle
        for connection in self.active_connections[:]:
            try:
                await connection.send_text(message)
            except Exception as e:
                # Si falla el envío (cliente desconectado abruptamente), lo sacamos de la lista
                print(f"⚠️ Detectada conexión muerta. Limpiando...")
                self.disconnect(connection)

manager = ConnectionManager()