import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import { getTiposProducto } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import type { TipoProducto } from '../../../types';
import { Seccion } from '../../../components/ui/Seccion';
import { Cargando, ErrorCarga } from '../../../components/ui/Estados';
import { TipoProductoModal } from './TipoProductoModal';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';

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
        sinRelleno
        titulo="Tipos de producto"
        descripcion="Cada material tiene un tipo: define su partida, cómo se mide en la receta, en qué unidad y moneda viene el precio y cómo se compra."
        acciones={
          puedeEditar ? (
            <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEditando('nuevo')}>
              Nuevo tipo
            </Button>
          ) : undefined
        }
      >
        <Tabla>
          <Thead>
            <Tr>
              <Th>Tipo</Th>
              <Th>Partida</Th>
              <Th>Medición</Th>
              <Th>Precio y compra</Th>
              <Th>Familias HETMO</Th>
              <Th alinear="derecha">Materiales</Th>
              {puedeEditar && <Th alinear="derecha">Acciones</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {tipos.map((t) => (
              <Tr key={t.id} tono={t.activo ? undefined : 'atenuada'}>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-slate-900">{t.nombre}</span>
                    {t.porDefecto && <Badge size="sm" variant="brand">Por defecto</Badge>}
                    {t.individualizado && <Badge size="sm" variant="info">Individualizado</Badge>}
                    {t.compraPorPieza && <Badge size="sm" variant="violet">Por pieza</Badge>}
                    {!t.activo && <Badge size="sm" variant="default">Inactivo</Badge>}
                  </div>
                  {t.descripcion && <div className="text-[11px] text-slate-500 truncate max-w-xs" title={t.descripcion}>{t.descripcion}</div>}
                </Td>
                <Td>{t.partida.nombre}</Td>
                <Td className="whitespace-nowrap">
                  {MEDICION_LABEL[t.medicion]} <span className="text-slate-400">({t.unidadConsumo.simbolo})</span>
                </Td>
                <Td className="text-[11px]">
                  {formato(t)}
                  {t.compraDesdeResumenHetmo && <div className="text-slate-500">Cantidad según el resumen de HETMO</div>}
                </Td>
                <Td className="text-[11px] text-slate-500">{(t.familiasHetmo ?? []).map((f) => f.codigo).join(', ') || '—'}</Td>
                <Td numero>{t._count?.materiales ?? 0}</Td>
                {puedeEditar && (
                  <Td alinear="derecha">
                    <Button size="sm" variant="ghost" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditando(t)}>
                      Editar
                    </Button>
                  </Td>
                )}
              </Tr>
            ))}
          </Tbody>
          </Tabla>
      </Seccion>
      {editando && <TipoProductoModal tipo={editando === 'nuevo' ? null : editando} onClose={() => setEditando(null)} />}
    </>
  );
};
