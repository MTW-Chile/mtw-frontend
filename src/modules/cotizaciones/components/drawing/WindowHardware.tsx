import React from 'react';
import type { HardwareSpec, MetalColorSet } from './types';

interface WindowHardwareProps {
  spec: HardwareSpec;
  metal: MetalColorSet;
  x: number;
  y: number;
  width: number;
  height: number;
  axisY: number;
  className?: string;
}

/**
 * Renderiza el herraje de una hoja: manilla o cerradero.
 * La manilla incluye placa base, palanca y brillo.
 * El cerradero es un rectángulo con detalles metálicos.
 */
export const WindowHardware: React.FC<WindowHardwareProps> = ({
  spec,
  metal,
  x,
  y,
  width,
  height,
  axisY,
  className = 'window-hardware',
}) => {
  if (spec.role === 'none') return null;

  const hy = spec.position === 'bottom'
    ? y + height - 3
    : spec.position === 'top'
      ? y + 3
      : axisY;

  const side = spec.side === 'left' ? 'left' : spec.side === 'right' ? 'right' : 'center';
  const hx = side === 'left'
    ? x + 3.5
    : side === 'right'
      ? x + width - 3.5
      : x + width / 2;

  if (spec.role === 'striker') {
    return (
      <g className={`${className} window-striker`} data-reason={spec.reason}>
        <rect
          x={hx - 1.3}
          y={hy - 7}
          width={2.6}
          height={14}
          rx={0.9}
          style={{ fill: metal.base, stroke: metal.edge, strokeWidth: 0.45 }}
        />
        <line
          x1={hx - 0.75}
          y1={hy - 6}
          x2={hx - 0.75}
          y2={hy + 6}
          style={{
            fill: 'none',
            stroke: metal.light,
            strokeWidth: 0.55,
            strokeLinecap: 'round',
            opacity: 0.8,
          }}
        />
        <rect
          x={hx - 2.6}
          y={hy - 2.6}
          width={5.2}
          height={5.2}
          rx={0.9}
          style={{ fill: metal.base, stroke: metal.edge, strokeWidth: 0.45 }}
        />
      </g>
    );
  }

  // Manilla (handle)
  const leverX = side === 'left'
    ? hx + 8
    : side === 'right'
      ? hx - 8
      : hx;
  const leverY = spec.orientation === 'up'
    ? hy - 9
    : spec.position === 'top'
      ? hy + 9
      : hy;

  const lever = side === 'center'
    ? `M ${hx} ${hy} L ${leverX} ${leverY}`
    : `M ${hx} ${hy} H ${leverX}`;

  const glare = side === 'center'
    ? `M ${hx - 0.7} ${hy} L ${leverX - 0.7} ${leverY}`
    : `M ${hx} ${hy - 0.75} H ${leverX}`;

  const heightSource = spec.position
    ? `${spec.position}-by-opening`
    : spec.reason;

  return (
    <g
      className={`${className} window-handle`}
      data-axis-y={hy}
      data-height-source={heightSource}
      data-reason={spec.reason || 'opening-leaf'}
    >
      {/* Círculo base */}
      <circle
        cx={hx}
        cy={hy}
        r={2.4}
        style={{ fill: metal.base, stroke: metal.edge, strokeWidth: 0.45 }}
      />
      {/* Brillo del círculo */}
      <circle
        cx={hx - 0.6}
        cy={hy - 0.6}
        r={1}
        style={{ fill: metal.light, opacity: 0.8 }}
      />
      {/* Palanca - capa base */}
      <path
        d={lever}
        style={{
          fill: 'none',
          stroke: metal.base,
          strokeWidth: 3,
          strokeLinecap: 'round',
        }}
      />
      {/* Palanca - borde */}
      <path
        d={lever}
        style={{
          fill: 'none',
          stroke: metal.edge,
          strokeWidth: 3.6,
          strokeLinecap: 'round',
          opacity: 0.35,
        }}
      />
      {/* Palanca - interior */}
      <path
        d={lever}
        style={{
          fill: 'none',
          stroke: metal.base,
          strokeWidth: 2.8,
          strokeLinecap: 'round',
        }}
      />
      {/* Brillo de la palanca */}
      <path
        d={glare}
        style={{
          fill: 'none',
          stroke: metal.light,
          strokeWidth: 0.8,
          strokeLinecap: 'round',
          opacity: 0.85,
        }}
      />
    </g>
  );
};

interface WindowHingeProps {
  side: 'left' | 'right';
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
  reason: string;
  metal: MetalColorSet;
  className?: string;
}

/**
 * Renderiza bisagras de una hoja practicable.
 * Cada bisagra es un cilindro metálico (nudillo) con brillo y sombra.
 */
export const WindowHinge: React.FC<WindowHingeProps> = ({
  side,
  count,
  x,
  y,
  width,
  height,
  reason,
  metal,
  className = 'window-hinge',
}) => {
  if (!count || (side !== 'left' && side !== 'right')) return null;

  const hx = side === 'left' ? x + 2.2 : x + width - 2.2;
  const barrel = Math.min(9, Math.max(5, height * 0.07));
  const thickness = 2.6;

  return (
    <g className={className} data-reason={reason}>
      {Array.from({ length: count }, (_, index) => {
        const hy = y + height * (index + 1) / (count + 1);
        const top = hy - barrel / 2;
        return (
          <g key={index}>
            <rect
              x={hx - thickness / 2}
              y={top}
              width={thickness}
              height={barrel}
              rx={thickness / 2}
              style={{ fill: metal.base, stroke: metal.edge, strokeWidth: 0.45 }}
            />
            <line
              x1={hx - thickness / 2 + 0.55}
              y1={top + 0.8}
              x2={hx - thickness / 2 + 0.55}
              y2={top + barrel - 0.8}
              style={{
                fill: 'none',
                stroke: metal.light,
                strokeWidth: 0.6,
                strokeLinecap: 'round',
                opacity: 0.85,
              }}
            />
          </g>
        );
      })}
    </g>
  );
};