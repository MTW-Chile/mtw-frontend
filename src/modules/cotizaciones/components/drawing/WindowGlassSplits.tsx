import React from 'react';
import type { GlassSplit } from './types';

interface WindowGlassSplitsProps {
  splits: GlassSplit[];
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  className?: string;
}

/**
 * Renderiza particiones de vidrio (glass splits) dentro de un paño.
 * Son líneas que dividen visualmente el vidrio en secciones más pequeñas.
 * Cada split tiene un eje ('horizontal' | 'vertical') y una posición 'at'.
 */
export const WindowGlassSplits: React.FC<WindowGlassSplitsProps> = ({
  splits,
  x,
  y,
  width,
  height,
  color,
  className = 'window-glass-splits',
}) => {
  if (!splits.length) return null;

  return (
    <g className={className}>
      {splits.map((split, index) => {
        const x1 = split.axis === 'horizontal' ? x : x + split.at;
        const y1 = split.axis === 'horizontal' ? y + split.at : y;
        const x2 = split.axis === 'horizontal' ? x + width : x + split.at;
        const y2 = split.axis === 'horizontal' ? y + split.at : y + height;

        return (
          <line
            key={index}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            style={{
              fill: 'none',
              stroke: color,
              strokeWidth: 0.7,
              strokeLinecap: 'round',
              strokeDasharray: '2 2',
            }}
          />
        );
      })}
    </g>
  );
};