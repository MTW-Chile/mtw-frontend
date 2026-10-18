import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Boxes, Coins, Pencil } from 'lucide-react';
import { getMateriales } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { NuevoMaterialModal } from './NuevoMaterialModal';
import { EditarMaterialModal } from './EditarMaterialModal';
import { useMonedas, resolverMoneda, formatMonto } from '../../../lib/monedas';
import { usePermisos } from '../../../lib/permisos';
import type { Material } from '../../../types';
import { useMediaQuery } from '../../../lib/useMediaQuery';
import { useColumnFilters, type ColumnFilterDef } from '../../../lib/useColumnFilters';
import { ColumnFilterHeader } from '../../../components/ui/ColumnFilterHeader';
import { BREAKPOINT_DESKTOP } from '../../../lib/designSystem';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { Buscador } from '../../../components/ui/Buscador';
import { FiltroChips } from '../../../components/ui/FiltroChips';
import { IconButton } from '../../../components/ui/IconButton';
import { Seccion } from '../../../components/ui/Seccion';

// El catálogo trae hasta ~2000 materiales -- volcar esa cantidad de filas al
// DOM de una sola vez (tabla + cards, sin virtualizar) es lo que hacía que
// abrir esta pantalla colgara/crasheara el tab. Se renderiza de a tandas y
// se agranda con "Mostrar más" en vez de todo junto.
const TANDA_INICIAL = 150;
const TANDA_INCREMENTO = 150;

