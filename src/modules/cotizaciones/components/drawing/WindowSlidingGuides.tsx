import React from 'react';

interface GuideSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

interface WindowSlidingGuidesProps {
  guides: GuideSpec[];
  color: string;
  className?: string;
}

/**
 * Renderiza guías de corredera (rieles) para ventanas corredizas.
 * Cada guía es una línea horizontal con una etiqueta que indica el carril (Int/Ext).
 */
export const WindowSlidingGuides: React.FC<WindowSlidingGuidesProps> = ({
  guides,
  color,
  className = 'window-sliding-guides',
}) => {
  if (!guides.length) return null;

  return (
    <g className={className}>
      {guides.map((guide, index) => (
        <g key={index}>
          {/* Línea de guía */}
          <line
            x1={guide.x}
            y1={guide.y}
            x2={guide.x + guide.width}
            y2={guide.y}
            style={{
              fill: 'none',
              stroke: color,
              strokeWidth: 0.8,
              strokeDasharray: '4 2',
            }}
          />
          {/* Etiqueta del carril */}
          <text
            x={guide.x + guide.width + 3}
            y={guide.y + 1.5}
            textAnchor="start"
            style={{
              font: '500 5px system-ui,sans-serif',
              fill: color,
            }}
          >
            {guide.label}
          </text>
        </g>
      ))}
    </g>
  );
};