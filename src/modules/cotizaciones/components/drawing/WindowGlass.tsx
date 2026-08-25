import React from 'react';
import type { VisualPalette } from './types';

interface WindowGlassProps {
  x: number;
  y: number;
  width: number;
  height: number;
  palette: VisualPalette;
  hasGlass?: boolean;
  className?: string;
}

/**
 * Representación del vidrio de una ventana.
 * Renderiza un rectángulo con relleno y borde de vidrio.
 */
export const WindowGlass: React.FC<WindowGlassProps> = ({
  x,
  y,
  width,
  height,
  palette,
  hasGlass = true,
  className = 'window-glass',
}) => (
  <rect
    className={className}
    x={x}
    y={y}
    width={width}
    height={height}
    style={{
      fill: hasGlass ? palette.glass : '#ffffff',
      stroke: palette.glassEdge,
      strokeWidth: 0.8,
    }}
  />
);