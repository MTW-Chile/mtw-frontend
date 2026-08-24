import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  RotateCcw,
  Calculator,
  Eye,
  Clock
} from 'lucide-react';
import { getProyectos, getSyncLogs, triggerManualSync } from '../../api/client';
import { formatNumber } from '../../lib/utils';
import { CotizacionDetalleModal } from './CotizacionDetalleModal';
import { CotizadorWorkspace } from './CotizadorWorkspace';

export const CotizacionesPage: React.FC<{
  searchTerm: string;
}> = ({ searchTerm }) => {
  const [selectedProyectoId, setSelectedProyectoId] = useState<string | null>(null);
  const [cotizarProyectoId, setCotizarProyectoId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['proyectos'],
    queryFn: () => getProyectos({ limit: 100 }),
  });

  const { data: syncLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['syncLogsRecent'],
    queryFn: () => getSyncLogs(1),
  });

  const proyectos = data?.data || [];
  const lastSync = syncLogs?.[0];

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      await triggerManualSync(false);
      setTimeout(() => {
        refetch();
        refetchLogs();
        setIsSyncing(false);
      }, 3000);
    } catch {
      setIsSyncing(false);
    }
  };

  const filtered = proyectos.filter((p) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const matchObra = p.obra?.toLowerCase().includes(term);
    const matchCliente = p.clienteNombreRaw?.toLowerCase().includes(term);
    const matchCodigo = p.codigoInterno?.toLowerCase().includes(term);
    const matchRut = p.clienteRutRaw?.toLowerCase().includes(term);
    return matchObra || matchCliente || matchCodigo || matchRut;
  });

  if (cotizarProyectoId) {
    return (
      <CotizadorWorkspace
        proyectoId={cotizarProyectoId}
        onBack={() => {
          setCotizarProyectoId(null);
          refetch();
        }}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* CABECERA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <span>Obras y Cotizaciones</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20">
              {filtered.length} proyectos
            </span>
          </h1>
          <p className="text-xs mt-1 text-slate-600">
            Proyectos sincronizados desde HETMO listos para presupuestar y fabricar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs bg-white border border-slate-200 text-slate-600 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-[#E34A26]" />
            <span>
              Última importación:{" "}
              <strong className="font-mono text-slate-900">
                {lastSync?.finalizadoEn
                  ? new Date(lastSync.finalizadoEn).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                  : 'Reciente'}
              </strong>
            </span>
          </div>

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 hover:border-slate-400 text-xs font-semibold transition-all flex items-center gap-2 shadow-xs disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-[#E34A26] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar HETMO'}</span>
          </button>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE OBRAS */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#E34A26] border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-xs font-mono text-slate-600">
              Cargando proyectos desde PostgreSQL...
            </div>
          </div>
        ) : isError ? (
          <div className="p-12 text-center space-y-2">
            <div className="text-red-600 font-bold text-sm">
              Error al conectar con la base de datos Relay.
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Comprueba que el backend de Railway esté en línea y conectado a PostgreSQL.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-sm text-slate-500">
            No se encontraron obras con el término "{searchTerm}".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="text-[11px] uppercase tracking-wider bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="px-6 py-3.5">Código</th>
                  <th className="px-6 py-3.5">Obra / Proyecto</th>
                  <th className="px-6 py-3.5">Cliente</th>
                  <th className="px-6 py-3.5 text-center">Versión</th>
                  <th className="px-6 py-3.5 text-right">Superficie (m²)</th>
                  <th className="px-6 py-3.5 text-center">Ventanas</th>
                  <th className="px-6 py-3.5 text-center">Estado</th>
                  <th className="px-6 py-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const activeVersion = p.versiones[0];
                  const isPedido = activeVersion?.estadoHetmo === 30 || activeVersion?.estadoGlosa?.toLowerCase().includes('pedido');

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setCotizarProyectoId(p.id)}
                    >
                      <td className="px-6 py-4 font-mono font-bold text-slate-500">
                        {p.codigoInterno || `PRJ-${p.numeroPresupuesto}`}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-sm text-slate-900 group-hover:text-[#E34A26] transition-colors">
                          {p.obra}
                        </div>
                        {p.clienteDireccionRaw && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">
                            {p.clienteDireccionRaw} {p.clienteLocalidadRaw ? `· ${p.clienteLocalidadRaw}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{p.clienteNombreRaw}</div>
                        {p.clienteRutRaw && (
                          <div className="text-[10px] font-mono text-slate-500">{p.clienteRutRaw}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold bg-slate-100 border border-slate-200 text-slate-700">
                          v{activeVersion?.versionNumero || 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                        {formatNumber(activeVersion?.totalM2Ventanas, 2)} <span className="text-[10px] font-normal text-slate-500">m²</span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-900">
                        {activeVersion?.totalVentanas || 0}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${
                            isPedido
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {activeVersion?.estadoGlosa || 'Terminado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setCotizarProyectoId(p.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-[#E34A26] hover:bg-[#C13615] text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all transform active:scale-95"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            <span>Cotizar</span>
                          </button>

                          <button
                            onClick={() => setSelectedProyectoId(p.id)}
                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 flex items-center justify-center transition-colors"
                            title="Ver Ficha Técnica rápida"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
