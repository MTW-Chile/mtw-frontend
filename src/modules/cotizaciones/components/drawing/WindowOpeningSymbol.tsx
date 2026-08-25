import React from 'react';
import type { OpeningSymbolSegment, ApertureDefinition } from './types';

interface WindowOpeningSymbolProps {
  segments: OpeningSymbolSegment[];
  definition: ApertureDefinition;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  axisY?: number;
  className?: string;
}

/**
 * Símbolo de apertura de una hoja de ventana.
 * Renderiza triángulos, bisagras, proyectantes, oscilobatientes, etc.
 * basado en los segmentos calculados por el núcleo de geometría.
 */
export const WindowOpeningSymbol: React.FC<WindowOpeningSymbolProps> = ({
  segments,
  definition,
  x,
  y,
  width,
  height,
  color,
  axisY,
  className = 'window-opening-symbol',
}) => {
  if (!segments.length) {
    // Sin segmentos: dibujar marca de fijo (cruz centrada)
    return <FixedMark x={x} y={y} width={width} height={height} color={color} />;
  }

  const alignsWithHandle = ['hinged', 'projecting', 'tilt'].includes(definition.symbol);
  const face = definition.face === 'interior' ? 'Int.' : definition.face === 'exterior' ? 'Ext.' : '';

  return (
    <g className={className}>
      {segments.map((segment, index) => {
        const pointY = alignsWithHandle && index === 1 && axisY !== undefined
          ? axisY
          : undefined;

        const d = segment.points.map(([px, py], ptIndex) => {
          const sy = pointY !== undefined && ptIndex === 1 ? pointY : y + height * py;
          return `${ptIndex === 0 ? 'M' : 'L'} ${x + width * px} ${sy}`;
        }).join(' ');

        const axisAttr = alignsWithHandle && axisY !== undefined
          ? ` data-axis-y="${axisY}"`
          : '';

        return (
          <path
            key={index}
            data-opening-role={segment.role}
            data-opening-face={segment.face || ''}
            {...(axisAttr ? { 'data-axis-y': axisY } : {})}
            d={d}
            style={{
              fill: 'none',
              stroke: color,
              strokeWidth: segment.role === 'tilt' ? 1.05 : 1.2,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              ...(segment.dashed ? { strokeDasharray: '3 2' } : {}),
            }}
          />
        );
      })}
      {face && (
        <text
          x={x + width / 2}
          y={y + 9}
          textAnchor="middle"
          style={{ font: '700 6px system-ui,sans-serif', fill: color }}
        >
          {face}
        </text>
      )}
    </g>
  );
};

// ─── Componentes auxiliares ─────────────────────────────────────────────────

interface FixedMarkProps {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

/**
 * Marca de fijo: cruz centrada en el área de la hoja.
 */
export const FixedMark: React.FC<FixedMarkProps> = ({ x, y, width, height, color }) => {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const size = Math.min(5, Math.max(2.5, Math.min(width, height) * 0.08));

  return (
    <path
      d={`M ${cx - size} ${cy} H ${cx + size} M ${cx} ${cy - size} V ${cy + size}`}
      style={{
        fill: 'none',
        stroke: color,
        strokeWidth: 1.1,
        strokeLinecap: 'round',
      }}
    />
  );
};

interface SlidingMarkProps {
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  axisY?: number;
}

/**
 * Marca de corredera: flecha indicando dirección de desplazamiento.
 */
export const SlidingMark: React.FC<SlidingMarkProps> = ({
  kind,
  x,
  y,
  width,
  height,
  color,
  axisY,
}) => {
  const mid = axisY ?? y + height / 2;

  if (kind === 'fijo') {
    return <FixedMark x={x} y={y} width={width} height={height} color={color} />;
  }

  if (kind.endsWith(':both')) {
    const inset = Math.min(9, Math.max(4, width * 0.16));
    const left = x + inset;
    const right = x + width - inset;
    return (
      <path
        d={`M ${left} ${mid} H ${right} M ${left} ${mid} l 4 -3 M ${left} ${mid} l 4 3 M ${right} ${mid} l -4 -3 M ${right} ${mid} l -4 3`}
        style={{
          fill: 'none',
          stroke: color,
          strokeWidth: 1.15,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
      />
    );
  }

  const direction = kind.endsWith(':right') ? 'right' : 'left';
  const inset = Math.min(9, Math.max(4, width * 0.16));
  const from = direction === 'right' ? x + inset : x + width - inset;
  const to = direction === 'right' ? x + width - inset : x + inset;
  const head = direction === 'right' ? -1 : 1;

  return (
    <path
      d={`M ${from} ${mid} H ${to} M ${to} ${mid} l ${head * 4} -3 M ${to} ${mid} l ${head * 4} 3`}
      style={{
        fill: 'none',
        stroke: color,
        strokeWidth: 1.15,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    />
  );
};

interface HingedMarkProps {
  type: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  axisY?: number;
  segments: OpeningSymbolSegment[];
  definition: ApertureDefinition;
}

/**
 * Marca de practicable/abatible: arco de apertura con bisagra.
 */
export const HingedMark: React.FC<HingedMarkProps> = ({
  type: _type,
  x,
  y,
  width,
  height,
  color,
  axisY,
  segments,
  definition,
}) => (
  <WindowOpeningSymbol
    segments={segments}
    definition={definition}
    x={x}
    y={y}
    width={width}
    height={height}
    color={color}
    axisY={axisY}
  />
);

interface DoubleHingedMarkProps {
  side: 'left' | 'right';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  axisY?: number;
}

/**
 * Marca de doble practicable (2 hojas abatibles).
 */
export const DoubleHingedMark: React.FC<DoubleHingedMarkProps> = ({
  side,
  x,
  y,
  width,
  height,
  color,
  axisY,
}) => {
  const edge = side === 'left' ? x + 4 : x + width - 4;
  const centre = side === 'left' ? x + width - 4 : x + 4;
  const ay = axisY ?? y + height / 2;

  return (
    <path
      data-opening-role="turn"
      data-axis-y={ay}
      d={`M ${edge} ${y + 4} L ${centre} ${ay} L ${edge} ${y + height - 4}`}
      style={{
        fill: 'none',
        stroke: color,
        strokeWidth: 1.2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    />
  );
};

interface DoubleTiltTurnMarkProps {
  side: 'left' | 'right';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  axisY?: number;
}

/**
 * Marca de doble oscilobatiente.
 */
export const DoubleTiltTurnMark: React.FC<DoubleTiltTurnMarkProps> = ({
  side,
  x,
  y,
  width,
  height,
  color,
  axisY,
}) => (
  <g>
    <DoubleHingedMark
      side={side}
      x={x}
      y={y}
      width={width}
      height={height}
      color={color}
      axisY={axisY}
    />
    <path
      data-opening-role="tilt"
      data-opening-face="interior"
      d={`M ${x + 4} ${y + height - 4} L ${x + width / 2} ${y + 4} L ${x + width - 4} ${y + height - 4}`}
      style={{
        fill: 'none',
        stroke: color,
        strokeWidth: 1.05,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    />
  </g>
);