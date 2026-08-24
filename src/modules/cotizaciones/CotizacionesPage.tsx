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

  // Si se presiona "Cotizar", pasamos a la experiencia de pantalla completa del Cotizador
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
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
      
      {/* ========================================== */}
      {/* CABECERA & ESTADO DE IMPORTACIÃ“N */}
      {/* ========================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
            <span>Obras y Cotizaciones</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono font-normal">
              {filtered.length} proyectos
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Proyectos sincronizados desde HETMO listos para presupuestar y fabricar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tarjeta de estado de la Ãºltima sincronizaciÃ³n */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              Ãšltima importaciÃ³n:{' '}
              <strong className="text-slate-200 font-mono">
                {lastSync?.finalizadoEn
                  ? new Date(lastSync.finalizadoEn).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                  : 'Reciente'}
              </strong>
            </span>
          </div>

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 hover:border-cyan-500/30 text-xs font-semibold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar HETMO'}</span>
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* TABLA PRINCIPAL DE OBRAS */}
      {/* ========================================== */}
      <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-xs text-slate-400 font-mono">Cargando proyectos desde PostgreSQL...</div>
          </div>
        ) : isError ? (
          <div className="p-12 text-center space-y-2">
            <div className="text-red-400 font-semibold text-sm">
              Error al conectar con la base de datos Relay.
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Comprueba que el backend de Railway estÃ© en lÃ­nea y conectado a PostgreSQL.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-sm">
            No se encontraron obras con el tÃ©rmino "{searchTerm}".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 font-semibold">CÃ³digo</th>
                  <th className="px-6 py-4 font-semibold">Obra / Proyecto</th>
                  <th className="px-6 py-4 font-semibold">Cliente</th>
                  <th className="px-6 py-4 font-semibold text-center">VersiÃ³n</th>
                  <th className="px-6 py-4 font-semibold text-right">Superficie (mÂ²)</th>
                  <th className="px-6 py-4 font-semibold text-center">Ventanas</th>
                  <th className="px-6 py-4 font-semibold text-center">Estado</th>
                  <th className="px-6 py-4 font-semibold text-center">Acciones</th>
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
                      onClick={() => setCotizarProyectoId(p.id)}
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
                            {p.clienteDireccionRaw} {p.clienteLocalidadRaw ? `Â· ${p.clienteLocalidadRaw}` : ''}
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
                        {formatNumber(activeVersion?.totalM2Ventanas, 2)} <span className="text-[10px] font-normal text-slate-400">mÂ²</span>
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
                        <div className="flex items-center justify-center gap-2">
                          {/* BotÃ³n Principal: Cotizar */}
                          <button
                            onClick={() => setCotizarProyectoId(p.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/30 flex items-center gap-1.5 transition-all transform active:scale-95"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            <span>Cotizar</span>
                          </button>

                          {/* BotÃ³n Secundario: Ficha TÃ©cnica */}
                          <button
                            onClick={() => setSelectedProyectoId(p.id)}
                            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/5 flex items-center justify-center transition-colors"
                            title="Ver Ficha TÃ©cnica rÃ¡pida"
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

      {/* Modal Ficha TÃ©cnica rÃ¡pida */}
      <CotizacionDetalleModal
        proyectoId={selectedProyectoId}
        onClose={() => setSelectedProyectoId(null)}
      />
    </div>
  );
};
