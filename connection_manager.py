# ==============================================================================
# 📄 ARCHIVO: connection_manager.py (VERSIÓN 2.6.1: CONEXIÓN ROBUSTA)
# ==============================================================================
# DESCRIPCIÓN: Gestiona conexiones WebSocket de manera segura y evita
#              race conditions durante reconexiones rápidas.
# CORRECCIÓN: Variable 'failed_sockets' renombrada a 'dead_sockets' para consistencia.
# ==============================================================================

from fastapi import WebSocket
from typing import List, Dict
import asyncio

class ConnectionManager:
    def __init__(self):
        """
        Inicializa el gestor de conexiones.
        
        Estructura de datos:
        - active_connections: { "session_id": [socket1, socket2] }
        - _lock: Semáforo asíncrono para prevenir race conditions
        """
        # Diccionario principal: sesión → lista de sockets activos
        self.active_connections: Dict[str, List[WebSocket]] = {}
        
        # Lock asíncrono para operaciones concurrentes seguras
        self._lock = asyncio.Lock()
        
        print("--- 🔧 MANAGER 2.6.1 INICIADO (Robusto) ---")

    async def connect(self, websocket: WebSocket, session_id: str):
        """
        Registra una nueva conexión WebSocket en la sala especificada.
        
        Args:
            websocket: Instancia del WebSocket aceptado por FastAPI
            session_id: Identificador único de la sala/sesión
        """
        # Verificación de seguridad: el socket debe estar en estado aceptado
        if not hasattr(websocket, 'client_state') or websocket.client_state.value != 1:
            print(f"⚠️  MANAGER: Socket no aceptado correctamente, rechazando conexión")
            return
            
        async with self._lock:  # 🔒 Operación atómica
            # Inicializar lista si es la primera conexión de la sala
            if session_id not in self.active_connections:
                self.active_connections[session_id] = []
            
            # Evitar duplicados: verificar si el socket ya está registrado
            if websocket not in self.active_connections[session_id]:
                self.active_connections[session_id].append(websocket)
                print(f"--- ✅ MANAGER: Socket agregado a sala '{session_id}' (Total: {len(self.active_connections[session_id])}) ---")
            else:
                print(f"--- ⚠️  MANAGER: Socket ya registrado en sala '{session_id}', ignorando duplicado ---")

    def disconnect(self, websocket: WebSocket, session_id: str):
        """
        Elimina un socket de la sala de manera segura.
        
        Args:
            websocket: Socket a remover
            session_id: Sala de la cual remover el socket
        """
        if session_id in self.active_connections:
            # Eliminar el socket si está presente
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
                print(f"--- 🗑️  MANAGER: Socket removido de sala '{session_id}'")
                
                # Limpieza de sala vacía
                if len(self.active_connections[session_id]) == 0:
                    del self.active_connections[session_id]
                    print(f"--- 🏁 MANAGER: Sala '{session_id}' cerrada (sin conexiones) ---")

    async def broadcast(self, message: str, session_id: str):
        """
        Envía un mensaje a TODOS los sockets de una sala.
        
        Args:
            message: String con el mensaje JSON a enviar
            session_id: Sala objetivo para el broadcast
        """
        # Validación rápida: ¿existe la sala?
        if session_id not in self.active_connections:
            print(f"--- ⚠️  MANAGER: Intento de broadcast en sala inexistente '{session_id}'")
            return
        
        # Lista para registrar sockets fallidos (evita modificar lista durante iteración)
        dead_sockets: List[WebSocket] = []
        
        # Crear copia superficial para iteración segura
        connections_copy = self.active_connections[session_id].copy()
        
        # Contadores para métricas
        successful_sends = 0
        failed_sends = 0
        
        # Enviar mensaje a cada socket de la sala
        for connection in connections_copy:
            try:
                # Verificación de estado del WebSocket (FastAPI internals)
                # client_state.CONNECTED = 1, DISCONNECTED = 3
                if (hasattr(connection, 'client_state') and 
                    connection.client_state.value == 1):  # CONNECTED
                    
                    await connection.send_text(message)
                    successful_sends += 1
                    
                else:
                    # Socket no está en estado CONNECTED, marcarlo como muerto
                    print(f"--- ⚠️  MANAGER: Socket en estado inválido ({getattr(connection, 'client_state', 'DESCONOCIDO')})")
                    dead_sockets.append(connection)
                    failed_sends += 1
                    
            except RuntimeError as e:
                # Error específico de "WebSocket is not connected"
                if "not connected" in str(e) or "Need to call 'accept'" in str(e):
                    print(f"--- 🔌 MANAGER: Socket no aceptado/desconectado (RuntimeError)")
                    dead_sockets.append(connection)
                    failed_sends += 1
                    
            except Exception as e:
                # Cualquier otro error (conexión cerrada, timeout, etc.)
                print(f"--- ❌ MANAGER: Error enviando a socket: {type(e).__name__}")
                dead_sockets.append(connection)
                failed_sends += 1
        
        # Limpieza de sockets muertos (fuera del bucle para no modificar durante iteración)
        if dead_sockets:
            async with self._lock:  # 🔒 Operación atómica
                for dead_socket in dead_sockets:
                    self.disconnect(dead_socket, session_id)
        
        # Log de métricas (CORRECCIÓN: usar len(dead_sockets) para el conteo de fallos)
        if successful_sends > 0 or failed_sends > 0:
            print(f"--- 📊 MANAGER: Broadcast en '{session_id}' → Éxitos: {successful_sends}, Fallos: {len(dead_sockets)}")

# Instancia global del manager (patrón Singleton)
manager = ConnectionManager()