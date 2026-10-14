import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { getFabricacionDetalle, getMaterialesFabricacion } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import type { MaterialFabricacion, MaterialesFabricacion } from '../../../types';
import { formatoMm, resumenCuadros } from './utils';

interface Props {
  proyectoId: string;
  fabricacionId: string;
}

type Vista = 'ventanas' | 'materiales';

const Aviso: React.FC<{ textos: string[] }> = ({ textos }) =>
  textos.length === 0 ? null : (
    <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 flex gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        {textos.map((t) => (
          <p key={t}>{t}</p>
        ))}
      </div>
    </div>
  );

const agruparPorFamilia = (materiales: MaterialFabricacion[]) => {
  const grupos = new Map<string, MaterialFabricacion[]>();
  for (const m of materiales) {
    const familia = m.familia || 'Otros';
    grupos.set(familia, [...(grupos.get(familia) ?? []), m]);
  }
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
};

const Materiales: React.FC<{ datos: MaterialesFabricacion }> = ({ datos }) => (
  <div className="space-y-2">
    <Aviso textos={datos.advertencias} />
    {datos.ventanas.map(({ ventana, vidrios, materiales }) => (
      <details key={ventana.id} className="rounded-xl border border-slate-200 bg-white">
        <summary className="px-3 py-2.5 cursor-pointer text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-bold text-slate-900">
            Pos {ventana.orden} · {ventana.modelo}
          </span>
          <span className="font-mono text-slate-500">
            {formatoMm(ventana.anchoMm)} × {formatoMm(ventana.altoMm)} mm
          </span>
          <span className="text-slate-400">
            {vidrios.length} vidrio(s) · {materiales.length} material(es)
          </span>
        </summary>
        <div className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3">
          {vidrios.length === 0 && materiales.length === 0 && (
            <p className="text-xs text-slate-400">HETMO no trae materiales ni vidrios para esta ventana.</p>
          )}
          {vidrios.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Vidrios</h4>
              <ul className="text-xs divide-y divide-slate-50">
                {vidrios.map((v) => (
                  <li key={v.material_hetmo} className="py-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 text-slate-800">
                      <span className="font-mono text-slate-500 mr-2">{v.codigo_articulo}</span>
                      {v.descripcion_articulo}
                    </span>
                    <span className="font-mono text-slate-700 whitespace-nowrap">
                      {formatoMm(v.ANCHO)} × {formatoMm(v.ALTO)} mm · {v.UDS} un
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {agruparPorFamilia(materiales).map(([familia, items]) => (
            <div key={familia}>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{familia}</h4>
              <ul className="text-xs divide-y divide-slate-50">
                {items.map((m, i) => (
                  <li key={`${m.codigo_articulo}-${i}`} className="py-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 text-slate-800">
                      <span className="font-mono text-slate-500 mr-2">{m.codigo_articulo}</span>
                      {m.descripcion_articulo}
                    </span>
                    <span className="font-mono text-slate-700 whitespace-nowrap">
                      {Number(m.cantidad).toLocaleString('es-CL', { maximumFractionDigits: 2 })} un
                      {m.longitud_total_mm ? ` · ${formatoMm(m.longitud_total_mm)} mm` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    ))}
  </div>
);

// Contenido de un documento de fabricacion vinculado: sus ventanas (lo que
// se copio de HETMO) y, a pedido, los materiales y vidrios por ventana, que
// se leen EN VIVO de HETMO con la medida real de cada ventana.
export const FabricacionDetalle: React.FC<Props> = ({ proyectoId, fabricacionId }) => {
  const [vista, setVista] = useState<Vista>('ventanas');

  const detalle = useQuery({
    queryKey: ['fabricacionDetalle', proyectoId, fabricacionId],
    queryFn: () => getFabricacionDetalle(proyectoId, fabricacionId),
  });

  const materiales = useQuery({
    queryKey: ['fabricacionMateriales', proyectoId, fabricacionId],
    queryFn: () => getMaterialesFabricacion(proyectoId, fabricacionId),
    enabled: vista === 'materiales',
    staleTime: 1000 * 60,
    refetchInterval: false,
  });

  const ventanas = useMemo(() => detalle.data?.ventanas ?? [], [detalle.data]);
  const vigentes = ventanas.filter((v) => !v.retirada);
  const retiradas = ventanas.length - vigentes.length;
  const totalUnidades = vigentes.reduce((s, v) => s + v.unidades, 0);

  const pestana = (id: Vista, texto: string) => (
    <button
      onClick={() => setVista(id)}
      className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
        vista === id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      {texto}
    </button>
  );

  if (detalle.isLoading) {
    return (
      <div className="p-6 flex items-center justify-center text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }
  if (detalle.isError || !detalle.data) {
    return <div className="p-4 text-xs text-rose-600">No se pudo cargar el detalle del documento.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {pestana('ventanas', `Ventanas (${vigentes.length})`)}
        {pestana('materiales', 'Materiales y vidrios')}
        <span className="ml-auto text-[11px] text-slate-500">
          {totalUnidades} unidad(es){retiradas > 0 ? ` · ${retiradas} retirada(s) en HETMO` : ''}
        </span>
      </div>

      {vista === 'ventanas' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2 font-bold">Pos</th>
                <th className="px-3 py-2 font-bold">Modelo</th>
                <th className="px-3 py-2 font-bold text-right">Medida (mm)</th>
                <th className="px-3 py-2 font-bold text-right">Uds</th>
                <th className="px-3 py-2 font-bold">Cuadros</th>
              </tr>
            </thead>
            <tbody>
              {ventanas.map((v) => (
                <tr key={v.id} className={`border-b border-slate-50 ${v.retirada ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2 font-mono text-slate-600">{v.orden}</td>
                  <td className="px-3 py-2 font-bold text-slate-900">
                    {v.modelo || '—'}
                    {v.retirada && (
                      <Badge size="sm" variant="outline" className="ml-2">
                        retirada
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700 whitespace-nowrap">
                    {formatoMm(v.anchoMm)} × {formatoMm(v.altoMm)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">{v.unidades}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{resumenCuadros(v.cuadros)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ventanas.length === 0 && <p className="p-4 text-center text-xs text-slate-400">El documento no trae ventanas.</p>}
        </div>
      )}

      {vista === 'materiales' &&
        (materiales.isLoading ? (
          <div className="p-6 flex items-center justify-center text-slate-400 gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> Leyendo materiales de HETMO...
          </div>
        ) : materiales.isError || !materiales.data ? (
          <div className="p-4 text-xs text-rose-600">No se pudieron leer los materiales de HETMO. Intenta de nuevo en unos minutos.</div>
        ) : (
          <Materiales datos={materiales.data} />
        ))}
    </div>
  );
};
