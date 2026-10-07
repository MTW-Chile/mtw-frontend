import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Plus, Search, User } from 'lucide-react';
import { getClientes } from '../../api/client';
import type { Cliente } from '../../types';
import { ClienteFormModal } from './ClienteFormModal';

interface Props {
  value: Cliente | null;
  onChange: (cliente: Cliente | null) => void;
}

// Selector de cliente del maestro: buscar uno existente o crear uno nuevo
// (reutiliza el mismo formulario del maestro de Clientes). Lo usan las dos
// creaciones manuales -- presupuesto manual en Cotizaciones y obra manual en
// Obras -- para que ambas pidan el cliente de la misma forma.
export const ClientePicker: React.FC<Props> = ({ value, onChange }) => {
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  const { data, isLoading } = useQuery({
    queryKey: ['clientes', 'selector', busqueda],
    queryFn: () => getClientes(busqueda || undefined),
    enabled: !value,
    staleTime: 1000 * 30,
    refetchInterval: false,
  });
  const clientes = (data?.data ?? []).slice(0, 50);

  const etiqueta = 'block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5';

  if (value) {
    return (
      <div>
        <span className={etiqueta}>Cliente</span>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 truncate">{value.nombre}</p>
            <p className="text-[11px] text-slate-500 truncate">{value.rut || 'Sin RUT'}</p>
          </div>
          <button type="button" onClick={() => onChange(null)} className="text-xs font-semibold text-brand-700 hover:underline cursor-pointer shrink-0">
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <span className={etiqueta}>Cliente (del maestro)</span>
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre o RUT..."
          aria-label="Buscar cliente"
          className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-brand-600"
        />
      </div>
      <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
        {isLoading ? (
          <div className="p-3 flex items-center justify-center text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : clientes.length === 0 ? (
          <p className="p-3 text-xs text-slate-500">{busqueda ? 'Ningún cliente coincide.' : 'Todavía no hay clientes en el maestro.'}</p>
        ) : (
          clientes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c)}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-slate-900 truncate">{c.nombre}</span>
                <span className="block text-[11px] text-slate-500 truncate">{c.rut || 'Sin RUT'}</span>
              </span>
            </button>
          ))
        )}
      </div>
      <button
        type="button"
        onClick={() => setCreando(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        Crear cliente nuevo
      </button>

      {/* Portal: el formulario de cliente es un <form>; montado aparte para no
          quedar anidado (ni burbujear su envio) dentro del formulario de la
          pantalla que usa este selector. */}
      {creando &&
        createPortal(
          <ClienteFormModal
            cliente={null}
            onClose={() => setCreando(false)}
            onGuardado={(c) => {
              setCreando(false);
              onChange(c);
            }}
          />,
          document.body
        )}
    </div>
  );
};