export const MaestroProductos: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  // Filtro por tipo de producto (id), no por el texto de familia de HETMO.
  const [selectedFamilia, setSelectedFamilia] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editando, setEditando] = useState<Material | null>(null);
  const { tiene } = usePermisos();
  const puedeEditar = tiene('catalogo.editar');
  const [cantidadVisible, setCantidadVisible] = useState(TANDA_INICIAL);
  // Monta sólo la vista de escritorio o la de mobile, nunca las dos -- el
  // maestro puede traer hasta ~2000 materiales, así que duplicar el DOM acá
  // pesa más que en cualquier otra lista de la app. Ver useMediaQuery.ts.
  const isDesktop = useMediaQuery(BREAKPOINT_DESKTOP);

  const { data, isLoading, isError, refetch } = useQuery<Material[]>({
    queryKey: ['materiales'],
    queryFn: async () => {
      const res = await getMateriales();
      return Array.isArray(res) ? res : [];
    },
  });

  const materiales = useMemo(() => data || [], [data]);
  const monedas = useMonedas();

  // Chips por tipo de producto (Configuración > Catálogo), con los tipos que
  // de verdad tienen materiales.
  const familiasChips = useMemo(() => {
    const conteo = new Map<string, { label: string; total: number }>();
    for (const mat of materiales) {
      const id = mat.tipoProductoId;
      const actual = conteo.get(id) || { label: mat.tipoProducto?.nombre ?? '—', total: 0 };
      actual.total += 1;
      conteo.set(id, actual);
    }
    return [
      { id: 'ALL', label: 'Todos los tipos', total: materiales.length },
      ...[...conteo.entries()]
        .sort((a, b) => b[1].total - a[1].total || a[1].label.localeCompare(b[1].label, 'es'))
        .map(([id, { label, total }]) => ({ id, label, total })),
    ];
  }, [materiales]);

  const filteredMateriales = useMemo(() => {
    return materiales.filter((mat) => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        mat.skuInterno.toLowerCase().includes(term) ||
        mat.descripcion.toLowerCase().includes(term) ||
        (mat.tipoProducto?.nombre ?? '').toLowerCase().includes(term) ||
        mat.familia.toLowerCase().includes(term);

      const matchFamilia = selectedFamilia === 'ALL' || mat.tipoProductoId === selectedFamilia;

      return matchSearch && matchFamilia;
    });
  }, [materiales, searchTerm, selectedFamilia]);

  const columnas: ColumnFilterDef<Material>[] = useMemo(
    () => [
      { key: 'sku', tipo: 'texto', label: 'SKU / Código', accessor: (m) => m.skuInterno },
      { key: 'descripcion', tipo: 'texto', label: 'Descripción', accessor: (m) => m.descripcion },
      { key: 'proveedor', tipo: 'texto', label: 'Proveedor', accessor: (m) => m.proveedor?.nombre || '' },
    ],
    []
  );
  const {
    valores,
    setValor,
    limpiar: limpiarFiltrosColumna,
    hayFiltrosActivos: hayFiltrosColumnaActivos,
    datosFiltrados: materialesFiltradosPorColumna,
  } = useColumnFilters(filteredMateriales, columnas);

  // Al cambiar el filtro se vuelve a arrancar desde la primera tanda --
  // si no, "Mostrar más" quedaría pedido sobre un filtro que ya no aplica.
  React.useEffect(() => {
    setCantidadVisible(TANDA_INICIAL);
  }, [searchTerm, selectedFamilia, valores]);

  const materialesVisibles = useMemo(
    () => materialesFiltradosPorColumna.slice(0, cantidadVisible),
    [materialesFiltradosPorColumna, cantidadVisible]
  );
  const hayMasPorMostrar = cantidadVisible < materialesFiltradosPorColumna.length;

  // Formato de compra en una linea: "por m · barra de 5,8 m" (el del tipo o el propio).
  const formatoCorto = (mat: Material) => {
    const f = mat.formato;
    if (!f) return mat.unidadMedida;
    if (f.unidadCompra.codigo === f.unidadPrecio.codigo) return `por ${f.unidadPrecio.simbolo}`;
    return `por ${f.unidadPrecio.simbolo} · ${f.unidadCompra.simbolo} de ${f.factorCompra.toLocaleString('es-CL')} ${f.unidadPrecio.simbolo}`;
  };

  // La moneda con que se valoriza el precio: la del tipo de producto si es
  // fija o si el precio vino de HETMO (que manda un codigo de divisa sin
  // significado, "2"); la del precio si se cargo a mano con su ISO.
  const getMaterialPrecioInfo = (mat: Material) => {
    const ultimo = mat.precios && mat.precios.length > 0 ? mat.precios[0] : null;
    const precio = ultimo ? Number(ultimo.precio) : mat.precioOrigen != null ? Number(mat.precioOrigen) : null;
    const monedaPrecio = (ultimo ? ultimo.moneda : mat.monedaOrigen) || '';
    const esIso = /^([A-Z]{3}|UF)$/.test(monedaPrecio);
    const moneda = mat.formato && (mat.formato.monedaFija || !esIso) ? mat.formato.moneda : monedaPrecio;
    return { precio, moneda };
  };

  const formatPrecio = (precio?: number | null, moneda?: string | null) =>
    formatMonto(precio, resolverMoneda(moneda, monedas));

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in">
      <Seccion
        icono={Boxes}
        antetitulo="Maestro de materiales"
        titulo={
          <span className="flex items-center gap-2">
            Materiales
            <Badge size="sm" className="normal-case tracking-normal font-mono">
              {materialesFiltradosPorColumna.length}
            </Badge>
          </span>
        }
        descripcion="Catálogo con SKU, tipo de producto, formato de compra y precio de origen. Las reglas de cada tipo se configuran en Configuración › Catálogo."
        acciones={
          <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setIsModalOpen(true)}>
            Nuevo artículo
          </Button>
        }
      >
        <div className="space-y-3">
          <Buscador valor={searchTerm} onChange={setSearchTerm} placeholder="Buscar por SKU, descripción o tipo…" />
          <FiltroChips etiqueta="Filtrar por tipo de producto" opciones={familiasChips} valor={selectedFamilia} onChange={setSelectedFamilia} />
        </div>
      </Seccion>

      {/* Contenedor Principal de Datos */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <TableSkeleton rows={6} cols={6} />
        </div>
      ) : isError ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-xs">
          <p className="text-sm font-bold text-rose-600">
            Error al consultar el catálogo de materiales.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : materialesFiltradosPorColumna.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 sm:p-14 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <Boxes className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            No se encontraron materiales
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || selectedFamilia !== 'ALL' || hayFiltrosColumnaActivos
              ? 'Intenta ajustar los filtros de búsqueda, tipo o columna.'
              : 'Aún no hay artículos registrados en el maestro. Comienza creando el primero.'}
          </p>
          <div className="pt-2 flex justify-center gap-2 flex-wrap">
            {(searchTerm || selectedFamilia !== 'ALL' || hayFiltrosColumnaActivos) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedFamilia('ALL');
                  limpiarFiltrosColumna();
                }}
              >
                Limpiar Filtros
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsModalOpen(true)}
            >
              Nuevo Artículo
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* 1. VISTA TABLA AUTOMÁTICA EN DESKTOP/TABLET (System-Wide) */}
          {isDesktop && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <Tabla>
              <Thead>
                <Tr>
                  <Th className="px-5 py-3.5 w-36">SKU / Código</Th>
                  <Th className="px-5 py-3.5">Descripción</Th>
                  <Th className="px-5 py-3.5 w-36">Tipo · Partida</Th>
                  <Th className="px-5 py-3.5 w-36">Proveedor</Th>
                  <Th className="px-5 py-3.5 w-40">Formato</Th>
                  <Th alinear="centro" className="px-5 py-3.5 w-24">Divisa</Th>
                  <Th alinear="derecha" className="px-5 py-3.5 w-32">Precio Origen</Th>
                  {puedeEditar && <Th className="px-5 py-3.5 w-12" />}
                </Tr>
                <Tr className="bg-white border-b border-slate-100">
                  <Th className="px-5">
                    <ColumnFilterHeader columna={columnas[0]} valor={valores.sku || ''} onChange={(v) => setValor('sku', v)} />
                  </Th>
                  <Th className="px-5">
                    <ColumnFilterHeader columna={columnas[1]} valor={valores.descripcion || ''} onChange={(v) => setValor('descripcion', v)} />
                  </Th>
                  <Th className="px-5" />
                  <Th className="px-5">
                    <ColumnFilterHeader columna={columnas[2]} valor={valores.proveedor || ''} onChange={(v) => setValor('proveedor', v)} />
                  </Th>
                  <Th className="px-5" colSpan={puedeEditar ? 4 : 3} />
                </Tr>
              </Thead>
              <Tbody>
                {materialesVisibles.map((mat) => {
                  const { precio, moneda } = getMaterialPrecioInfo(mat);

                  return (
                    <Tr
                      key={mat.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <Td className="px-5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/80 group-hover:border-brand-600/30 group-hover:text-brand-600 transition-colors whitespace-nowrap">
                          {mat.skuInterno}
                        </span>
                      </Td>
                      <Td className="px-5 min-w-[16rem]">
                        <div className="font-semibold text-slate-900 line-clamp-2 leading-snug" title={mat.descripcion}>
                          {mat.descripcion}
                        </div>
                      </Td>
                      <Td className="px-5 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{mat.tipoProducto?.nombre ?? '—'}</div>
                        <div className="text-[10.5px] text-slate-400">{mat.tipoProducto?.partida?.nombre}</div>
                      </Td>
                      <Td className="px-5 text-slate-600 max-w-[14rem]">
                        <div className="truncate" title={mat.proveedor?.nombre}>
                          {mat.proveedor?.nombre || <span className="text-slate-300">—</span>}
                        </div>
                      </Td>
                      <Td className="px-5 text-[11px] text-slate-600 whitespace-nowrap">
                        {formatoCorto(mat)}
                        {mat.formato?.propio && <Badge size="sm" variant="info" className="ml-1.5">Propio</Badge>}
                      </Td>
                      <Td alinear="centro" className="px-5 font-mono font-bold text-slate-600 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[11px]">
                          {resolverMoneda(moneda, monedas).nombre}
                        </span>
                      </Td>
                      <Td alinear="derecha" className="px-5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatPrecio(precio, moneda)}
                      </Td>
                      {puedeEditar && (
                        <Td alinear="derecha" className="px-5">
                          <IconButton icono={Pencil} tono="marca" etiqueta={`Editar ${mat.skuInterno}: tipo, formato y proveedor`} onClick={() => setEditando(mat)} />
                        </Td>
                      )}
                    </Tr>
                  );
                })}
              </Tbody>
            </Tabla>
          </div>
          )}

          {/* 2. VISTA TARJETAS AUTOMÁTICA EN MÓVILES (System-Wide por defecto) */}
          {!isDesktop && (
          <div className="space-y-3">
            {materialesVisibles.map((mat) => {
              const { precio, moneda } = getMaterialPrecioInfo(mat);

              return (
                <div
                  key={mat.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 border border-slate-200 whitespace-nowrap">
                      {mat.skuInterno}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="subtle" size="sm">
                        {mat.tipoProducto?.nombre ?? '—'}
                      </Badge>
                      {puedeEditar && (
                        <IconButton icono={Pencil} tono="marca" etiqueta={`Editar ${mat.skuInterno}`} onClick={() => setEditando(mat)} />
                      )}
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 leading-snug">
                    {mat.descripcion}
                  </h4>

                  {mat.proveedor?.nombre && (
                    <div className="text-[11px] text-slate-500">
                      Proveedor: <span className="font-semibold text-slate-700">{mat.proveedor.nombre}</span>
                    </div>
                  )}

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-mono text-slate-600">
                      <span className="text-slate-400">Formato:</span>
                      <strong className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                        {formatoCorto(mat)}
                      </strong>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                      <Coins className="w-3.5 h-3.5 text-brand-600" />
                      <span>{formatPrecio(precio, moneda)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}

          {/* Renderizado por tandas -- ver TANDA_INICIAL más arriba */}
          {hayMasPorMostrar && (
            <div className="flex flex-col items-center gap-2 pt-1 pb-2">
              <p className="text-[11px] text-slate-400">
                Mostrando {materialesVisibles.length} de {materialesFiltradosPorColumna.length} materiales
              </p>
              <Button variant="outline" size="sm" onClick={() => setCantidadVisible((n) => n + TANDA_INCREMENTO)}>
                Mostrar más
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modal para Crear Nuevo Material */}
      <NuevoMaterialModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => refetch()}
      />
      {editando && <EditarMaterialModal material={editando} onClose={() => setEditando(null)} />}
    </div>
  );
};
