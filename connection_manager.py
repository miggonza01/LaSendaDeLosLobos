# ==============================================================================
# 📄 ARCHIVO: connection_manager.py (VERSIÓN 7.0: SAFEHOUSE)
# ==============================================================================
from fastapi import WebSocket
from typing import List, Dict

class ConnectionManager:
    def __init__(self):
        # active_connections: { "session_id": [socket1, socket2] }
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        """
        Registra el socket. NO LLAMA A ACCEPT (Main.py lo hace).
        """
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        
        # Evitar duplicados exactos
        if websocket not in self.active_connections[session_id]:
            self.active_connections[session_id].append(websocket)
            print(f"--- 🔌 MANAGER: Socket registrado en sala {session_id} ---")

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
                if len(self.active_connections[session_id]) == 0:
                    del self.active_connections[session_id]

    async def broadcast(self, message: str, session_id: str):
        """
        Envía a todos. Si uno falla, lo ignora silenciosamente.
        """
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id][:]:
                try:
                    # Propiedad interna de Starlette/FastAPI para saber si está abierto
                    if connection.client_state.value == 1: # 1 = CONNECTED
                        await connection.send_text(message)
                except Exception:
                    # Si falla, no hacemos nada. El evento 'disconnect' del main se encargará.
                    pass

manager = ConnectionManager()