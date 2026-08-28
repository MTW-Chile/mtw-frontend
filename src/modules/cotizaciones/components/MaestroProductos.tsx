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
} from 'lucide-react';
import { getMateriales } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { NuevoMaterialModal } from './NuevoMaterialModal';
import { useMonedas, resolverMoneda, formatMonto } from '../../../lib/monedas';
import type { Material } from '../../../types';

export const MaestroProductos: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFamilia, setSelectedFamilia] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<Material[]>({
    queryKey: ['materiales'],
    queryFn: async () => {
      const res = await getMateriales();
      return Array.isArray(res) ? res : [];
    },
  });

  const materiales = useMemo(() => data || [], [data]);
  const monedas = useMonedas();

  // Las familias del filtro salen de los datos, no de una lista fija: HETMO
  // usa Perfileria, Vidrios, Herrajes, Accesorios, Refuerzos, Juntas y Otros,
  // y una lista escrita a mano dejaba chips que no filtraban nada (CRISTALES)
  // y familias reales sin chip (Refuerzos, Juntas).
  const familiasChips = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const mat of materiales) {
      const familia = (mat.familia || 'Otros').trim();
      conteo.set(familia, (conteo.get(familia) || 0) + 1);
    }
    return [
      { id: 'ALL', label: 'Todas las Familias', total: materiales.length },
      ...[...conteo.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
        .map(([familia, total]) => ({ id: familia, label: familia, total })),
    ];
  }, [materiales]);

  const filteredMateriales = useMemo(() => {
    return materiales.filter((mat) => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        mat.skuInterno.toLowerCase().includes(term) ||
        mat.descripcion.toLowerCase().includes(term) ||
        mat.familia.toLowerCase().includes(term);

      const matchFamilia =
        selectedFamilia === 'ALL' ||
        mat.familia.toUpperCase() === selectedFamilia.toUpperCase();

      return matchSearch && matchFamilia;
    });
  }, [materiales, searchTerm, selectedFamilia]);

  const familiaBadges: Record<string, { label: string; variant: any }> = {
    PERFILERIA: { label: 'Perfilería', variant: 'brand' },
    CRISTALES: { label: 'Cristal / DVH', variant: 'info' },
    HERRAJES: { label: 'Herrajes', variant: 'warning' },
    SELLOS_GOMAS: { label: 'Sellos & Gomas', variant: 'success' },
    FIJACIONES: { label: 'Fijaciones', variant: 'subtle' },
    ACCESORIOS: { label: 'Accesorios', variant: 'default' },
    QUIMICOS: { label: 'Químicos & Sellos', variant: 'info' },
    OTROS: { label: 'Otros', variant: 'outline' },
  };

  const getMaterialPrecioInfo = (mat: Material) => {
    if (mat.precios && mat.precios.length > 0) {
      const p = mat.precios[0];
      return { precio: Number(p.precio), moneda: p.moneda || '' };
    }
    return {
      precio: mat.precioOrigen !== undefined && mat.precioOrigen !== null ? Number(mat.precioOrigen) : null,
      moneda: mat.monedaOrigen || '',
    };
  };

  // El material trae el codigo de divisa de HETMO ("2"), no un ISO: hay que
  // resolverlo contra el diccionario antes de mostrar nada.
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
              {filteredMateriales.length} ítems
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Catálogo con SKU, familia, unidad de medida, divisa y precio de origen para cotización.
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
              placeholder="Buscar por SKU, descripción o familia..."
              className="w-full pl-10 pr-9 py-2.5 sm:py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#E34A26] transition-all"
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
              className="w-full py-2.5 pl-3.5 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#E34A26] appearance-none cursor-pointer"
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
            Familia:
          </span>
          {familiasChips.map((chip) => {
            const isActive = selectedFamilia === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setSelectedFamilia(chip.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#E34A26] text-white font-bold shadow-xs'
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
      ) : filteredMateriales.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 sm:p-14 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <Boxes className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            No se encontraron materiales
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || selectedFamilia !== 'ALL'
              ? 'Intenta ajustar los filtros de búsqueda o familia de materiales.'
              : 'Aún no hay artículos registrados en el maestro. Comienza creando el primero.'}
          </p>
          <div className="pt-2 flex justify-center gap-2 flex-wrap">
            {(searchTerm || selectedFamilia !== 'ALL') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedFamilia('ALL');
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
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs text-slate-700">
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5 w-36">SKU / Código</th>
                    <th className="px-5 py-3.5">Descripción</th>
                    <th className="px-5 py-3.5 w-36">Familia</th>
                    <th className="px-5 py-3.5 text-center w-20">Unidad</th>
                    <th className="px-5 py-3.5 text-center w-24">Divisa</th>
                    <th className="px-5 py-3.5 text-right w-32">Precio Origen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMateriales.map((mat) => {
                    const badgeInfo = familiaBadges[mat.familia.toUpperCase()] || {
                      label: mat.familia,
                      variant: 'default',
                    };
                    const { precio, moneda } = getMaterialPrecioInfo(mat);

                    return (
                      <tr
                        key={mat.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        <td className="px-5 py-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/80 group-hover:border-[#E34A26]/30 group-hover:text-[#E34A26] transition-colors whitespace-nowrap">
                            {mat.skuInterno}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">
                            {mat.descripcion}
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <Badge variant={badgeInfo.variant} size="sm">
                            {badgeInfo.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-center font-mono font-bold text-slate-700 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px]">
                            {mat.unidadMedida}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center font-mono font-bold text-slate-600 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[11px]">
                            {resolverMoneda(moneda, monedas).nombre}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatPrecio(precio, moneda)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. VISTA TARJETAS AUTOMÁTICA EN MÓVILES (System-Wide por defecto) */}
          <div className="block md:hidden space-y-3">
            {filteredMateriales.map((mat) => {
              const badgeInfo = familiaBadges[mat.familia.toUpperCase()] || {
                label: mat.familia,
                variant: 'default',
              };
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
                    <Badge variant={badgeInfo.variant} size="sm">
                      {badgeInfo.label}
                    </Badge>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 leading-snug">
                    {mat.descripcion}
                  </h4>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-mono text-slate-600">
                      <span className="text-slate-400">Unidad:</span>
                      <strong className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                        {mat.unidadMedida}
                      </strong>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                      <Coins className="w-3.5 h-3.5 text-[#E34A26]" />
                      <span>{formatPrecio(precio, moneda)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal para Crear Nuevo Material */}
      <NuevoMaterialModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => refetch()}
      />
    </div>
  );
};
