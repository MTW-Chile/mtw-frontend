import React, { useEffect, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import type { Material } from '../../../../types';
import { getMateriales } from '../../../../api/client';
import { Input } from '../../../../components/ui/Input';
import { BotonFila } from '../../../../components/ui/Lista';

interface MaterialPickerProps {
  onSelect: (material: Material) => void;
  placeholder?: string;
  // Opcional: deja fuera de los resultados los materiales que no cumplan (ej. otra unidad de medida).
  filtrar?: (material: Material) => boolean;
}

/**
 * Buscador del maestro de materiales (SKU o descripción), con resultados en
 * vivo. Se usa tanto para agregar un material a una línea como para
 * reemplazar uno existente -- la diferencia entre ambos flujos vive en quien
 * lo embebe (ver MaterialLineaForm), no acá.
 */
export const MaterialPicker: React.FC<MaterialPickerProps> = ({ onSelect, placeholder, filtrar }) => {
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

  const visibles = filtrar ? results.filter(filtrar) : results;

  return (
    <div className="space-y-2">
      <Input
        type="search"
        aria-label="Buscar material"
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
        leftIcon={<Search className="w-3.5 h-3.5" />}
        rightIcon={isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
      />
      {term.trim().length >= 2 && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
          {visibles.length === 0 && !isLoading ? (
            <div className="p-3 text-[11px] text-slate-400 text-center">Sin resultados</div>
          ) : (
            visibles.map((m) => (
              <BotonFila key={m.id} onClick={() => onSelect(m)}>
                <div className="font-mono font-semibold text-[11px] text-slate-900">{m.skuInterno}</div>
                <div className="text-[11px] text-slate-600 leading-tight">{m.descripcion}</div>
                <div className="text-[10px] text-slate-400">{m.tipoProducto?.nombre ?? m.familia}</div>
              </BotonFila>
            ))
          )}
        </div>
      )}
    </div>
  );
};
