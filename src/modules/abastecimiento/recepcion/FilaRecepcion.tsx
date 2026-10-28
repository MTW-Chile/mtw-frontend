import React from 'react';
import { Casilla, InputCompacto } from '../../../components/ui/Campos';
import { ContadorTactil } from '../../../components/ui/ContadorTactil';
import { cantidad as fmtCantidad } from '../../../lib/formato';
import { acotarCantidad, type EstadoFilaRecepcion, type FilaRecepcion as Fila } from './recepcion';

/**
 * Una línea de una lista de recepción, en dos renglones: arriba qué es y
 * cuánto se pidió / ya llegó; abajo el contador de lo que llegó ahora y la
 * marca de "llegó dañado". Pensada para tablet: casilla de 24 px, botones de
 * 44 px, teclado numérico.
 */
export const FilaRecepcion: React.FC<{
  fila: Fila;
  estado: EstadoFilaRecepcion;
  onChange: (e: EstadoFilaRecepcion) => void;
  /** Cómo se llama lo pedido ("pedido" en una OC, "despachado" en obra). */
  etiquetaTotal?: string;
  /** Dónde queda lo que no se marca. */
  textoNoLlego?: string;
}> = ({ fila, estado, onChange, etiquetaTotal = 'pedido', textoNoLlego = 'No llegó: queda pendiente en esta OC.' }) => {
  const completa = fila.pendiente <= 0;
  const cantidad = acotarCantidad(fila, estado.cantidad);
  const quedan = Math.round((fila.pendiente - cantidad) * 100) / 100;
  const unidad = fila.unidad.toLowerCase();

  return (
    <li className={`px-3 py-3 sm:px-4 space-y-2 ${completa ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <Casilla
          className="mt-0.5 [&>input]:w-5 [&>input]:h-5 pointer-coarse:[&>input]:w-6 pointer-coarse:[&>input]:h-6"
          checked={estado.marcada}
          disabled={completa}
          onChange={(v) => onChange({ ...estado, marcada: v, cantidad: v ? fila.pendiente : estado.cantidad })}
          aria-label={`Recibir ${fila.descripcion}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 leading-snug">{fila.descripcion}</p>
          {fila.detalle && <p className="text-xs text-sky-700 font-semibold">{fila.detalle}</p>}
          <p className="text-xs text-slate-500 tabular-nums">
            {etiquetaTotal} {fmtCantidad(fila.pedido)} · ya recibido {fmtCantidad(fila.yaRecibido)} ·{' '}
            {completa ? <span className="text-emerald-700 font-semibold">completo</span> : <span className="font-semibold text-slate-700">faltan {fmtCantidad(fila.pendiente)}</span>} {unidad}
          </p>
        </div>
      </div>

      {!completa && estado.marcada && (
        <div className="pl-8 pointer-coarse:pl-9 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xs font-bold text-slate-700">Llegaron</span>
            <ContadorTactil
              valor={cantidad}
              min={0}
              max={fila.pendiente}
              enteros={fila.enteros}
              onChange={(v) => onChange({ ...estado, cantidad: v })}
              aria-label={`Cantidad recibida de ${fila.descripcion}`}
            />
            <span className="text-xs text-slate-500">{unidad}</span>
            {quedan > 0 && <span className="text-xs font-semibold text-amber-700">quedan {fmtCantidad(quedan)} pendientes</span>}
          </div>
          <Casilla
            className="pointer-coarse:min-h-11 [&>input]:w-4 [&>input]:h-4"
            checked={estado.danado}
            onChange={(v) => onChange({ ...estado, danado: v })}
            label={<span className={estado.danado ? 'font-semibold text-amber-700' : 'text-slate-600'}>Llegó dañado / incompleto</span>}
          />
          {estado.danado && (
            <InputCompacto
              autoFocus
              placeholder="Qué pasó: llegó rayado, falta un herraje, caja abierta…"
              value={estado.observacion}
              onChange={(e) => onChange({ ...estado, observacion: e.target.value })}
              maxLength={500}
              aria-label={`Observación de ${fila.descripcion}`}
              className="w-full pointer-coarse:min-h-11 pointer-coarse:text-sm border-amber-300"
            />
          )}
        </div>
      )}
      {!completa && !estado.marcada && <p className="pl-8 pointer-coarse:pl-9 text-xs text-slate-400">{textoNoLlego}</p>}
    </li>
  );
};
