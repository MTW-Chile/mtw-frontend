import React, { useMemo, useEffect, useRef } from 'react';
import type { Ventana } from '../../../../types';
import { build } from './legacyGeometrySvg';

interface WindowRendererSvgProps {
  ventana: Ventana;
  className?: string;
  showDimensions?: boolean; // Se ignora, el SVG nativo de HETMO siempre dibuja sus propias cotas para ser matemáticamente correcto.
}

export const WindowRendererSvg: React.FC<WindowRendererSvgProps> = ({
  ventana,
  className = 'w-full h-48',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Generamos el SVG markup exacto del motor legado
  const svgMarkup = useMemo(() => {
    try {
      return build(ventana, 'line');
    } catch (e) {
      console.error('Error dibujando ventana', ventana, e);
      return '<svg viewBox="0 0 240 178" preserveAspectRatio="xMidYMid meet"><text x="120" y="89" text-anchor="middle" font-size="8" fill="red">Error al dibujar geometría</text></svg>';
    }
  }, [ventana]);

  useEffect(() => {
    if (containerRef.current) {
      // Configuramos el innerHTML.
      // El motor legado devuelve el SVG literal `<svg ...> ... </svg>`.
      containerRef.current.innerHTML = svgMarkup;
      
      // Aplicar las clases que React hubiese aplicado si fuese un nodo de React.
      const svgEl = containerRef.current.querySelector('svg');
      if (svgEl) {
        svgEl.setAttribute('class', className);
      }
    }
  }, [svgMarkup, className]);

  return (
    <div 
      ref={containerRef} 
      className={`relative flex items-center justify-center ${className.split(' ').filter(c => c.startsWith('w-') || c.startsWith('h-') || c.startsWith('max-')).join(' ')}`} 
      style={{ overflow: 'hidden' }}
    />
  );
};
