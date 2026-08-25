import React from 'react';

interface LabelSpec {
  x: number;
  y: number;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
  fontSize?: number;
  fontWeight?: number | string;
  fill?: string;
}

interface WindowLabelsProps {
  labels: LabelSpec[];
  defaultColor: string;
  className?: string;
}

/**
 * Renderiza etiquetas de texto en el dibujo de la ventana.
 * Soporta etiquetas de apertura, perfil, vidrio y código de vidrio.
 */
export const WindowLabels: React.FC<WindowLabelsProps> = ({
  labels,
  defaultColor,
  className = 'window-labels',
}) => {
  if (!labels.length) return null;

  return (
    <g className={className}>
      {labels.map((label, index) => (
        <text
          key={index}
          x={label.x}
          y={label.y}
          textAnchor={label.anchor ?? 'middle'}
          style={{
            font: `${label.fontWeight ?? 500} ${label.fontSize ?? 5.5}px system-ui,sans-serif`,
            fill: label.fill ?? defaultColor,
          }}
        >
          {label.text}
        </text>
      ))}
    </g>
  );
};

// ─── Componentes específicos de etiquetas ─────────────────────────────────────

interface ApertureLabelProps {
  x: number;
  y: number;
  text: string;
  color: string;
}

/**
 * Etiqueta del tipo de apertura (ej: "Practicable 1 hoja").
 */
export const ApertureLabel: React.FC<ApertureLabelProps> = ({ x, y, text, color }) => (
  <text
    x={x}
    y={y}
    textAnchor="middle"
    style={{
      font: '500 5.5px system-ui,sans-serif',
      fill: color,
    }}
  >
    {text}
  </text>
);

interface ProfileLabelProps {
  x: number;
  y: number;
  text: string;
  color: string;
}

/**
 * Etiqueta de la serie de perfiles (ej: "Serie 3000").
 */
export const ProfileLabel: React.FC<ProfileLabelProps> = ({ x, y, text, color }) => (
  <text
    x={x}
    y={y}
    textAnchor="middle"
    style={{
      font: '500 5.5px system-ui,sans-serif',
      fill: color,
    }}
  >
    {text}
  </text>
);

interface GlassLabelProps {
  x: number;
  y: number;
  text: string;
  color: string;
}

/**
 * Etiqueta del tipo de vidrio (ej: "4/12/4").
 */
export const GlassLabel: React.FC<GlassLabelProps> = ({ x, y, text, color }) => (
  <text
    x={x}
    y={y}
    textAnchor="middle"
    style={{
      font: '500 5.5px system-ui,sans-serif',
      fill: color,
    }}
  >
    {text}
  </text>
);

interface GlassCodeLabelProps {
  x: number;
  y: number;
  text: string;
  color: string;
}

/**
 * Etiqueta del código de vidrio HETMO (ej: "V1234").
 */
export const GlassCodeLabel: React.FC<GlassCodeLabelProps> = ({ x, y, text, color }) => (
  <text
    x={x}
    y={y}
    textAnchor="middle"
    style={{
      font: '500 5.5px system-ui,sans-serif',
      fill: color,
    }}
  >
    {text}
  </text>
);