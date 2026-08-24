import React, { useState } from 'react';
import { Search, RefreshCw, Key, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSyncLogs, triggerManualSync, getServiceToken, setServiceToken, API_BASE_URL } from '../../api/client';
import { formatDate } from '../../lib/utils';

export const Header: React.FC<{
  searchTerm: string;
  onSearchChange: (val: string) => void;
}> = ({ searchTerm, onSearchChange }) => {
  const queryClient = useQueryClient();
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState(getServiceToken());

  const { data: logs, isError: logsError } = useQuery({
    queryKey: ['syncLogs'],
    queryFn: () => getSyncLogs(1),
    refetchInterval: 30000,
    retry: 1,
  });

  const lastLog = logs?.[0];
  const hasToken = !!getServiceToken();

  const syncMutation = useMutation({
    mutationFn: () => triggerManualSync(false),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      queryClient.invalidateQueries({ queryKey: ['syncLogs'] });
      setSyncSuccessMsg(`Sincronización completada (${data.result?.versionesNuevas || 0} proyectos actualizados)`);
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    },
  });

  const handleSaveToken = (e: React.FormEvent) => {
    e.preventDefault();
    setServiceToken(tokenInput);
    setShowTokenModal(false);
    queryClient.invalidateQueries();
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-16 border-b border-white/[0.08] bg-[#0B0F17]/80 backdrop-blur-xl px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 w-full max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por obra, cliente, RUT o código..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-900/70 border border-white/10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-white/5 text-xs text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${logsError ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${logsError ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-slate-400">HETMO Sync:</span>
            <span className="text-slate-200 font-medium">
              {logsError ? 'Requiere Token' : lastLog ? formatDate(lastLog.iniciadoEn) : 'Conectado'}
            </span>
          </div>

          <button
            onClick={() => {
              setTokenInput(getServiceToken());
              setShowTokenModal(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              hasToken
                ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-white/10'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse'
            }`}
            title="Configurar Service Token de API"
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{hasToken ? 'Token OK' : 'Configurar Token'}</span>
          </button>

          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-xs font-semibold tracking-wide transition-all disabled:opacity-50"
            title="Sincronizar con HETMO"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{syncMutation.isPending ? 'Sincronizando...' : 'Actualizar'}</span>
          </button>

          {syncSuccessMsg && (
            <div className="absolute right-6 top-16 bg-emerald-950/90 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs shadow-lg animate-fade-in z-50">
              {syncSuccessMsg}
            </div>
          )}
        </div>
      </header>

      {/* Modal de Configuración de Service Token */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#0E131F] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-cyan-400">
                <Key className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Service Token de Conexión</h3>
              </div>
              <button
                onClick={() => setShowTokenModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              El backend Relay requiere un <strong className="text-slate-200">Service Token</strong> para acceder a los datos de la base de datos PostgreSQL de HETMO.
            </p>

            <form onSubmit={handleSaveToken} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Backend API URL
                </label>
                <input
                  type="text"
                  readOnly
                  value={API_BASE_URL}
                  className="w-full h-9 px-3 rounded-lg bg-slate-900/80 border border-white/5 text-xs text-slate-400 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Service Token / API Key
                </label>
                <input
                  type="password"
                  placeholder="Pegar service token aquí..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-slate-900 border border-white/10 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Se puede configurar en Railway como variable de entorno <code className="text-cyan-400">VITE_SERVICE_TOKEN</code> o guardarlo localmente.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTokenInput('');
                    setServiceToken('');
                    setShowTokenModal(false);
                    queryClient.invalidateQueries();
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors"
                >
                  Limpiar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar Token</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};