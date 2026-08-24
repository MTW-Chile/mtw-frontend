import React, { useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSyncLogs, triggerManualSync } from '../../api/client';
import { formatDate } from '../../lib/utils';

export const Header: React.FC<{
  searchTerm: string;
  onSearchChange: (val: string) => void;
}> = ({ searchTerm, onSearchChange }) => {
  const queryClient = useQueryClient();
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  const { data: logs, isError: logsError } = useQuery({
    queryKey: ['syncLogs'],
    queryFn: () => getSyncLogs(1),
    refetchInterval: 30000,
    retry: 1,
  });

  const lastLog = logs?.[0];

  const syncMutation = useMutation({
    mutationFn: () => triggerManualSync(false),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      queryClient.invalidateQueries({ queryKey: ['syncLogs'] });
      setSyncSuccessMsg(`Sincronización completada (${data.result?.versionesNuevas || 0} proyectos actualizados)`);
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    },
  });

  return (
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
            {logsError ? 'Desconectado' : lastLog ? formatDate(lastLog.iniciadoEn) : 'Conectado'}
          </span>
        </div>

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
  );
};