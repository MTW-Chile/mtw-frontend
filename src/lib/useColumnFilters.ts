import { useMemo, useState } from 'react';

// Filtro de texto (substring, case-insensitive) o de opciones fijas
// (select, match exacto) sobre una columna puntual. `accessor` saca el
// valor comparable de la fila -- normalmente el mismo texto que ya se
// renderiza en esa celda.
export type ColumnFilterDef<T> =
  | { key: string; tipo: 'texto'; label: string; accessor: (row: T) => string }
  | { key: string; tipo: 'select'; label: string; accessor: (row: T) => string; opciones: { value: string; label: string }[] };

// Filtro por columna generico, mismo criterio en toda la app (ver
// designSystem.ts): un input/select chico en el header de cada columna
// filtrable, AND entre columnas activas, todo en memoria sobre `data` ya
// cargado (mismo enfoque que ya usaban los filtros globales de
// busqueda/estado existentes, solo que por columna en vez de uno global).
export function useColumnFilters<T>(data: T[], columnas: ColumnFilterDef<T>[]) {
  const [valores, setValores] = useState<Record<string, string>>({});

  const setValor = (key: string, valor: string) => setValores((prev) => ({ ...prev, [key]: valor }));
  const limpiar = () => setValores({});

  const datosFiltrados = useMemo(() => {
    const activos = columnas.filter((c) => valores[c.key]);
    if (activos.length === 0) return data;
    return data.filter((row) =>
      activos.every((c) => {
        const valorFiltro = valores[c.key].toLowerCase();
        const valorFila = c.accessor(row).toLowerCase();
        return c.tipo === 'select' ? valorFila === valorFiltro : valorFila.includes(valorFiltro);
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, valores]);

  const hayFiltrosActivos = Object.values(valores).some(Boolean);

  return { valores, setValor, limpiar, datosFiltrados, hayFiltrosActivos };
}
