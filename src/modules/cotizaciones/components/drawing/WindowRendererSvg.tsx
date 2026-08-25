import React from 'react';
import type { Ventana } from '../../../../types';
import { getFinishColors, detectApertureType } from './windowDrawingEngine';

interface WindowRendererSvgProps {
  ventana: Ventana;
  className?: string;
  showDimensions?: boolean;
}

export const WindowRendererSvg: React.FC<WindowRendererSvgProps> = ({
  ventana,
  className = 'w-full h-48',
  showDimensions = true,
}) => {
  const widthMm = ventana.anchoMm || 1000;
  const heightMm = ventana.altoMm || 1000;
  const finish = getFinishColors(ventana.acabadoCodigo);
  const aperture = detectApertureType(ventana);

  // Dimensiones del canvas SVG
  const canvasW = 240;
  const canvasH = 180;
  const paddingX = showDimensions ? 28 : 12;
  const paddingY = showDimensions ? 22 : 12;
  const maxDrawW = canvasW - paddingX * 2;
  const maxDrawH = canvasH - paddingY * 2;

  // Escalar manteniendo proporción
  const ratio = widthMm / Math.max(1, heightMm);
  let drawW = maxDrawW;
  let drawH = maxDrawW / ratio;

  if (drawH > maxDrawH) {
    drawH = maxDrawH;
    drawW = maxDrawH * ratio;
  }

  const startX = (canvasW - drawW) / 2 - (showDimensions ? 4 : 0);
  const startY = (canvasH - drawH) / 2 - (showDimensions ? 4 : 0);
  const frameThickness = 6;
  const sashThickness = 4;

  const innerX = startX + frameThickness;
  const innerY = startY + frameThickness;
  const innerW = drawW - frameThickness * 2;
  const innerH = drawH - frameThickness * 2;

  return (
    <svg
      viewBox={`0 0 ${canvasW} ${canvasH}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Esquema de ventana ${ventana.modelo}`}
    >
      <defs>
        <linearGradient id={`glassGrad-${ventana.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#BAE6FD" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#E0F2FE" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* 1. Marco Exterior Perimetral */}
      <rect
        x={startX}
        y={startY}
        width={drawW}
        height={drawH}
        fill={finish.frame}
        stroke={finish.frameStroke}
        strokeWidth="1.5"
        rx="1"
      />

      {/* 2. Hueco Interior / Luz */}
      <rect
        x={innerX}
        y={innerY}
        width={innerW}
        height={innerH}
        fill={`url(#glassGrad-${ventana.id})`}
        stroke={finish.frameStroke}
        strokeWidth="1"
      />

      {/* 3. Renderizado de Hojas según Tipo de Apertura */}

      {/* CASO: FIJO (Sin hojas móviles) */}
      {aperture === 'fixed' && (
        <g>
          {/* Junquillo perimetral */}
          <rect
            x={innerX + 2}
            y={innerY + 2}
            width={innerW - 4}
            height={innerH - 4}
            fill="none"
            stroke={finish.sashStroke}
            strokeWidth="0.75"
            strokeDasharray="2 2"
          />
        </g>
      )}

      {/* CASO: CORREDERA 2 HOJAS */}
      {aperture === 'sliding-2' && (
        <g>
          {/* Hoja Izquierda */}
          <rect
            x={innerX + 1}
            y={innerY + 1}
            width={innerW / 2 + 3}
            height={innerH - 2}
            fill={finish.sash}
            stroke={finish.sashStroke}
            strokeWidth="1.2"
          />
          <rect
            x={innerX + 1 + sashThickness}
            y={innerY + 1 + sashThickness}
            width={innerW / 2 + 3 - sashThickness * 2}
            height={innerH - 2 - sashThickness * 2}
            fill={`url(#glassGrad-${ventana.id})`}
            stroke={finish.glassStroke}
            strokeWidth="0.8"
          />
          {/* Flecha Hoja Izquierda -> hacia la derecha */}
          <path
            d={`M ${innerX + innerW / 4 - 8} ${innerY + innerH / 2} L ${innerX + innerW / 4 + 8} ${innerY + innerH / 2} M ${innerX + innerW / 4 + 4} ${innerY + innerH / 2 - 4} L ${innerX + innerW / 4 + 8} ${innerY + innerH / 2} L ${innerX + innerW / 4 + 4} ${innerY + innerH / 2 + 4}`}
            stroke={finish.symbolColor}
            strokeWidth="1.75"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Hoja Derecha */}
          <rect
            x={innerX + innerW / 2 - 3}
            y={innerY + 1}
            width={innerW / 2 + 2}
            height={innerH - 2}
            fill={finish.sash}
            stroke={finish.sashStroke}
            strokeWidth="1.2"
          />
          <rect
            x={innerX + innerW / 2 - 3 + sashThickness}
            y={innerY + 1 + sashThickness}
            width={innerW / 2 + 2 - sashThickness * 2}
            height={innerH - 2 - sashThickness * 2}
            fill={`url(#glassGrad-${ventana.id})`}
            stroke={finish.glassStroke}
            strokeWidth="0.8"
          />
          {/* Flecha Hoja Derecha <- hacia la izquierda */}
          <path
            d={`M ${innerX + (3 * innerW) / 4 + 8} ${innerY + innerH / 2} L ${innerX + (3 * innerW) / 4 - 8} ${innerY + innerH / 2} M ${innerX + (3 * innerW) / 4 - 4} ${innerY + innerH / 2 - 4} L ${innerX + (3 * innerW) / 4 - 8} ${innerY + innerH / 2} L ${innerX + (3 * innerW) / 4 - 4} ${innerY + innerH / 2 + 4}`}
            stroke={finish.symbolColor}
            strokeWidth="1.75"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}

      {/* CASO: CORREDERA 3 HOJAS */}
      {aperture === 'sliding-3' && (
        <g>
          {[0, 1, 2].map((idx) => {
            const leafW = innerW / 3 + (idx < 2 ? 3 : 0);
            const leafX = innerX + (idx * innerW) / 3 - (idx > 0 ? 2 : 0);
            return (
              <g key={idx}>
                <rect
                  x={leafX}
                  y={innerY + 1}
                  width={leafW}
                  height={innerH - 2}
                  fill={finish.sash}
                  stroke={finish.sashStroke}
                  strokeWidth="1.2"
                />
                <rect
                  x={leafX + sashThickness}
                  y={innerY + 1 + sashThickness}
                  width={leafW - sashThickness * 2}
                  height={innerH - 2 - sashThickness * 2}
                  fill={`url(#glassGrad-${ventana.id})`}
                  stroke={finish.glassStroke}
                  strokeWidth="0.8"
                />
                <path
                  d={`M ${leafX + leafW / 2 - 6} ${innerY + innerH / 2} L ${leafX + leafW / 2 + 6} ${innerY + innerH / 2} M ${leafX + leafW / 2 + 2} ${innerY + innerH / 2 - 3} L ${leafX + leafW / 2 + 6} ${innerY + innerH / 2} L ${leafX + leafW / 2 + 2} ${innerY + innerH / 2 + 3}`}
                  stroke={finish.symbolColor}
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </g>
      )}

      {/* CASO: CORREDERA 4 HOJAS (Fijo - Móvil - Móvil - Fijo) */}
      {aperture === 'sliding-4' && (
        <g>
          {[0, 1, 2, 3].map((idx) => {
            const leafW = innerW / 4 + 2;
            const leafX = innerX + (idx * innerW) / 4;
            const isFijo = idx === 0 || idx === 3;
            return (
              <g key={idx}>
                <rect
                  x={leafX}
                  y={innerY + 1}
                  width={leafW}
                  height={innerH - 2}
                  fill={finish.sash}
                  stroke={finish.sashStroke}
                  strokeWidth="1.2"
                />
                <rect
                  x={leafX + sashThickness}
                  y={innerY + 1 + sashThickness}
                  width={leafW - sashThickness * 2}
                  height={innerH - 2 - sashThickness * 2}
                  fill={`url(#glassGrad-${ventana.id})`}
                  stroke={finish.glassStroke}
                  strokeWidth="0.8"
                />
                {!isFijo && (
                  <path
                    d={
                      idx === 1
                        ? `M ${leafX + leafW / 2 - 5} ${innerY + innerH / 2} L ${leafX + leafW / 2 + 5} ${innerY + innerH / 2} M ${leafX + leafW / 2 + 2} ${innerY + innerH / 2 - 3} L ${leafX + leafW / 2 + 5} ${innerY + innerH / 2} L ${leafX + leafW / 2 + 2} ${innerY + innerH / 2 + 3}`
                        : `M ${leafX + leafW / 2 + 5} ${innerY + innerH / 2} L ${leafX + leafW / 2 - 5} ${innerY + innerH / 2} M ${leafX + leafW / 2 - 2} ${innerY + innerH / 2 - 3} L ${leafX + leafW / 2 - 5} ${innerY + innerH / 2} L ${leafX + leafW / 2 - 2} ${innerY + innerH / 2 + 3}`
                    }
                    stroke={finish.symbolColor}
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                )}
              </g>
            );
          })}
        </g>
      )}

      {/* CASO: PRACTICABLE / BATIENTE */}
      {(aperture === 'hinged-left' || aperture === 'hinged-right') && (
        <g>
          <rect
            x={innerX + 1}
            y={innerY + 1}
            width={innerW - 2}
            height={innerH - 2}
            fill={finish.sash}
            stroke={finish.sashStroke}
            strokeWidth="1.2"
          />
          <rect
            x={innerX + 1 + sashThickness}
            y={innerY + 1 + sashThickness}
            width={innerW - 2 - sashThickness * 2}
            height={innerH - 2 - sashThickness * 2}
            fill={`url(#glassGrad-${ventana.id})`}
            stroke={finish.glassStroke}
            strokeWidth="0.8"
          />
          {/* Triángulo de Apertura */}
          <path
            d={
              aperture === 'hinged-right'
                ? `M ${innerX + innerW - 4} ${innerY + 4} L ${innerX + 4} ${innerY + innerH / 2} L ${innerX + innerW - 4} ${innerY + innerH - 4}`
                : `M ${innerX + 4} ${innerY + 4} L ${innerX + innerW - 4} ${innerY + innerH / 2} L ${innerX + 4} ${innerY + innerH - 4}`
            }
            stroke={finish.symbolColor}
            strokeWidth="1.2"
            strokeDasharray="3 3"
            fill="none"
          />
        </g>
      )}

      {/* CASO: OSCILOBATIENTE */}
      {(aperture === 'tilt-turn-left' || aperture === 'tilt-turn-right') && (
        <g>
          <rect
            x={innerX + 1}
            y={innerY + 1}
            width={innerW - 2}
            height={innerH - 2}
            fill={finish.sash}
            stroke={finish.sashStroke}
            strokeWidth="1.2"
          />
          <rect
            x={innerX + 1 + sashThickness}
            y={innerY + 1 + sashThickness}
            width={innerW - 2 - sashThickness * 2}
            height={innerH - 2 - sashThickness * 2}
            fill={`url(#glassGrad-${ventana.id})`}
            stroke={finish.glassStroke}
            strokeWidth="0.8"
          />
          {/* Giro lateral */}
          <path
            d={
              aperture === 'tilt-turn-right'
                ? `M ${innerX + innerW - 4} ${innerY + 4} L ${innerX + 4} ${innerY + innerH / 2} L ${innerX + innerW - 4} ${innerY + innerH - 4}`
                : `M ${innerX + 4} ${innerY + 4} L ${innerX + innerW - 4} ${innerY + innerH / 2} L ${innerX + 4} ${innerY + innerH - 4}`
            }
            stroke={finish.symbolColor}
            strokeWidth="1.2"
            strokeDasharray="3 3"
            fill="none"
          />
          {/* Oscilo basculante */}
          <path
            d={`M ${innerX + 4} ${innerY + innerH - 4} L ${innerX + innerW / 2} ${innerY + 4} L ${innerX + innerW - 4} ${innerY + innerH - 4}`}
            stroke={finish.symbolColor}
            strokeWidth="1.2"
            strokeDasharray="3 3"
            fill="none"
          />
        </g>
      )}

      {/* CASO: PROYECTANTE */}
      {aperture === 'projecting' && (
        <g>
          <rect
            x={innerX + 1}
            y={innerY + 1}
            width={innerW - 2}
            height={innerH - 2}
            fill={finish.sash}
            stroke={finish.sashStroke}
            strokeWidth="1.2"
          />
          <rect
            x={innerX + 1 + sashThickness}
            y={innerY + 1 + sashThickness}
            width={innerW - 2 - sashThickness * 2}
            height={innerH - 2 - sashThickness * 2}
            fill={`url(#glassGrad-${ventana.id})`}
            stroke={finish.glassStroke}
            strokeWidth="0.8"
          />
          {/* Triángulo proyectante superior hacia abajo */}
          <path
            d={`M ${innerX + 4} ${innerY + 4} L ${innerX + innerW / 2} ${innerY + innerH - 4} L ${innerX + innerW - 4} ${innerY + 4}`}
            stroke={finish.symbolColor}
            strokeWidth="1.2"
            strokeDasharray="3 3"
            fill="none"
          />
        </g>
      )}

      {/* CASO: PUERTA DOBLE */}
      {aperture === 'double-door' && (
        <g>
          {/* Hoja Izquierda */}
          <rect
            x={innerX + 1}
            y={innerY + 1}
            width={innerW / 2 - 1}
            height={innerH - 2}
            fill={finish.sash}
            stroke={finish.sashStroke}
            strokeWidth="1.2"
          />
          <rect
            x={innerX + 1 + sashThickness}
            y={innerY + 1 + sashThickness}
            width={innerW / 2 - 1 - sashThickness * 2}
            height={innerH - 2 - sashThickness * 2}
            fill={`url(#glassGrad-${ventana.id})`}
            stroke={finish.glassStroke}
            strokeWidth="0.8"
          />
          <path
            d={`M ${innerX + 4} ${innerY + 4} L ${innerX + innerW / 2 - 4} ${innerY + innerH / 2} L ${innerX + 4} ${innerY + innerH - 4}`}
            stroke={finish.symbolColor}
            strokeWidth="1.2"
            strokeDasharray="3 3"
            fill="none"
          />

          {/* Hoja Derecha */}
          <rect
            x={innerX + innerW / 2}
            y={innerY + 1}
            width={innerW / 2 - 1}
            height={innerH - 2}
            fill={finish.sash}
            stroke={finish.sashStroke}
            strokeWidth="1.2"
          />
          <rect
            x={innerX + innerW / 2 + sashThickness}
            y={innerY + 1 + sashThickness}
            width={innerW / 2 - 1 - sashThickness * 2}
            height={innerH - 2 - sashThickness * 2}
            fill={`url(#glassGrad-${ventana.id})`}
            stroke={finish.glassStroke}
            strokeWidth="0.8"
          />
          <path
            d={`M ${innerX + innerW - 4} ${innerY + 4} L ${innerX + innerW / 2 + 4} ${innerY + innerH / 2} L ${innerX + innerW - 4} ${innerY + innerH - 4}`}
            stroke={finish.symbolColor}
            strokeWidth="1.2"
            strokeDasharray="3 3"
            fill="none"
          />
        </g>
      )}

      {/* 4. Cotas y Dimensiones de Fabricación */}
      {showDimensions && (
        <g className="text-[9px] font-mono select-none" fill="#64748B">
          {/* Cota Inferior (Ancho) */}
          <line
            x1={startX}
            y1={startY + drawH + 10}
            x2={startX + drawW}
            y2={startY + drawH + 10}
            stroke="#94A3B8"
            strokeWidth="0.75"
          />
          <line
            x1={startX}
            y1={startY + drawH + 7}
            x2={startX}
            y2={startY + drawH + 13}
            stroke="#94A3B8"
            strokeWidth="0.75"
          />
          <line
            x1={startX + drawW}
            y1={startY + drawH + 7}
            x2={startX + drawW}
            y2={startY + drawH + 13}
            stroke="#94A3B8"
            strokeWidth="0.75"
          />
          <text
            x={startX + drawW / 2}
            y={startY + drawH + 18}
            textAnchor="middle"
            className="text-[8px] font-bold"
          >
            {widthMm} mm
          </text>

          {/* Cota Lateral Derecha (Alto) */}
          <line
            x1={startX + drawW + 10}
            y1={startY}
            x2={startX + drawW + 10}
            y2={startY + drawH}
            stroke="#94A3B8"
            strokeWidth="0.75"
          />
          <line
            x1={startX + drawW + 7}
            y1={startY}
            x2={startX + drawW + 13}
            y2={startY}
            stroke="#94A3B8"
            strokeWidth="0.75"
          />
          <line
            x1={startX + drawW + 7}
            y1={startY + drawH}
            x2={startX + drawW + 13}
            y2={startY + drawH}
            stroke="#94A3B8"
            strokeWidth="0.75"
          />
          <text
            x={startX + drawW + 15}
            y={startY + drawH / 2 + 3}
            textAnchor="start"
            className="text-[8px] font-bold"
          >
            {heightMm} mm
          </text>
        </g>
      )}
    </svg>
  );
};
