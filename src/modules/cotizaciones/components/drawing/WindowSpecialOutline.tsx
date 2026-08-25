import React from 'react';
import type { SpecialOutline } from './types';

interface WindowSpecialOutlineProps {
  outline: SpecialOutline;
  x: number;
  y: number;
  color: string;
  className?: string;
}

/**
 * Renderiza formas especiales de ventana (círculo, polígono).
 * Se usa para ventanas con geometría no rectangular (ojos de buey, arcos, etc.).
 */
export const WindowSpecialOutline: React.FC<WindowSpecialOutlineProps> = ({
  outline,
  x,
  y,
  color,
  className = 'window-special-outline',
}) => {
  if (outline.kind === 'circle') {
    const cx = x + outline.width / 2;
    const cy = y + outline.height / 2;
    const rx = outline.width / 2;
    const ry = outline.height / 2;

    return (
      <ellipse
        className={className}
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        style={{
          fill: 'none',
          stroke: color,
          strokeWidth: 1.2,
        }}
      />
    );
  }

  if (outline.kind === 'polygon') {
    const points = outline.points
      .map(([px, py]) => `${x + px},${y + py}`)
      .join(' ');

    return (
      <polygon
        className={className}
        points={points}
        style={{
          fill: 'none',
          stroke: color,
          strokeWidth: 1.2,
          strokeLinejoin: 'round',
        }}
      />
    );
  }

  return null;
};