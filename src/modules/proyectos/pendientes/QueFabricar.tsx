import React, { useState } from 'react';
import { BotonColapsar } from '../../../components/ui/BotonColapsar';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import type { FichaVentanaObra, ObraPendienteDetalle } from '../../../types';
import { formatoMm } from '../fabricacion/utils';
import { nombreCuadro, perfilesDeCuadro, textoRectificacion } from './utils';

type Cuadro = FichaVentanaObra['cuadros'][number];

const DetalleCuadro: React.FC<{ cuadro: Cuadro; abiertoAlInicio: boolean }> = ({ cuadro, abiertoAlInicio }) => {
  const [abierto, setAbierto] = useState(abiertoAlInicio);
  const perfiles = perfilesDeCuadro(cuadro.piezas);
  const total = perfiles.reduce((s, f) => s + f.cantidad, 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <BotonColapsar abierto={abierto} onClick={() => setAbierto((v) => !v)} className="w-full px-3 py-2">
        <span className="text-xs font-bold text-slate-900">{nombreCuadro(cuadro)}</span>
        {cuadro.anchoMm !== null && cuadro.altoMm !== null && (
          <span className="text-xs text-slate-700">
            {formatoMm(cuadro.anchoMm)} × {formatoMm(cuadro.altoMm)} mm
          </span>
        )}
        <span className="text-[11px] text-slate-500">{total} perfiles</span>
      </BotonColapsar>
      {abierto &&
        (perfiles.length > 0 ? (
          <div className="border-t border-slate-100">
            <Tabla ajustada className="text-[11px]">
              <Thead>
                <Tr>
                  <Th alinear="derecha">Cant.</Th>
                  <Th>Perfil</Th>
                  <Th>Acabado</Th>
                  <Th alinear="derecha">Largo</Th>
                  <Th>Corte</Th>
                </Tr>
              </Thead>
              <Tbody>
                {perfiles.map((f) => (
                  <Tr key={f.clave}>
                    <Td numero fuerte>
                      {f.cantidad}
                    </Td>
                    <Td className="min-w-[13rem]">
                      <span className="font-mono text-slate-900">{f.codigo}</span> <span className="text-slate-600">{f.descripcion}</span>
                      {f.posiciones.length > 0 && <span className="block text-slate-500">{f.posiciones.join(', ')}</span>}
                    </Td>
                    <Td>{f.acabado ?? '—'}</Td>
                    <Td numero>{formatoMm(f.largo)} mm</Td>
                    <Td className="whitespace-nowrap">{f.corte || '—'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Tabla>
          </div>
        ) : (
          <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">El documento no trae los perfiles de este cuadro.</p>
        ))}
    </div>
  );
};

/**
 * Qué hay que fabricar por un pendiente de Fábrica: la hoja o el marco pedido con su medida y sus perfiles (largo,
 * corte, acabado), o la ventana completa con todos sus cuadros y vidrios. Sale del documento de fabricación de la
 * ventana; si el documento no trae el despiece (lote sin optimizar), no se muestra.
 */
export const QueFabricar: React.FC<{ p: ObraPendienteDetalle; ficha: FichaVentanaObra }> = ({ p, ficha }) => {
  if (p.tipo !== 'HOJA' && p.tipo !== 'MARCO' && p.tipo !== 'VENTANA') return null;
  const completa = p.tipo === 'VENTANA';
  const cuadros = completa ? [...ficha.cuadros].sort((a, b) => (a.tipo === b.tipo ? a.numeroCuadro - b.numeroCuadro : a.tipo === 'MARCO' ? -1 : 1)) : ficha.cuadros.filter((c) => c.id === p.fabricacionCuadroId);
  const rectificacion = textoRectificacion(p);
  if (cuadros.length === 0 && !rectificacion) return null;
  const vidrios = completa ? ficha.vidrios : [];
  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50/40 p-3 space-y-2" aria-label="Qué hay que fabricar">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Qué hay que fabricar</h4>
        {completa && <p className="text-xs font-bold text-slate-900">Ventana completa {p.ventanaRef ?? ''}</p>}
      </div>
      {rectificacion && <p className="text-xs font-bold text-brand-700">{rectificacion}</p>}
      {cuadros.map((c) => (
        <DetalleCuadro key={c.id} cuadro={c} abiertoAlInicio={!completa} />
      ))}
      {vidrios.length > 0 && (
        <p className="text-[11px] text-slate-600">
          <span className="font-bold text-slate-700">Vidrios:</span>{' '}
          {vidrios.map((g, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              {g.codigo_articulo} {formatoMm(g.ANCHO)} × {formatoMm(g.ALTO)} mm
            </span>
          ))}
        </p>
      )}
    </section>
  );
};
