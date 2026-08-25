import React from 'react';
import type { MetalColorSet } from './types';

interface SlidingHardwareSpec {
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

interface WindowSlidingHardwareProps {
  hardware: SlidingHardwareSpec[];
  metal: MetalColorSet;
  className?: string;
}

/**
 * Renderiza herrajes de corredera: manillas, cerraderos, flechas de apertura,
 * iconos de pasivo/activo, etc. para ventanas corredizas.
 */
export const WindowSlidingHardware: React.FC<WindowSlidingHardwareProps> = ({
  hardware,
  metal,
  className = 'window-sliding-hardware',
}) => {
  if (!hardware.length) return null;

  return (
    <g className={className}>
      {hardware.map((spec, index) => {
        const cx = spec.x + spec.width / 2;
        const cy = spec.y + spec.height / 2;

        switch (spec.kind) {
          case 'handle':
            return (
              <g key={index}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={2.4}
                  style={{ fill: metal.base, stroke: metal.edge, strokeWidth: 0.45 }}
                />
                <circle
                  cx={cx - 0.6}
                  cy={cy - 0.6}
                  r={1}
                  style={{ fill: metal.light, opacity: 0.8 }}
                />
              </g>
            );

          case 'striker':
            return (
              <g key={index}>
                <rect
                  x={cx - 1.3}
                  y={cy - 7}
                  width={2.6}
                  height={14}
                  rx={0.9}
                  style={{ fill: metal.base, stroke: metal.edge, strokeWidth: 0.45 }}
                />
                <line
                  x1={cx - 0.75}
                  y1={cy - 6}
                  x2={cx - 0.75}
                  y2={cy + 6}
                  style={{
                    fill: 'none',
                    stroke: metal.light,
                    strokeWidth: 0.55,
                    strokeLinecap: 'round',
                    opacity: 0.8,
                  }}
                />
              </g>
            );

          case 'arrow-right':
            return (
              <path
                key={index}
                d={`M ${spec.x + 2} ${cy} H ${spec.x + spec.width - 2} M ${spec.x + spec.width - 6} ${cy - 3} l 4 3 l -4 3`}
                style={{
                  fill: 'none',
                  stroke: metal.base,
                  strokeWidth: 1.15,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }}
              />
            );

          case 'arrow-left':
            return (
              <path
                key={index}
                d={`M ${spec.x + spec.width - 2} ${cy} H ${spec.x + 2} M ${spec.x + 6} ${cy - 3} l -4 3 l 4 3`}
                style={{
                  fill: 'none',
                  stroke: metal.base,
                  strokeWidth: 1.15,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }}
              />
            );

          case 'active':
            return (
              <g key={index}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={3}
                  style={{ fill: 'none', stroke: metal.base, strokeWidth: 0.8 }}
                />
                <line
                  x1={cx - 1.5}
                  y1={cy}
                  x2={cx + 1.5}
                  y2={cy}
                  style={{
                    fill: 'none',
                    stroke: metal.base,
                    strokeWidth: 0.8,
                    strokeLinecap: 'round',
                  }}
                />
              </g>
            );

          case 'passive':
            return (
              <g key={index}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={3}
                  style={{ fill: 'none', stroke: metal.base, strokeWidth: 0.8 }}
                />
                <line
                  x1={cx - 1.5}
                  y1={cy}
                  x2={cx + 1.5}
                  y2={cy}
                  style={{
                    fill: 'none',
                    stroke: metal.base,
                    strokeWidth: 0.8,
                    strokeLinecap: 'round',
                  }}
                />
                <line
                  x1={cx}
                  y1={cy - 1.5}
                  x2={cx}
                  y2={cy + 1.5}
                  style={{
                    fill: 'none',
                    stroke: metal.base,
                    strokeWidth: 0.8,
                    strokeLinecap: 'round',
                  }}
                />
              </g>
            );

          case 'reciprocal':
            return (
              <g key={index}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={3}
                  style={{ fill: 'none', stroke: metal.base, strokeWidth: 0.8 }}
                />
                <path
                  d={`M ${cx - 2} ${cy - 1.5} l 2 -1.5 l 2 1.5 M ${cx - 2} ${cy + 1.5} l 2 1.5 l 2 -1.5`}
                  style={{
                    fill: 'none',
                    stroke: metal.base,
                    strokeWidth: 0.7,
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                  }}
                />
              </g>
            );

          case 'label':
            return (
              <text
                key={index}
                x={cx}
                y={cy + 1.5}
                textAnchor="middle"
                style={{
                  font: '500 5px system-ui,sans-serif',
                  fill: metal.base,
                }}
              >
                {spec.label ?? ''}
              </text>
            );

          default:
            return null;
        }
      })}
    </g>
  );
};