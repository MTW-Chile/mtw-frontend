import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { updateClayCentroCosto } from '../../api/client';

// Centro de costo de la obra en Clay (Proyecto.clayCentroCosto) -- el
// gasto de las facturas de sus OC se contabiliza con este centro. Clay los
// identifica por NOMBRE exacto y su API no permite listarlos, asi que se
// escribe tal cual esta creado en Clay (si no existe, Clay rechaza el
// asiento al conciliar).
export const ClayCentroCostoEditor: React.FC<{ proyectoId: string; valor: string | null }> = ({ proyectoId, valor }) => {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor ?? '');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => updateClayCentroCosto(proyectoId, texto.trim() || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      setEditando(false);
      setError(null);
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo guardar.'),
  });

  if (!editando) {
    return (
      <button
        onClick={() => {
          setTexto(valor ?? '');
          setEditando(true);
        }}
        title="Centro de costo de esta obra en Clay -- se usa al contabilizar las facturas de sus OC"
        className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-[11px] transition-colors min-w-0"
      >
        <span className="text-slate-400 shrink-0">Centro de costo Clay:</span>
        <span className={`font-semibold truncate ${valor ? 'text-slate-800' : 'text-amber-600'}`}>{valor || 'Sin configurar'}</span>
        <Pencil className="w-3 h-3 text-slate-400 group-hover:text-slate-700 shrink-0" />
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') mutation.mutate();
            if (e.key === 'Escape') setEditando(false);
          }}
          placeholder="Nombre exacto en Clay"
          className="w-48 text-[11px] border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-[#E34A26]"
        />
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          title="Guardar"
          className="w-6 h-6 rounded-lg bg-[#E34A26] text-white flex items-center justify-center disabled:opacity-50"
        >
          {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        </button>
        <button
          onClick={() => setEditando(false)}
          disabled={mutation.isPending}
          title="Cancelar"
          className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {error && <span className="text-[10px] text-rose-600">{error}</span>}
    </div>
  );
};
