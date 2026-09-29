import React from 'react';
import type { ColumnFilterDef } from '../../lib/useColumnFilters';

interface ColumnFilterHeaderProps<T> {
  columna: ColumnFilterDef<T>;
  valor: string;
  onChange: (valor: string) => void;
}

// Celda de filtro por columna -- va en una segunda fila de <th> debajo de
// los labels del header, mismo tratamiento visual en cualquier tabla que
// lo use (ver useColumnFilters.ts / criterio en designSystem.ts).
export function ColumnFilterHeader<T>({ columna, valor, onChange }: ColumnFilterHeaderProps<T>) {
  if (columna.tipo === 'select') {
    return (
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-[10px] font-semibold normal-case bg-white border border-slate-200 rounded-md px-1.5 py-1 outline-none focus:border-[#E34A26] text-slate-600 cursor-pointer"
      >
        <option value="">Todas</option>
        {columna.opciones.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type="text"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Filtrar..."
      className="w-full text-[10px] font-normal normal-case bg-white border border-slate-200 rounded-md px-1.5 py-1 outline-none focus:border-[#E34A26] text-slate-700 placeholder:text-slate-300"
    />
  );
}
