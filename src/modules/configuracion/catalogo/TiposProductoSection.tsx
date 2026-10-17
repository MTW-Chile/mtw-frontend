import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import { getTiposProducto } from '../../../api/client';
import { TABLE_CLASS, TABLE_WRAPPER_CLASS } from '../../../lib/designSystem';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import type { TipoProducto } from '../../../types';
import { Cargando, ErrorCarga, Seccion } from './comun';
import { TipoProductoModal } from './TipoProductoModal';

const MEDICION_LABEL = { UNIDAD: 'Unidad', LONGITUD: 'Longitud', AREA: 'Área' } as const;

/** Formato en una linea: "USD por m · se compra por barra de 5,8 m". */
const formato = (t: TipoProducto) => {
  const factor = Number(t.factorCompra);
  const compra = t.unidadCompra.id === t.unidadPrecio.id ? '' : ` · se compra por ${t.unidadCompra.nombre.toLowerCase()}${factor !== 1 ? ` de ${factor.toLocaleString('es-CL')} ${t.unidadPrecio.simbolo}` : ''}`;
  return `${t.moneda}${t.monedaFija ? ' (fija)' : ''} por ${t.unidadPrecio.simbolo}${compra}`;
};

/**
 * Tipos de producto: la regla de cálculo, valorización y compra de cada
 * material (reemplaza las reglas que antes estaban escritas en el código por
 * familia de HETMO).
 */
export const TiposProductoSection: React.FC<{ puedeEditar: boolean }> = ({ puedeEditar }) => {
  const { data: tipos = [], isLoading, isError, refetch } = useQuery({ queryKey: ['tiposProducto'], queryFn: getTiposProducto });
  const [editando, setEditando] = useState<TipoProducto | 'nuevo' | null>(null);

  if (isLoading) return <Cargando />;
  if (isError) return <ErrorCarga que="los tipos de producto" onReintentar={refetch} />;

  return (
    <>
      <Seccion
        titulo="Tipos de producto"
        descripcion="Cada material tiene un tipo: define su partida, cómo se mide en la receta, en qué unidad y moneda viene el precio y cómo se compra."
        accion={
          puedeEditar ? (
            <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEditando('nuevo')}>
              Nuevo tipo
            </Button>
          ) : undefined
        }
      >
        <div className={TABLE_WRAPPER_CLASS}>
          <table className={`${TABLE_CLASS} text-left text-slate-700`}>
            <thead className="bg-slate-50/80 border-b border-slate-200 uppercase">
              <tr>
                <th className="py-3">Tipo</th>
                <th className="py-3">Partida</th>
                <th className="py-3">Medición</th>
                <th className="py-3">Precio y compra</th>
                <th className="py-3">Familias HETMO</th>
                <th className="py-3 text-right">Materiales</th>
                {puedeEditar && <th className="py-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tipos.map((t) => (
                <tr key={t.id} className={`hover:bg-slate-50/80 ${t.activo ? '' : 'opacity-60'}`}>
                  <td className="py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{t.nombre}</span>
                      {t.porDefecto && <Badge size="sm" variant="brand">Por defecto</Badge>}
                      {t.individualizado && <Badge size="sm" variant="info">Individualizado</Badge>}
                      {!t.activo && <Badge size="sm" variant="default">Inactivo</Badge>}
                    </div>
                    {t.descripcion && <div className="text-[11px] text-slate-500 truncate max-w-xs" title={t.descripcion}>{t.descripcion}</div>}
                  </td>
                  <td className="py-2.5">{t.partida.nombre}</td>
                  <td className="py-2.5 whitespace-nowrap">
                    {MEDICION_LABEL[t.medicion]} <span className="text-slate-400">({t.unidadConsumo.simbolo})</span>
                  </td>
                  <td className="py-2.5 text-[11px]">
                    {formato(t)}
                    {t.compraDesdeResumenHetmo && <div className="text-slate-500">Cantidad según el resumen de HETMO</div>}
                  </td>
                  <td className="py-2.5 text-[11px] text-slate-500">{(t.familiasHetmo ?? []).map((f) => f.codigo).join(', ') || '—'}</td>
                  <td className="py-2.5 text-right tabular-nums">{t._count?.materiales ?? 0}</td>
                  {puedeEditar && (
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => setEditando(t)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-brand-600 hover:bg-brand-50 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
      {editando && <TipoProductoModal tipo={editando === 'nuevo' ? null : editando} onClose={() => setEditando(null)} />}
    </>
  );
};
