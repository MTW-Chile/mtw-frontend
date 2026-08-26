/**
 * Componente React para renderizar el SVG de una ventana.
 *
 * Reemplaza la implementación anterior que usaba `legacyGeometrySvg.build()`
 * y `toLegacyLine()`. Ahora usa el builder unificado `windowGeometryBuilder`
 * y el adaptador tipado `toWindowLine()`.
 *
 * Etapa 6 del plan de refactorización.
 *
 * @module WindowRendererSvg
 */

import React, { useMemo, useEffect, useRef } from 'react';
import type { Ventana } from '../../../../types';
import { toWindowLine } from './ventanaAdapter';
import { buildWindow } from './windowGeometryBuilder';

interface WindowRendererSvgProps {
  ventana: Ventana;
  className?: string;
  showDimensions?: boolean; // Se ignora, el SVG nativo siempre dibuja sus propias cotas
}

/**
 * Renderiza el SVG de una ventana usando el builder unificado.
 *
 * @example
 * ```tsx
 * <WindowRendererSvg ventana={ventana} className="w-full h-48" />
 * ```
 */
export const WindowRendererSvg: React.FC<WindowRendererSvgProps> = ({
  ventana,
  className = 'w-full h-48',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Generamos el SVG markup usando el builder unificado
  const svgMarkup = useMemo(() => {
    try {
      const windowLine = toWindowLine(ventana);
      if (!windowLine) {
        return '<svg viewBox="0 0 240 178" preserveAspectRatio="xMidYMid meet"><text x="120" y="89" text-anchor="middle" font-size="8" fill="red">Error: ventana inválida</text></svg>';
      }
      return buildWindow(windowLine, 'line').svg;
    } catch (e) {
      console.error('Error dibujando ventana', ventana, e);
      return '<svg viewBox="0 0 240 178" preserveAspectRatio="xMidYMid meet"><text x="120" y="89" text-anchor="middle" font-size="8" fill="red">Error al dibujar geometría</text></svg>';
    }
  }, [ventana]);

  useEffect(() => {
    if (containerRef.current) {
      // El builder devuelve el SVG literal `<svg ...> ... </svg>`
      containerRef.current.innerHTML = svgMarkup;

      // Aplicar las clases que React hubiese aplicado si fuese un nodo de React
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