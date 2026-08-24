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
  isDarkMode?: boolean;
}> = ({ searchTerm, isDarkMode = true }) => {
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
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
      
      {/* CABECERA & ESTADO DE IMPORTACIÓN */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black tracking-tight flex items-center gap-2.5 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            <span>Obras y Cotizaciones</span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold ${
              isDarkMode 
                ? 'bg-[#E34A26]/10 text-[#FF6B4A] border border-[#E34A26]/20' 
                : 'bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/30'
            }`}>
              {filtered.length} proyectos
            </span>
          </h1>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Proyectos sincronizados desde HETMO listos para presupuestar y fabricar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs border ${
            isDarkMode 
              ? 'bg-slate-900/80 border-white/10 text-slate-400' 
              : 'bg-white border-slate-200 text-slate-600 shadow-sm'
          }`}>
            <Clock className="w-3.5 h-3.5 text-[#E34A26]" />
            <span>
              Última importación:{' '}
              <strong className={`font-mono ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                {lastSync?.finalizadoEn
                  ? new Date(lastSync.finalizadoEn).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                  : 'Reciente'}
              </strong>
            </span>
          </div>

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 ${
              isDarkMode 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10 hover:border-[#E34A26]/30' 
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 hover:border-slate-400 shadow-sm'
            }`}
          >
            <RotateCcw className={`w-3.5 h-3.5 text-[#E34A26] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar HETMO'}</span>
          </button>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE OBRAS */}
      <div className={`rounded-2xl border shadow-xl overflow-hidden transition-colors ${
        isDarkMode 
          ? 'border-white/[0.08] bg-slate-950/60 shadow-black/40' 
          : 'border-slate-200 bg-white shadow-slate-200/50'
      }`}>
        {isLoading ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#E34A26] border-t-transparent rounded-full animate-spin mx-auto" />
            <div className={`text-xs font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Cargando proyectos desde PostgreSQL...
            </div>
          </div>
        ) : isError ? (
          <div className="p-12 text-center space-y-2">
            <div className="text-red-500 font-semibold text-sm">
              Error al conectar con la base de datos Relay.
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Comprueba que el backend de Railway esté en línea y conectado a PostgreSQL.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`p-16 text-center text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            No se encontraron obras con el término "{searchTerm}".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full text-left text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              <thead className={`text-[11px] uppercase tracking-wider border-b ${
                isDarkMode 
                  ? 'bg-slate-900/90 text-slate-400 border-white/10' 
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}>
                <tr>
                  <th className="px-6 py-4 font-semibold">Código</th>
                  <th className="px-6 py-4 font-semibold">Obra / Proyecto</th>
                  <th className="px-6 py-4 font-semibold">Cliente</th>
                  <th className="px-6 py-4 font-semibold text-center">Versión</th>
                  <th className="px-6 py-4 font-semibold text-right">Superficie (m²)</th>
                  <th className="px-6 py-4 font-semibold text-center">Ventanas</th>
                  <th className="px-6 py-4 font-semibold text-center">Estado</th>
                  <th className="px-6 py-4 font-semibold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-200'}`}>
                {filtered.map((p) => {
                  const activeVersion = p.versiones[0];
                  const isPedido = activeVersion?.estadoHetmo === 30 || activeVersion?.estadoGlosa?.toLowerCase().includes('pedido');

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors group cursor-pointer ${
                        isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => setCotizarProyectoId(p.id)}
                    >
                      <td className={`px-6 py-4 font-mono font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {p.codigoInterno || `PRJ-${p.numeroPresupuesto}`}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`font-semibold text-sm transition-colors ${
                          isDarkMode 
                            ? 'text-slate-100 group-hover:text-[#FF6B4A]' 
                            : 'text-slate-900 group-hover:text-[#E34A26]'
                        }`}>
                          {p.obra}
                        </div>
                        {p.clienteDireccionRaw && (
                          <div className={`text-[11px] truncate max-w-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {p.clienteDireccionRaw} {p.clienteLocalidadRaw ? `· ${p.clienteLocalidadRaw}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>{p.clienteNombreRaw}</div>
                        {p.clienteRutRaw && (
                          <div className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{p.clienteRutRaw}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] border ${
                          isDarkMode 
                            ? 'bg-slate-800/80 border-white/10 text-slate-300' 
                            : 'bg-slate-100 border-slate-300 text-slate-700'
                        }`}>
                          v{activeVersion?.versionNumero || 1}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-right font-mono font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                        {formatNumber(activeVersion?.totalM2Ventanas, 2)} <span className={`text-[10px] font-normal ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>m²</span>
                      </td>
                      <td className={`px-6 py-4 text-center font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        {activeVersion?.totalVentanas || 0}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide ${
                            isPedido
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {activeVersion?.estadoGlosa || 'Terminado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setCotizarProyectoId(p.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#E34A26] to-[#C13615] hover:from-[#FF6B4A] hover:to-[#E34A26] text-white font-bold text-xs shadow-md shadow-[#E34A26]/25 hover:shadow-[#E34A26]/40 flex items-center gap-1.5 transition-all transform active:scale-95"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            <span>Cotizar</span>
                          </button>

                          <button
                            onClick={() => setSelectedProyectoId(p.id)}
                            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors ${
                              isDarkMode 
                                ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border-white/5' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
                            }`}
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
