import React, { useMemo } from 'react';
import type { Ventana } from '../../../../types';
import { 
  resolveProfileFinish, 
  buildCompositeStructure,
  getGlassLabel,
  type CompositePanel,
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
  const finish = useMemo(() => resolveProfileFinish(ventana), [ventana]);
  const composite = useMemo(() => buildCompositeStructure(ventana), [ventana]);
  const glassLabel = useMemo(() => getGlassLabel(ventana), [ventana]);

  // Dimensiones del canvas SVG
  const canvasW = 240;
  const canvasH = 178;
  const paddingX = showDimensions ? 28 : 12;
  const paddingY = showDimensions ? (composite.isComposite ? 30 : 22) : 12;
  const maxDrawW = canvasW - paddingX * 2;
  const maxDrawH = canvasH - paddingY * 2;

  // Escala proporcional
  const totalW = composite.totalWidthMm;
  const totalH = composite.totalHeightMm;
  const ratio = totalW / totalH;
  let drawW = maxDrawW;
  let drawH = maxDrawW / ratio;

  if (drawH > maxDrawH) {
    drawH = maxDrawH;
    drawW = maxDrawH * ratio;
  }

  const startX = (canvasW - drawW) / 2 - (showDimensions ? 4 : 0);
  const startY = (canvasH - drawH) / 2 - (showDimensions ? (composite.isComposite ? 10 : 6) : 0);
  
  const frameThickness = Math.max(3.5, Math.min(6.5, Math.min(drawW, drawH) * 0.05));
  const sashThickness = Math.max(2.5, frameThickness * 0.75);

  const innerX = startX + frameThickness;
  const innerY = startY + frameThickness;
  const innerW = drawW - frameThickness * 2;
  const innerH = drawH - frameThickness * 2;

  // Cálculo de la posición X de cada panel proporcional a sus milímetros reales (memoizado)
  const panelTiles = useMemo(() => {
    let offset = 0;
    return composite.panels.map((panel: CompositePanel) => {
      const pw = (panel.widthMm / totalW) * innerW;
      const px = innerX + offset;
      offset += pw;
      return {
        panel,
        px,
        py: innerY,
        pw,
        ph: innerH,
      };
    });
  }, [composite.panels, innerX, innerY, innerW, innerH, totalW]);

  return (
    <svg
      viewBox={`0 0 ${canvasW} ${canvasH}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Esquema técnico de ventana ${ventana.modelo}`}
    >
      <defs>
        {/* Gradiente de vidrio técnico con reflejo MTW */}
        <linearGradient id={`glassGrad-${ventana.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.85" />
          <stop offset="40%" stopColor="#BAE6FD" stopOpacity="0.65" />
          <stop offset="60%" stopColor="#E0F2FE" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.75" />
        </linearGradient>
      </defs>

      {/* 1. MARCO EXTERIOR PERIMETRAL CON RELIEVE 3D */}
      <g>
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

        {/* Borde interior del marco */}
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

      {/* 2. RENDERIZADO DE PANELES (COMPUESTOS O SIMPLES) */}
      {panelTiles.map((tile, idx) => {
        const { panel, px, py, pw, ph } = tile;
        const spec = panel.apertura;
        const isFijo = spec.family === 'fixed';
        const isDoubleLeaf = spec.leafCount === 2 || panel.aperturaCount >= 2;

        return (
          <g key={idx}>
            {/* PAÑO FIJO: Vidrio + Cruz técnica central + Junquillo */}
            {isFijo && (
              <g>
                {/* Vidrio */}
                <rect
                  x={px + 1}
                  y={py + 1}
                  width={Math.max(2, pw - 2)}
                  height={Math.max(2, ph - 2)}
                  fill={`url(#glassGrad-${ventana.id})`}
                  stroke={finish.glassStroke}
                  strokeWidth="0.75"
                />

                {/* Junquillo sutil perimetral */}
                <rect
                  x={px + 2}
                  y={py + 2}
                  width={Math.max(2, pw - 4)}
                  height={Math.max(2, ph - 4)}
                  fill="none"
                  stroke={finish.stroke}
                  strokeWidth="0.4"
                  strokeDasharray="2 2"
                  opacity="0.5"
                />

                {/* Cruz técnica central fina (+) */}
                <g stroke={finish.glassCrossColor} strokeWidth="1.2" strokeLinecap="round" opacity="0.85">
                  <line
                    x1={px + pw / 2 - 3.5}
                    y1={py + ph / 2}
                    x2={px + pw / 2 + 3.5}
                    y2={py + ph / 2}
                  />
                  <line
                    x1={px + pw / 2}
                    y1={py + ph / 2 - 3.5}
                    x2={px + pw / 2}
                    y2={py + ph / 2 + 3.5}
                  />
                </g>
              </g>
            )}

            {/* PUERTA / PRACTICABLE DE 2 HOJAS */}
            {!isFijo && isDoubleLeaf && (
              <g>
                {/* Hoja Izquierda */}
                <rect
                  x={px + 1}
                  y={py + 1}
                  width={pw / 2 - 1.5}
                  height={ph - 2}
                  fill={finish.base}
                  stroke={finish.stroke}
                  strokeWidth="0.9"
                />
                <rect
                  x={px + 1 + sashThickness}
                  y={py + 1 + sashThickness}
                  width={Math.max(2, pw / 2 - 1.5 - sashThickness * 2)}
                  height={Math.max(2, ph - 2 - sashThickness * 2)}
                  fill={`url(#glassGrad-${ventana.id})`}
                  stroke={finish.glassStroke}
                  strokeWidth="0.75"
                />
                {/* Triángulo practicable Izquierdo (bisagra izq, manilla centro) */}
                <path
                  d={`M ${px + 1 + sashThickness} ${py + 1 + sashThickness} L ${px + pw / 2 - 1.5 - sashThickness} ${py + ph / 2} L ${px + 1 + sashThickness} ${py + ph - 1 - sashThickness}`}
                  stroke={finish.symbolColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  fill="none"
                />
                {/* Manilla izquierda */}
                <rect
                  x={px + pw / 2 - 3.5}
                  y={py + ph / 2 - 5}
                  width="2"
                  height="10"
                  fill={finish.dark}
                  rx="0.5"
                />

                {/* Hoja Derecha */}
                <rect
                  x={px + pw / 2 + 0.5}
                  y={py + 1}
                  width={pw / 2 - 1.5}
                  height={ph - 2}
                  fill={finish.base}
                  stroke={finish.stroke}
                  strokeWidth="0.9"
                />
                <rect
                  x={px + pw / 2 + 0.5 + sashThickness}
                  y={py + 1 + sashThickness}
                  width={Math.max(2, pw / 2 - 1.5 - sashThickness * 2)}
                  height={Math.max(2, ph - 2 - sashThickness * 2)}
                  fill={`url(#glassGrad-${ventana.id})`}
                  stroke={finish.glassStroke}
                  strokeWidth="0.75"
                />
                {/* Triángulo practicable Derecho (bisagra der, manilla centro) */}
                <path
                  d={`M ${px + pw - 1 - sashThickness} ${py + 1 + sashThickness} L ${px + pw / 2 + 0.5 + sashThickness} ${py + ph / 2} L ${px + pw - 1 - sashThickness} ${py + ph - 1 - sashThickness}`}
                  stroke={finish.symbolColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  fill="none"
                />
                {/* Manilla derecha */}
                <rect
                  x={px + pw / 2 + 1.5}
                  y={py + ph / 2 - 5}
                  width="2"
                  height="10"
                  fill={finish.dark}
                  rx="0.5"
                />
              </g>
            )}

            {/* PRACTICABLE / OSCILOBATIENTE / PUERTA DE 1 HOJA */}
            {!isFijo && !isDoubleLeaf && ['hinged', 'door', 'tilt-turn', 'projecting'].includes(spec.family) && (
              <g>
                <rect
                  x={px + 1}
                  y={py + 1}
                  width={pw - 2}
                  height={ph - 2}
                  fill={finish.base}
                  stroke={finish.stroke}
                  strokeWidth="0.9"
                />
                <rect
                  x={px + 1 + sashThickness}
                  y={py + 1 + sashThickness}
                  width={Math.max(2, pw - 2 - sashThickness * 2)}
                  height={Math.max(2, ph - 2 - sashThickness * 2)}
                  fill={`url(#glassGrad-${ventana.id})`}
                  stroke={finish.glassStroke}
                  strokeWidth="0.75"
                />

                {/* Practicable / Puerta 1 hoja */}
                {(spec.family === 'hinged' || spec.family === 'door') && (
                  <>
                    <path
                      d={spec.hand === 'left'
                        ? `M ${px + 1 + sashThickness} ${py + 1 + sashThickness} L ${px + pw - 1 - sashThickness} ${py + ph / 2} L ${px + 1 + sashThickness} ${py + ph - 1 - sashThickness}`
                        : `M ${px + pw - 1 - sashThickness} ${py + 1 + sashThickness} L ${px + 1 + sashThickness} ${py + ph / 2} L ${px + pw - 1 - sashThickness} ${py + ph - 1 - sashThickness}`
                      }
                      stroke={finish.symbolColor}
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                      fill="none"
                    />
                    <rect
                      x={spec.hand === 'left' ? px + pw - 3.5 : px + 1.5}
                      y={py + ph / 2 - 5}
                      width="2"
                      height="10"
                      fill={finish.dark}
                      rx="0.5"
                    />
                  </>
                )}

                {/* Oscilobatiente 1 hoja */}
                {spec.family === 'tilt-turn' && (
                  <>
                    <path
                      d={spec.hand === 'left'
                        ? `M ${px + 1 + sashThickness} ${py + 1 + sashThickness} L ${px + pw - 1 - sashThickness} ${py + ph / 2} L ${px + 1 + sashThickness} ${py + ph - 1 - sashThickness}`
                        : `M ${px + pw - 1 - sashThickness} ${py + 1 + sashThickness} L ${px + 1 + sashThickness} ${py + ph / 2} L ${px + pw - 1 - sashThickness} ${py + ph - 1 - sashThickness}`
                      }
                      stroke={finish.symbolColor}
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                      fill="none"
                    />
                    <path
                      d={`M ${px + 1 + sashThickness} ${py + ph - 1 - sashThickness} L ${px + pw / 2} ${py + 1 + sashThickness} L ${px + pw - 1 - sashThickness} ${py + ph - 1 - sashThickness}`}
                      stroke={finish.symbolColor}
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                      fill="none"
                    />
                    <rect
                      x={spec.hand === 'left' ? px + pw - 3.5 : px + 1.5}
                      y={py + ph / 2 - 5}
                      width="2"
                      height="10"
                      fill={finish.dark}
                      rx="0.5"
                    />
                  </>
                )}

                {/* Proyectante */}
                {spec.family === 'projecting' && (
                  <>
                    <path
                      d={`M ${px + 1 + sashThickness} ${py + 1 + sashThickness} L ${px + pw / 2} ${py + ph - 1 - sashThickness} L ${px + pw - 1 - sashThickness} ${py + 1 + sashThickness}`}
                      stroke={finish.symbolColor}
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                      fill="none"
                    />
                    <rect
                      x={px + pw / 2 - 5}
                      y={py + ph - 3.5}
                      width="10"
                      height="2"
                      fill={finish.dark}
                      rx="0.5"
                    />
                  </>
                )}
              </g>
            )}

            {/* CORREDERAS */}
            {!isFijo && (spec.family === 'sliding' || spec.family === 'lift-slide') && (
              <g>
                <rect
                  x={px + 1}
                  y={py + 1}
                  width={pw - 2}
                  height={ph - 2}
                  fill={`url(#glassGrad-${ventana.id})`}
                  stroke={finish.glassStroke}
                  strokeWidth="0.75"
                />
                {/* Flecha corredera */}
                <path
                  d={`M ${px + pw / 2 - 6} ${py + ph / 2} L ${px + pw / 2 + 6} ${py + ph / 2} M ${px + pw / 2 + 3} ${py + ph / 2 - 3} L ${px + pw / 2 + 6} ${py + ph / 2} L ${px + pw / 2 + 3} ${py + ph / 2 + 3}`}
                  stroke={finish.symbolColor}
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            )}
          </g>
        );
      })}

      {/* 3. ETIQUETA DE VIDRIO TÉCNICO EN ESQUINA INFERIOR IZQUIERDA */}
      {glassLabel && (
        <text
          x={innerX + 3}
          y={innerY + innerH - 3}
          className="text-[6.5px] font-mono font-bold select-none"
          fill="#475569"
          opacity="0.8"
        >
          {glassLabel}
        </text>
      )}

      {/* 4. COTAS Y DIMENSIONES EN MILÍMETROS */}
      {showDimensions && (
        <g className="text-[7.5px] font-mono select-none" fill="#64748B">
          {/* A. Cotas parciales por segmento (sólo si es compuesta) */}
          {composite.isComposite && (
            <g opacity="0.9">
              {panelTiles.map((tile, i) => (
                <g key={i}>
                  <line
                    x1={tile.px}
                    y1={startY + drawH + 5}
                    x2={tile.px + tile.pw}
                    y2={startY + drawH + 5}
                    stroke="#94A3B8"
                    strokeWidth="0.6"
                    strokeDasharray="2 2"
                  />
                  <line
                    x1={tile.px}
                    y1={startY + drawH + 3}
                    x2={tile.px}
                    y2={startY + drawH + 7}
                    stroke="#94A3B8"
                    strokeWidth="0.6"
                  />
                  <line
                    x1={tile.px + tile.pw}
                    y1={startY + drawH + 3}
                    x2={tile.px + tile.pw}
                    y2={startY + drawH + 7}
                    stroke="#94A3B8"
                    strokeWidth="0.6"
                  />
                  <text
                    x={tile.px + tile.pw / 2}
                    y={startY + drawH + 11}
                    textAnchor="middle"
                    className="text-[6.5px] font-medium"
                  >
                    {Math.round(tile.panel.widthMm).toLocaleString('es-CL')}
                  </text>
                </g>
              ))}
            </g>
          )}

          {/* B. Cota Total Inferior (Ancho mm) */}
          <line
            x1={startX}
            y1={startY + drawH + (composite.isComposite ? 17 : 8)}
            x2={startX + drawW}
            y2={startY + drawH + (composite.isComposite ? 17 : 8)}
            stroke="#64748B"
            strokeWidth="0.8"
          />
          <line
            x1={startX}
            y1={startY + drawH + (composite.isComposite ? 14 : 5)}
            x2={startX}
            y2={startY + drawH + (composite.isComposite ? 20 : 11)}
            stroke="#64748B"
            strokeWidth="0.8"
          />
          <line
            x1={startX + drawW}
            y1={startY + drawH + (composite.isComposite ? 14 : 5)}
            x2={startX + drawW}
            y2={startY + drawH + (composite.isComposite ? 20 : 11)}
            stroke="#64748B"
            strokeWidth="0.8"
          />
          <text
            x={startX + drawW / 2}
            y={startY + drawH + (composite.isComposite ? 26 : 17)}
            textAnchor="middle"
            className="text-[8.5px] font-bold"
            fill="#1E293B"
          >
            {Math.round(totalW).toLocaleString('es-CL')} mm
          </text>

          {/* C. Cota Lateral Derecha (Alto mm) */}
          <line
            x1={startX + drawW + 8}
            y1={startY}
            x2={startX + drawW + 8}
            y2={startY + drawH}
            stroke="#64748B"
            strokeWidth="0.8"
          />
          <line
            x1={startX + drawW + 5}
            y1={startY}
            x2={startX + drawW + 11}
            y2={startY}
            stroke="#64748B"
            strokeWidth="0.8"
          />
          <line
            x1={startX + drawW + 5}
            y1={startY + drawH}
            x2={startX + drawW + 11}
            y2={startY + drawH}
            stroke="#64748B"
            strokeWidth="0.8"
          />
          <text
            x={startX + drawW + 13}
            y={startY + drawH / 2 + 3}
            textAnchor="start"
            className="text-[8px] font-bold"
            fill="#1E293B"
          >
            {Math.round(totalH).toLocaleString('es-CL')} mm
          </text>
        </g>
      )}
    </svg>
  );
};
