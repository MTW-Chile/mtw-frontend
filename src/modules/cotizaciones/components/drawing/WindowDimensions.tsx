import React from 'react';

interface DimensionLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
}

interface WindowDimensionsProps {
  dimensions: DimensionLine[];
  color: string;
  className?: string;
}

/**
 * Renderiza cotas (dimensiones) de la ventana.
 * Cada cota es una línea horizontal o vertical con su valor numérico.
 */
export const WindowDimensions: React.FC<WindowDimensionsProps> = ({
  dimensions,
  color,
  className = 'window-dimensions',
}) => {
  if (!dimensions.length) return null;

  return (
    <g className={className}>
      {dimensions.map((dim, index) => {
        const isHorizontal = dim.y1 === dim.y2;
        const midX = (dim.x1 + dim.x2) / 2;
        const midY = (dim.y1 + dim.y2) / 2;

        return (
          <g key={index}>
            {/* Línea de cota */}
            <line
              x1={dim.x1}
              y1={dim.y1}
              x2={dim.x2}
              y2={dim.y2}
              style={{
                fill: 'none',
                stroke: color,
                strokeWidth: 0.6,
              }}
            />
            {/* Marcas de extremo */}
            <line
              x1={dim.x1}
              y1={dim.y1 - 2.5}
              x2={dim.x1}
              y2={dim.y1 + 2.5}
              style={{
                fill: 'none',
                stroke: color,
                strokeWidth: 0.6,
              }}
            />
            <line
              x1={dim.x2}
              y1={dim.y2 - 2.5}
              x2={dim.x2}
              y2={dim.y2 + 2.5}
              style={{
                fill: 'none',
                stroke: color,
                strokeWidth: 0.6,
              }}
            />
            {/* Etiqueta de cota */}
            <text
              x={isHorizontal ? midX : midX - 8}
              y={isHorizontal ? midY - 3 : midY + 1.5}
              textAnchor={isHorizontal ? 'middle' : 'end'}
              dominantBaseline={isHorizontal ? 'auto' : 'middle'}
              style={{
                font: '500 5.5px system-ui,sans-serif',
                fill: color,
              }}
            >
              {dim.label}
            </text>
          </g>
        );
      })}
    </g>
  );
};