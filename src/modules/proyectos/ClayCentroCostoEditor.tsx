import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { updateClayCentroCosto } from '../../api/client';
import { IconButton } from '../../components/ui/IconButton';
import { ActivadorEdicion } from '../../components/ui/ActivadorEdicion';
import { InputCompacto } from '../../components/ui/Campos';

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
      <ActivadorEdicion
        etiqueta="Centro de costo de esta obra en Clay: se usa al contabilizar las facturas de sus OC"
        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-[11px]"
        onClick={() => {
          setTexto(valor ?? '');
          setEditando(true);
        }}
      >
        <span className="text-slate-400">Centro de costo Clay: </span>
        <span className={`font-semibold ${valor ? 'text-slate-800' : 'text-amber-600'}`}>{valor || 'Sin configurar'}</span>
      </ActivadorEdicion>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <InputCompacto
          aria-label="Centro de costo en Clay"
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') mutation.mutate();
            if (e.key === 'Escape') setEditando(false);
          }}
          placeholder="Nombre exacto en Clay"
          className="w-48"
        />
        <IconButton icono={Check} tono="marca" etiqueta="Guardar" onClick={() => mutation.mutate()} cargando={mutation.isPending} />
        <IconButton icono={X} etiqueta="Cancelar" onClick={() => setEditando(false)} disabled={mutation.isPending} />
      </div>
      {error && <span className="text-[10px] text-rose-600">{error}</span>}
    </div>
  );
};
