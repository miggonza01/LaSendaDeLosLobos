import React, { useEffect, useState } from 'react';

/**
 * frontend/src/components/EventCard.jsx
 * COMPONENTE: EVENT CARD (Tarjeta de Evento)
 * ------------------------------------------
 * Muestra notificaciones visuales temporales (Toasts/Modales).
 * Maneja animaciones de entrada/salida y estilos dinámicos según el tipo de evento.
 */
const EventCard = ({ eventData, onClose }) => {
  // Estado local para controlar la opacidad y transformación CSS.
  // false = Invisible (Opacity 0), true = Visible (Opacity 100).
  const [visible, setVisible] = useState(false);

  // --- CICLO DE VIDA DE LA TARJETA (CORREGIDO) ---
  useEffect(() => {
    // 1. FASE DE ENTRADA (MOUNTING)
    // SOLUCIÓN AL ERROR: Usamos un setTimeout.
    // Esto saca la actualización de estado del flujo síncrono ("Next Tick").
    // Permite que el navegador pinte primero el componente invisible y LUEGO anime la entrada.
    const entryTimer = setTimeout(() => {
      setVisible(true); // Dispara la transición CSS: opacity-0 -> opacity-100
    }, 50); // 50ms es imperceptible para el humano pero suficiente para el navegador.
    
    // 2. FASE DE SALIDA (AUTO-CLOSE)
    // La carta se mantiene visible por 4 segundos para lectura.
    const exitTimer = setTimeout(() => {
      setVisible(false); // Inicia la animación de salida (Fade-out)
      
      // Esperamos a que termine la transición CSS (300ms) antes de destruir el componente.
      // Si llamamos a onClose inmediatamente, la carta desaparecería de golpe.
      setTimeout(onClose, 300); 
    }, 4000);

    // 3. FASE DE LIMPIEZA (UNMOUNTING)
    // Si el usuario cierra el juego o cambia de pantalla antes de los 4s,
    // debemos cancelar los timers para evitar errores de memoria (Memory Leaks).
    return () => {
      clearTimeout(entryTimer);
      clearTimeout(exitTimer);
    };
  }, [onClose]); // Se ejecuta cada vez que cambia la función onClose (o al montarse).

  // Guard Clause: Si no hay datos, no renderizamos nada para evitar errores.
  if (!eventData) return null;

  // --- LÓGICA DE ESTILOS DINÁMICOS (THEMING) ---
  // Definimos la apariencia base (Default)
  let styles = {
    borderColor: "border-slate-500",
    glow: "shadow-slate-500",
    icon: "🎲",
    textColor: "text-white"
  };

  // Aplicamos "Skins" (Temas) según el tipo de evento financiero recibido del Backend.
  if (eventData.tipo === "LOBO_NEGRO") {
    // ESTILO: PELIGRO / GASTO / DEUDA
    styles = {
      borderColor: "border-red-500",
      glow: "shadow-[0_0_30px_rgba(239,68,68,0.5)]", // Resplandor Rojo Neón intenso
      icon: "🐺", // Icono semántico de Lobo
      textColor: "text-red-400"
    };
  } else if (eventData.tipo === "LOBO_BLANCO") {
    // ESTILO: OPORTUNIDAD / INVERSIÓN
    styles = {
      borderColor: "border-blue-500",
      glow: "shadow-[0_0_30px_rgba(59,130,246,0.5)]", // Resplandor Azul Neón
      icon: "🚀", // Cohete (To the moon!)
      textColor: "text-blue-400"
    };
  } else if (eventData.tipo === "PAYDAY") {
    // ESTILO: RECOMPENSA / SALARIO
    styles = {
      borderColor: "border-green-500",
      glow: "shadow-[0_0_30px_rgba(74,222,128,0.5)]", // Resplandor Verde Dinero
      icon: "💰",
      textColor: "text-green-400"
    };
  }

  // --- RENDERIZADO (JSX) ---
  return (
    // CONTENEDOR PRINCIPAL (OVERLAY)
    // fixed inset-0: Cubre toda la pantalla.
    // pointer-events-none: Permite hacer clic "a través" de la carta (no bloquea el juego).
    // z-40: Capa superior (Z-Index alto).
    // transition-opacity: La propiedad mágica que anima la entrada/salida.
    <div className={`fixed inset-0 flex items-center justify-center z-40 pointer-events-none transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
      
      {/* TARJETA FLOTANTE (CONTENIDO) */}
      {/* transform transition-transform: Anima el tamaño y posición. */}
      {/* Si visible: Escala normal (100%) y posición centrada. */}
      {/* Si oculto: Escala reducida (90%) y desplazada abajo (translate-y-10). */}
      <div className={`bg-slate-900/95 border-2 ${styles.borderColor} ${styles.glow} p-6 rounded-xl max-w-sm w-full mx-4 transform transition-transform duration-300 ${visible ? "scale-100 translate-y-0" : "scale-90 translate-y-10"}`}>
        
        {/* ICONO ANIMADO */}
        <div className="text-6xl text-center mb-4 animate-bounce">
          {styles.icon}
        </div>
        
        {/* TÍTULO */}
        <h2 className={`text-2xl font-bold text-center mb-2 uppercase tracking-widest ${styles.textColor}`}>
          {eventData.titulo}
        </h2>
        
        {/* DESCRIPCIÓN */}
        <p className="text-slate-300 text-center mb-4 font-mono text-sm leading-relaxed">
          {eventData.descripcion}
        </p>

        {/* MONTO FINANCIERO (OPCIONAL) */}
        {/* Solo se renderiza si el evento trae dinero asociado */}
        {eventData.monto && (
          <div className="bg-black/50 rounded p-2 text-center border border-white/10">
            <span className="text-xs text-slate-500 uppercase">Impacto Financiero</span>
            <p className="text-xl font-bold text-white font-mono">{eventData.monto}</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default EventCard;