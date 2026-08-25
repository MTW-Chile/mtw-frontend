import React from 'react';
import type { TraverseLine } from './types';

interface WindowTraversesProps {
  lines: TraverseLine[];
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  className?: string;
}

/**
 * Renderiza travesaños (traverses) dentro de un paño de vidrio.
 * Los travesaños son líneas estructurales horizontales/verticales
 * que dividen el paño en sub-paños.
 */
export const WindowTraverses: React.FC<WindowTraversesProps> = ({
  lines,
  x,
  y,
  width,
  height,
  color,
  className = 'window-traverses',
}) => {
  if (!lines.length) return null;

  return (
    <g className={className}>
      {lines.map((line, index) => (
        <line
          key={index}
          x1={x + line.x1}
          y1={y + line.y1}
          x2={x + line.x2}
          y2={y + line.y2}
          style={{
            fill: 'none',
            stroke: color,
            strokeWidth: 1.4,
            strokeLinecap: 'round',
          }}
        />
      ))}
    </g>
  );
};