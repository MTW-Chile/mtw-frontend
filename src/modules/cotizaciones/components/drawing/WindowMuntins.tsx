import React from 'react';
import type { MuntinLine } from './types';

interface WindowMuntinsProps {
  lines: MuntinLine[];
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  className?: string;
}

/**
 * Renderiza barrotillos (muntins) dentro de un paño de vidrio.
 * Las líneas se reciben en coordenadas relativas al paño (0..width, 0..height)
 * y se transforman al espacio del lienzo de dibujo.
 */
export const WindowMuntins: React.FC<WindowMuntinsProps> = ({
  lines,
  x,
  y,
  width,
  height,
  color,
  className = 'window-muntins',
}) => {
  if (!lines.length) return null;

  return (
    <g className={className}>
      {lines.map((line, index) => (
        <line
          key={index}
          x1={x + line.x1}
          y1={y + Math.max(2, line.y1)}
          x2={x + line.x2}
          y2={y + line.y2}
          style={{
            fill: 'none',
            stroke: color,
            strokeWidth: 1.1,
            strokeLinecap: 'round',
          }}
        />
      ))}
    </g>
  );
};