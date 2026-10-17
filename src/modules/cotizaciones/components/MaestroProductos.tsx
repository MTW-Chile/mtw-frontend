import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Filter,
  X,
  Boxes,
  Coins,
  ChevronDown,
  Pencil,
} from 'lucide-react';
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
import { BREAKPOINT_DESKTOP, TABLE_CLASS, TABLE_WRAPPER_CLASS } from '../../../lib/designSystem';

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
      {/* Encabezado Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
              <span>Maestro de Productos & Materiales</span>
            </h2>
            <Badge variant="brand" size="sm">
              {materialesFiltradosPorColumna.length} ítems
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Catálogo con SKU, tipo de producto, formato de compra y precio de origen. Las reglas de cada tipo se configuran en Configuración › Catálogo.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto"
          >
            Nuevo Artículo
          </Button>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros Responsivos */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Buscador */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por SKU, descripción o tipo..."
              className="w-full pl-10 pr-9 py-2.5 sm:py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-brand-600 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* FILTRO EN FORMATO DESPLEGABLE PARA MÓVILES (System-Wide) */}
          <div className="block md:hidden relative w-full sm:w-64">
            <select
              value={selectedFamilia}
              onChange={(e) => setSelectedFamilia(e.target.value)}
              className="w-full py-2.5 pl-3.5 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand-600 appearance-none cursor-pointer"
            >
              {familiasChips.map((chip) => (
                <option key={chip.id} value={chip.id}>
                  {chip.label} ({chip.total})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* FILTRO EN CHIPS HORIZONTALES PARA PANTALLAS GRANDES (System-Wide) */}
        <div className="hidden md:flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-1 -mx-1 px-1 scrollbar-thin">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Tipo:
          </span>
          {familiasChips.map((chip) => {
            const isActive = selectedFamilia === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setSelectedFamilia(chip.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-brand-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'
                }`}
              >
                {chip.label} <span className={isActive ? 'opacity-80' : 'text-slate-400'}>{chip.total}</span>
              </button>
            );
          })}
        </div>
      </div>

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
            <div className={TABLE_WRAPPER_CLASS}>
              <table className={TABLE_CLASS + ' text-left text-slate-700'}>
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5 w-36">SKU / Código</th>
                    <th className="px-5 py-3.5">Descripción</th>
                    <th className="px-5 py-3.5 w-36">Tipo · Partida</th>
                    <th className="px-5 py-3.5 w-36">Proveedor</th>
                    <th className="px-5 py-3.5 w-40">Formato</th>
                    <th className="px-5 py-3.5 text-center w-24">Divisa</th>
                    <th className="px-5 py-3.5 text-right w-32">Precio Origen</th>
                    {puedeEditar && <th className="px-5 py-3.5 w-12" />}
                  </tr>
                  <tr className="bg-white border-b border-slate-100">
                    <th className="px-5 py-2.5">
                      <ColumnFilterHeader columna={columnas[0]} valor={valores.sku || ''} onChange={(v) => setValor('sku', v)} />
                    </th>
                    <th className="px-5 py-2.5">
                      <ColumnFilterHeader columna={columnas[1]} valor={valores.descripcion || ''} onChange={(v) => setValor('descripcion', v)} />
                    </th>
                    <th className="px-5 py-2.5" />
                    <th className="px-5 py-2.5">
                      <ColumnFilterHeader columna={columnas[2]} valor={valores.proveedor || ''} onChange={(v) => setValor('proveedor', v)} />
                    </th>
                    <th className="px-5 py-2.5" colSpan={puedeEditar ? 4 : 3} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {materialesVisibles.map((mat) => {
                    const { precio, moneda } = getMaterialPrecioInfo(mat);

                    return (
                      <tr
                        key={mat.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        <td className="px-5 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/80 group-hover:border-brand-600/30 group-hover:text-brand-600 transition-colors whitespace-nowrap">
                            {mat.skuInterno}
                          </span>
                        </td>
                        <td className="px-5 py-3 min-w-[16rem]">
                          <div className="font-semibold text-slate-900 line-clamp-2 leading-snug" title={mat.descripcion}>
                            {mat.descripcion}
                          </div>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">{mat.tipoProducto?.nombre ?? '—'}</div>
                          <div className="text-[10.5px] text-slate-400">{mat.tipoProducto?.partida?.nombre}</div>
                        </td>
                        <td className="px-5 py-3 text-slate-600 max-w-[14rem]">
                          <div className="truncate" title={mat.proveedor?.nombre}>
                            {mat.proveedor?.nombre || <span className="text-slate-300">—</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-[11px] text-slate-600 whitespace-nowrap">
                          {formatoCorto(mat)}
                          {mat.formato?.propio && <Badge size="sm" variant="info" className="ml-1.5">Propio</Badge>}
                        </td>
                        <td className="px-5 py-3 text-center font-mono font-bold text-slate-600 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[11px]">
                            {resolverMoneda(moneda, monedas).nombre}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatPrecio(precio, moneda)}
                        </td>
                        {puedeEditar && (
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => setEditando(mat)}
                              className="w-7 h-7 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 inline-flex items-center justify-center cursor-pointer"
                              aria-label={`Editar ${mat.skuInterno}`}
                              title="Tipo, formato y proveedor"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                        <button
                          onClick={() => setEditando(mat)}
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-brand-600 inline-flex items-center justify-center cursor-pointer"
                          aria-label={`Editar ${mat.skuInterno}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
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
