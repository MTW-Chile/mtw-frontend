import React from 'react';
import { Loader2, Search, X } from 'lucide-react';

/**
 * Campo de búsqueda (DESIGN.md 5): lupa, botón para limpiar y, si busca en el
 * servidor, indicador de carga.
 */
export const Buscador: React.FC<{
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Nombre accesible (por defecto el placeholder). */
  etiqueta?: string;
  cargando?: boolean;
  autoFocus?: boolean;
  compacto?: boolean;
  className?: string;
}> = ({ valor, onChange, placeholder = 'Buscar…', etiqueta, cargando, autoFocus, compacto, className = '' }) => (
  <div className={`relative ${className}`}>
    <Search className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${compacto ? 'left-2.5 w-3.5 h-3.5' : 'left-3.5 w-4 h-4'}`} />
    <input
      type="search"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={etiqueta ?? placeholder}
      autoFocus={autoFocus}
      className={`w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 transition-colors [&::-webkit-search-cancel-button]:hidden ${
        compacto ? 'pl-8 pr-8 py-1.5 rounded-lg text-xs' : 'pl-10 pr-9 py-2.5 rounded-xl text-xs'
      }`}
    />
    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
      {cargando ? (
        <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
      ) : (
        valor && (
          <button type="button" onClick={() => onChange('')} aria-label="Limpiar búsqueda" className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        )
      )}
    </span>
  </div>
);
