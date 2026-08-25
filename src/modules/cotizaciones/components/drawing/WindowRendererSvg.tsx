import React, { useMemo } from 'react';
import type { Ventana } from '../../../../types';
import { 
  getProfileFinish, 
  resolveAperture, 
  computeWindowLeaves,
  type ComputedLeaf
} from './windowDrawingEngine';

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
  const widthMm = Math.max(100, ventana.anchoMm || 1000);
  const heightMm = Math.max(100, ventana.altoMm || 1000);

  // Paleta de acabados y especificación de apertura (memoizado para máximo rendimiento)
  const finish = useMemo(() => getProfileFinish(ventana.acabadoCodigo), [ventana.acabadoCodigo]);
  const spec = useMemo(() => resolveAperture(ventana), [ventana]);

  // Dimensiones del canvas SVG
  const canvasW = 240;
  const canvasH = 180;
  const paddingX = showDimensions ? 28 : 12;
  const paddingY = showDimensions ? 22 : 12;
  const maxDrawW = canvasW - paddingX * 2;
  const maxDrawH = canvasH - paddingY * 2;

  // Escala manteniendo la proporción exacta
  const ratio = widthMm / heightMm;
  let drawW = maxDrawW;
  let drawH = maxDrawW / ratio;

  if (drawH > maxDrawH) {
    drawH = maxDrawH;
    drawW = maxDrawH * ratio;
  }

  const startX = (canvasW - drawW) / 2 - (showDimensions ? 4 : 0);
  const startY = (canvasH - drawH) / 2 - (showDimensions ? 4 : 0);
  
  // Grosor de marco y hoja adaptados a la escala
  const frameThickness = Math.max(4, Math.min(8, Math.min(drawW, drawH) * 0.06));
  const sashThickness = Math.max(3, frameThickness * 0.75);

  const innerX = startX + frameThickness;
  const innerY = startY + frameThickness;
  const innerW = drawW - frameThickness * 2;
  const innerH = drawH - frameThickness * 2;

  // Hojas calculadas
  const leaves = useMemo(() => {
    return computeWindowLeaves(
      spec,
      ventana.geometrias,
      innerX,
      innerY,
      innerW,
      innerH,
      widthMm
    );
  }, [spec, ventana.geometrias, innerX, innerY, innerW, innerH, widthMm]);

  return (
    <svg
      viewBox={`0 0 ${canvasW} ${canvasH}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Esquema técnico de ventana ${ventana.modelo}`}
    >
      <defs>
        {/* Gradiente de vidrio con reflejo diagonal */}
        <linearGradient id={`glassGrad-${ventana.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#BAE6FD" stopOpacity="0.7" />
          <stop offset="55%" stopColor="#E0F2FE" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.75" />
        </linearGradient>

        {/* Filtro de sombra suave para relieve */}
        <filter id="shadowRelief" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0.5" dy="0.5" stdDeviation="0.5" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* 1. MARCO EXTERIOR PERIMETRAL CON RELIEVE 3D */}
      <g>
        {/* Base del Marco */}
        <rect
          x={startX}
          y={startY}
          width={drawW}
          height={drawH}
          fill={finish.base}
          stroke={finish.stroke}
          strokeWidth="1.2"
        />

        {/* Bisel Superior / Izquierdo (Luz) */}
        <path
          d={`M ${startX} ${startY} L ${startX + drawW} ${startY} L ${startX + drawW - frameThickness} ${startY + frameThickness} L ${startX + frameThickness} ${startY + frameThickness} L ${startX + frameThickness} ${startY + drawH - frameThickness} L ${startX} ${startY + drawH} Z`}
          fill={finish.light}
          opacity="0.6"
        />

        {/* Bisel Inferior / Derecho (Sombra) */}
        <path
          d={`M ${startX + drawW} ${startY} L ${startX + drawW} ${startY + drawH} L ${startX} ${startY + drawH} L ${startX + frameThickness} ${startY + drawH - frameThickness} L ${startX + drawW - frameThickness} ${startY + drawH - frameThickness} L ${startX + drawW - frameThickness} ${startY + frameThickness} Z`}
          fill={finish.dark}
          opacity="0.45"
        />

        {/* Línea interior del marco */}
        <rect
          x={innerX}
          y={innerY}
          width={innerW}
          height={innerH}
          fill="none"
          stroke={finish.stroke}
          strokeWidth="0.8"
        />
      </g>

      {/* 2. RENDERIZADO DE HOJAS Y PANELES */}
      {leaves.map((leaf: ComputedLeaf) => {
        const isFijo = leaf.role === 'fijo';
        const leafSashW = isFijo ? leaf.width : leaf.width - 1.5;
        const leafSashH = isFijo ? leaf.height : leaf.height - 1.5;
        const leafSashX = isFijo ? leaf.x : leaf.x + 0.75;
        const leafSashY = isFijo ? leaf.y : leaf.y + 0.75;

        const glassX = leafSashX + (isFijo ? 2 : sashThickness);
        const glassY = leafSashY + (isFijo ? 2 : sashThickness);
        const glassW = Math.max(2, leafSashW - (isFijo ? 4 : sashThickness * 2));
        const glassH = Math.max(2, leafSashH - (isFijo ? 4 : sashThickness * 2));

        return (
          <g key={leaf.index}>
            {/* Hoja Móvil / Junquillo */}
            {!isFijo && (
              <g>
                {/* Cuerpo de la hoja */}
                <rect
                  x={leafSashX}
                  y={leafSashY}
                  width={leafSashW}
                  height={leafSashH}
                  fill={finish.base}
                  stroke={finish.stroke}
                  strokeWidth="1"
                />

                {/* Luz superior de la hoja */}
                <line
                  x1={leafSashX}
                  y1={leafSashY}
                  x2={leafSashX + leafSashW}
                  y2={leafSashY}
                  stroke={finish.light}
                  strokeWidth="1.2"
                />
                <line
                  x1={leafSashX}
                  y1={leafSashY}
                  x2={leafSashX}
                  y2={leafSashY + leafSashH}
                  stroke={finish.light}
                  strokeWidth="1.2"
                />

                {/* Sombra inferior de la hoja */}
                <line
                  x1={leafSashX}
                  y1={leafSashY + leafSashH}
                  x2={leafSashX + leafSashW}
                  y2={leafSashY + leafSashH}
                  stroke={finish.dark}
                  strokeWidth="1.2"
                />
                <line
                  x1={leafSashX + leafSashW}
                  y1={leafSashY}
                  x2={leafSashX + leafSashW}
                  y2={leafSashY + leafSashH}
                  stroke={finish.dark}
                  strokeWidth="1.2"
                />
              </g>
            )}

            {/* Panel de Vidrio */}
            <rect
              x={glassX}
              y={glassY}
              width={glassW}
              height={glassH}
              fill={`url(#glassGrad-${ventana.id})`}
              stroke={finish.glassStroke}
              strokeWidth="0.75"
            />

            {/* Junquillo en paño fijo */}
            {isFijo && (
              <rect
                x={glassX + 1}
                y={glassY + 1}
                width={glassW - 2}
                height={glassH - 2}
                fill="none"
                stroke={finish.stroke}
                strokeWidth="0.5"
                strokeDasharray="2 2"
                opacity="0.6"
              />
            )}

            {/* 3. SÍMBOLOS TÉCNICOS DE APERTURA */}

            {/* Flecha Corredera hacia la Derecha (→) */}
            {leaf.role === 'right' && (
              <g>
                <path
                  d={`M ${glassX + glassW / 2 - 8} ${glassY + glassH / 2} L ${glassX + glassW / 2 + 8} ${glassY + glassH / 2} M ${glassX + glassW / 2 + 4} ${glassY + glassH / 2 - 4} L ${glassX + glassW / 2 + 8} ${glassY + glassH / 2} L ${glassX + glassW / 2 + 4} ${glassY + glassH / 2 + 4}`}
                  stroke={finish.symbolColor}
                  strokeWidth="1.75"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Manilla interior */}
                <rect
                  x={leafSashX + 2}
                  y={leafSashY + leafSashH / 2 - 5}
                  width="2.5"
                  height="10"
                  fill={finish.dark}
                  rx="1"
                />
              </g>
            )}

            {/* Flecha Corredera hacia la Izquierda (←) */}
            {leaf.role === 'left' && (
              <g>
                <path
                  d={`M ${glassX + glassW / 2 + 8} ${glassY + glassH / 2} L ${glassX + glassW / 2 - 8} ${glassY + glassH / 2} M ${glassX + glassW / 2 - 4} ${glassY + glassH / 2 - 4} L ${glassX + glassW / 2 - 8} ${glassY + glassH / 2} L ${glassX + glassW / 2 - 4} ${glassY + glassH / 2 + 4}`}
                  stroke={finish.symbolColor}
                  strokeWidth="1.75"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Manilla interior */}
                <rect
                  x={leafSashX + leafSashW - 4.5}
                  y={leafSashY + leafSashH / 2 - 5}
                  width="2.5"
                  height="10"
                  fill={finish.dark}
                  rx="1"
                />
              </g>
            )}

            {/* Practicable Derecha (Bisagra derecha, manilla izquierda) */}
            {leaf.role === 'hinged-right' && (
              <g>
                <path
                  d={`M ${glassX + glassW - 2} ${glassY + 2} L ${glassX + 2} ${glassY + glassH / 2} L ${glassX + glassW - 2} ${glassY + glassH - 2}`}
                  stroke={finish.symbolColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  fill="none"
                />
                {/* Manilla a la izquierda */}
                <rect
                  x={leafSashX + 2}
                  y={leafSashY + leafSashH / 2 - 5}
                  width="2.5"
                  height="10"
                  fill={finish.dark}
                  rx="1"
                />
              </g>
            )}

            {/* Practicable Izquierda (Bisagra izquierda, manilla derecha) */}
            {leaf.role === 'hinged-left' && (
              <g>
                <path
                  d={`M ${glassX + 2} ${glassY + 2} L ${glassX + glassW - 2} ${glassY + glassH / 2} L ${glassX + 2} ${glassY + glassH - 2}`}
                  stroke={finish.symbolColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  fill="none"
                />
                {/* Manilla a la derecha */}
                <rect
                  x={leafSashX + leafSashW - 4.5}
                  y={leafSashY + leafSashH / 2 - 5}
                  width="2.5"
                  height="10"
                  fill={finish.dark}
                  rx="1"
                />
              </g>
            )}

            {/* Oscilobatiente Derecha */}
            {leaf.role === 'tilt-right' && (
              <g>
                {/* Giro lateral */}
                <path
                  d={`M ${glassX + glassW - 2} ${glassY + 2} L ${glassX + 2} ${glassY + glassH / 2} L ${glassX + glassW - 2} ${glassY + glassH - 2}`}
                  stroke={finish.symbolColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  fill="none"
                />
                {/* Oscilo inferior */}
                <path
                  d={`M ${glassX + 2} ${glassY + glassH - 2} L ${glassX + glassW / 2} ${glassY + 2} L ${glassX + glassW - 2} ${glassY + glassH - 2}`}
                  stroke={finish.symbolColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  fill="none"
                />
                {/* Manilla a la izquierda */}
                <rect
                  x={leafSashX + 2}
                  y={leafSashY + leafSashH / 2 - 5}
                  width="2.5"
                  height="10"
                  fill={finish.dark}
                  rx="1"
                />
              </g>
            )}

            {/* Oscilobatiente Izquierda */}
            {leaf.role === 'tilt-left' && (
              <g>
                {/* Giro lateral */}
                <path
                  d={`M ${glassX + 2} ${glassY + 2} L ${glassX + glassW - 2} ${glassY + glassH / 2} L ${glassX + 2} ${glassY + glassH - 2}`}
                  stroke={finish.symbolColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  fill="none"
                />
                {/* Oscilo inferior */}
                <path
                  d={`M ${glassX + 2} ${glassY + glassH - 2} L ${glassX + glassW / 2} ${glassY + 2} L ${glassX + glassW - 2} ${glassY + glassH - 2}`}
                  stroke={finish.symbolColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  fill="none"
                />
                {/* Manilla a la derecha */}
                <rect
                  x={leafSashX + leafSashW - 4.5}
                  y={leafSashY + leafSashH / 2 - 5}
                  width="2.5"
                  height="10"
                  fill={finish.dark}
                  rx="1"
                />
              </g>
            )}

            {/* Proyectante */}
            {leaf.role === 'projecting' && (
              <g>
                <path
                  d={`M ${glassX + 2} ${glassY + 2} L ${glassX + glassW / 2} ${glassY + glassH - 2} L ${glassX + glassW - 2} ${glassY + 2}`}
                  stroke={finish.symbolColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  fill="none"
                />
                {/* Manilla abajo al centro */}
                <rect
                  x={leafSashX + leafSashW / 2 - 5}
                  y={leafSashY + leafSashH - 4.5}
                  width="10"
                  height="2.5"
                  fill={finish.dark}
                  rx="1"
                />
              </g>
            )}
          </g>
        );
      })}

      {/* 4. COTAS Y DIMENSIONES EN MILÍMETROS */}
      {showDimensions && (
        <g className="text-[9px] font-mono select-none" fill="#64748B">
          {/* Cota Inferior (Ancho) */}
          <line
            x1={startX}
            y1={startY + drawH + 9}
            x2={startX + drawW}
            y2={startY + drawH + 9}
            stroke="#94A3B8"
            strokeWidth="0.75"
          />
          <line
            x1={startX}
            y1={startY + drawH + 6}
            x2={startX}
            y2={startY + drawH + 12}
            stroke="#94A3B8"
            strokeWidth="0.75"
          />
          <line
            x1={startX + drawW}
            y1={startY + drawH + 6}
            x2={startX + drawW}
            y2={startY + drawH + 12}
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
            x1={startX + drawW + 9}
            y1={startY}
            x2={startX + drawW + 9}
            y2={startY + drawH}
            stroke="#94A3B8"
            strokeWidth="0.75"
          />
          <line
            x1={startX + drawW + 6}
            y1={startY}
            x2={startX + drawW + 12}
            y2={startY}
            stroke="#94A3B8"
            strokeWidth="0.75"
          />
          <line
            x1={startX + drawW + 6}
            y1={startY + drawH}
            x2={startX + drawW + 12}
            y2={startY + drawH}
            stroke="#94A3B8"
            strokeWidth="0.75"
          />
          <text
            x={startX + drawW + 14}
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
