import React from 'react';
import type { ProfileColorSet } from './types';

interface WindowFrameProps {
  x: number;
  y: number;
  width: number;
  height: number;
  colors: ProfileColorSet;
  className?: string;
}

/**
 * Marco exterior de la ventana.
 * Renderiza un rectángulo con efecto 3D (luz/sombra) usando los colores del perfil.
 */
export const WindowFrame: React.FC<WindowFrameProps> = ({
  x,
  y,
  width,
  height,
  colors,
  className = 'window-frame',
}) => {
  const outerX = x - 4.5;
  const outerY = y - 4.5;
  const outerWidth = width + 9;
  const outerHeight = height + 9;

  return (
    <g className={className}>
      {/* Cuerpo del marco */}
      <rect
        x={outerX}
        y={outerY}
        width={outerWidth}
        height={outerHeight}
        rx={1}
        style={{
          fill: colors.base,
          stroke: colors.dark,
          strokeWidth: 1,
        }}
      />
      {/* Luz superior-izquierda */}
      <path
        d={`M ${outerX + 1} ${outerY + outerHeight - 1} V ${outerY + 1} H ${outerX + outerWidth - 1}`}
        style={{
          fill: 'none',
          stroke: colors.light,
          strokeWidth: 1.25,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          opacity: 0.72,
        }}
      />
      {/* Sombra inferior-derecha */}
      <path
        d={`M ${outerX + 1} ${outerY + outerHeight - 1} H ${outerX + outerWidth - 1} V ${outerY + 1}`}
        style={{
          fill: 'none',
          stroke: colors.dark,
          strokeWidth: 1.25,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          opacity: 0.62,
        }}
      />
      {/* Reborde interior */}
      <rect
        x={x - 0.7}
        y={y - 0.7}
        width={width + 1.4}
        height={height + 1.4}
        rx={0.7}
        style={{
          fill: 'none',
          stroke: colors.dark,
          strokeWidth: 0.7,
          opacity: 0.66,
        }}
      />
      {/* Luz interior */}
      <path
        d={`M ${x} ${y + height} V ${y} H ${x + width}`}
        style={{
          fill: 'none',
          stroke: colors.light,
          strokeWidth: 0.55,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          opacity: 0.55,
        }}
      />
    </g>
  );
};