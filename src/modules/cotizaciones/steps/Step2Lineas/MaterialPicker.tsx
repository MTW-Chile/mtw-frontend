import React, { useEffect, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import type { Material } from '../../../../types';
import { getMateriales } from '../../../../api/client';

interface MaterialPickerProps {
  onSelect: (material: Material) => void;
  placeholder?: string;
}

/**
 * Buscador del maestro de materiales (SKU o descripción), con resultados en
 * vivo. Se usa tanto para agregar un material a una línea como para
 * reemplazar uno existente -- la diferencia entre ambos flujos vive en quien
 * lo embebe (ver MaterialLineaForm), no acá.
 */
export const MaterialPicker: React.FC<MaterialPickerProps> = ({ onSelect, placeholder }) => {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;
    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await getMateriales({ q: trimmed, limit: 20 });
        if (!cancelled) setResults(data);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={term}
          onChange={(e) => {
            const value = e.target.value;
            setTerm(value);
            if (value.trim().length < 2) {
              setResults([]);
              setIsLoading(false);
            }
          }}
          placeholder={placeholder || 'Buscar por SKU o descripción…'}
          autoFocus
          className="w-full pl-8 pr-8 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#E34A26]/30 focus:border-[#E34A26]"
        />
        {isLoading && (
          <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
        )}
      </div>
      {term.trim().length >= 2 && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
          {results.length === 0 && !isLoading ? (
            <div className="p-3 text-[11px] text-slate-400 text-center">Sin resultados</div>
          ) : (
            results.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="font-mono font-semibold text-[11px] text-slate-900">{m.skuInterno}</div>
                <div className="text-[11px] text-slate-600 leading-tight">{m.descripcion}</div>
                <div className="text-[10px] text-slate-400">{m.familia}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
