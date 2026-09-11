import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Pencil, Building2, X } from 'lucide-react';
import { getProveedores } from '../../../api/client';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { Badge } from '../../../components/ui/Badge';
import type { Proveedor } from '../../../types';
import { ProveedorEditModal } from './ProveedorEditModal';

/**
 * Maestro de Proveedores: quién es cada proveedor y sus datos de
 * facturación (RUT, dirección, email, forma de pago, cuenta bancaria). Los
 * importados de HETMO se completan solos en cada sincronización (ver
 * syncProveedores en sync-service.ts); los creados a mano desde "Nuevo
 * Artículo en Maestro" se completan acá, no tienen otra fuente.
 */
export const ProveedoresPanel: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editando, setEditando] = useState<Proveedor | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<Proveedor[]>({
    queryKey: ['proveedores'],
    queryFn: async () => (await getProveedores()).data,
  });

  const proveedores = useMemo(() => data || [], [data]);

  const filtrados = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return proveedores;
    return proveedores.filter(
      (p) =>
        p.nombre.toLowerCase().includes(term) ||
        (p.rut || '').toLowerCase().includes(term) ||
        (p.email || '').toLowerCase().includes(term)
    );
  }, [proveedores, searchTerm]);

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in">
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, RUT o email..."
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
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <TableSkeleton rows={6} cols={5} />
        </div>
      ) : isError ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-xs">
          <p className="text-sm font-bold text-rose-600">Error al consultar el maestro de proveedores.</p>
          <button onClick={() => refetch()} className="text-xs font-bold text-[#E34A26] hover:underline cursor-pointer">
            Reintentar
          </button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 sm:p-14 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No se encontraron proveedores</h3>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Nombre</th>
                  <th className="px-5 py-3.5">Origen</th>
                  <th className="px-5 py-3.5">RUT</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Condiciones de Pago</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{p.nombre}</td>
                    <td className="px-5 py-3.5">
                      {p.codigoHetmo != null ? (
                        <Badge variant="info" size="sm">HETMO</Badge>
                      ) : (
                        <Badge variant="default" size="sm">Manual</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{p.rut || <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-slate-600">{p.email || <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-slate-600">{p.condicionesPago || <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setEditando(p)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-600 hover:text-[#E34A26] hover:bg-orange-50 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editando && <ProveedorEditModal proveedor={editando} onClose={() => setEditando(null)} />}
    </div>
  );
};
