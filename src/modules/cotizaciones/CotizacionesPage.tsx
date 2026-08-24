import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Building2, 
  Ruler, 
  Boxes, 
  Eye
} from 'lucide-react';
import { getProyectos } from '../../api/client';
import { formatNumber } from '../../lib/utils';
import { CotizacionDetalleModal } from './CotizacionDetalleModal';

export const CotizacionesPage: React.FC<{
  searchTerm: string;
}> = ({ searchTerm }) => {
  const [selectedEstado, setSelectedEstado] = useState<number | null>(null);
  const [selectedProyectoId, setSelectedProyectoId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['proyectos', selectedEstado],
    queryFn: () => getProyectos({ limit: 100, estado: selectedEstado || undefined }),
  });

  const proyectos = data?.data || [];

  const filtered = proyectos.filter((p) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const matchObra = p.obra?.toLowerCase().includes(term);
    const matchCliente = p.clienteNombreRaw?.toLowerCase().includes(term);
    const matchCodigo = p.codigoInterno?.toLowerCase().includes(term);
    const matchRut = p.clienteRutRaw?.toLowerCase().includes(term);
    return matchObra || matchCliente || matchCodigo || matchRut;
  });

  let totalM2Global = 0;
  let totalVentanasGlobal = 0;
  proyectos.forEach((p) => {
    const v = p.versiones[0];
    if (v) {
      totalM2Global += Number(v.totalM2Ventanas || 0);
      totalVentanasGlobal += Number(v.totalVentanas || 0);
    }
  });

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Cotizaciones & Presupuestos</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold font-mono">
              {filtered.length} Obras
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestión centralizada de proyectos, metrajes y recetas de despiece sincronizadas con HETMO.
          </p>
        </div>

        <div className="flex items-center gap-2 p-1 bg-slate-900/60 border border-white/10 rounded-xl text-xs font-medium self-start">
          <button
            onClick={() => setSelectedEstado(null)}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              selectedEstado === null
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todas ({proyectos.length})
          </button>
          <button
            onClick={() => setSelectedEstado(2)}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              selectedEstado === 2
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Terminadas
          </button>
          <button
            onClick={() => setSelectedEstado(30)}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              selectedEstado === 30
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            En Pedido
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Total Obras Activas</span>
            <Building2 className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-white">
            {proyectos.length}
          </div>
          <p className="mt-1 text-xs text-slate-400">Sincronizadas en PostgreSQL</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Superficie Total Cotizada</span>
            <Ruler className="w-5 h-5 text-blue-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-white">
            {formatNumber(totalM2Global, 1)} <span className="text-sm font-normal text-slate-400">m²</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Cálculo acumulado de paños</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Ventanas en Fabricación</span>
            <Boxes className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-white">
            {totalVentanasGlobal} <span className="text-sm font-normal text-slate-400">paños</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Listos con cotas paramétricas</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-white/[0.08]">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs">Cargando obras desde PostgreSQL...</span>
          </div>
        ) : isError ? (
          <div className="p-12 text-center space-y-2">
            <div className="text-red-400 font-semibold text-sm">
              Error al conectar con la base de datos de HETMO.
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No se pudo obtener la información desde el backend Relay. Comprueba que el servicio Relay esté en línea en Railway.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-sm">
            No se encontraron obras con el término "{searchTerm}".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 font-semibold">Código</th>
                  <th className="px-6 py-4 font-semibold">Obra / Proyecto</th>
                  <th className="px-6 py-4 font-semibold">Cliente</th>
                  <th className="px-6 py-4 font-semibold text-center">Versión</th>
                  <th className="px-6 py-4 font-semibold text-right">Superficie (m²)</th>
                  <th className="px-6 py-4 font-semibold text-center">Ventanas</th>
                  <th className="px-6 py-4 font-semibold text-center">Estado</th>
                  <th className="px-6 py-4 font-semibold text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((p) => {
                  const activeVersion = p.versiones[0];
                  const isPedido = activeVersion?.estadoHetmo === 30 || activeVersion?.estadoGlosa?.toLowerCase().includes('pedido');

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedProyectoId(p.id)}
                    >
                      <td className="px-6 py-4 font-mono font-bold text-slate-400">
                        {p.codigoInterno || `PRJ-${p.numeroPresupuesto}`}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-100 text-sm group-hover:text-cyan-400 transition-colors">
                          {p.obra}
                        </div>
                        {p.clienteDireccionRaw && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">
                            {p.clienteDireccionRaw} {p.clienteLocalidadRaw ? `· ${p.clienteLocalidadRaw}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-300 font-medium">{p.clienteNombreRaw}</div>
                        {p.clienteRutRaw && (
                          <div className="text-[10px] text-slate-500 font-mono">{p.clienteRutRaw}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-white/10 text-slate-300 font-mono text-[11px]">
                          v{activeVersion?.versionNumero || 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-100">
                        {formatNumber(activeVersion?.totalM2Ventanas, 2)} <span className="text-[10px] font-normal text-slate-400">m²</span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-200">
                        {activeVersion?.totalVentanas || 0}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide ${
                            isPedido
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {activeVersion?.estadoGlosa || 'Terminado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedProyectoId(p.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-400 border border-white/5 hover:border-cyan-500/30 text-xs font-medium transition-all flex items-center gap-1.5 mx-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ficha</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CotizacionDetalleModal
        proyectoId={selectedProyectoId}
        onClose={() => setSelectedProyectoId(null)}
      />
    </div>
  );
};