import type { LucideIcon } from 'lucide-react';

export interface ItemNav<T extends string> {
  id: T;
  label: string;
  icono?: LucideIcon;
  descripcion?: string;
}

export interface GrupoNav<T extends string> {
  titulo: string;
  items: ItemNav<T>[];
}

/**
 * Navegación lateral agrupada para páginas con muchas secciones (ej.
 * Configuración). En escritorio es una columna a la izquierda; en móvil, un
 * selector arriba (nunca una fila de pestañas que desborda).
 */
export function NavLateral<T extends string>({ grupos, activo, onChange }: { grupos: GrupoNav<T>[]; activo: T | undefined; onChange: (id: T) => void }) {
  return (
    <>
      <select
        aria-label="Sección"
        value={activo}
        onChange={(e) => onChange(e.target.value as T)}
        className="md:hidden w-full py-2.5 px-3.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand-600"
      >
        {grupos.map((g) => (
          <optgroup key={g.titulo} label={g.titulo}>
            {g.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <nav aria-label="Secciones" className="hidden md:block w-56 shrink-0 space-y-5">
        {grupos.map((g) => (
          <div key={g.titulo} className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{g.titulo}</p>
            {g.items.map(({ id, label, icono: Icono, descripcion }) => {
              const sel = id === activo;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChange(id)}
                  aria-current={sel ? 'page' : undefined}
                  title={descripcion}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                    sel ? 'bg-brand-600/10 text-brand-700 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold'
                  }`}
                >
                  {Icono && <Icono className={`w-4 h-4 shrink-0 ${sel ? 'text-brand-600' : 'text-slate-400'}`} />}
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}
