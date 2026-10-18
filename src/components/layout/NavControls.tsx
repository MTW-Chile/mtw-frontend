import React from 'react';
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCw, ChevronRight } from 'lucide-react';
import { getProyectoById } from '../../api/client';
import { navegar, useLocationHref, usePuedeVolver } from '../../lib/navigation';
import { useMigasActuales, type Miga } from '../../lib/migas';

// Controles de navegacion "dentro de la app" del Header -- la app es una
// sola pagina, asi que F5 recarga TODO (permisos, sesion, listados) solo
// para ver un dato actualizado, y el boton Atras del navegador antes salia
// del sitio. Ver lib/navigation.ts.

/** Atras: vuelve a la pantalla anterior de la app (deshabilitado si saldria del sitio). */
export const BotonAtras: React.FC = () => {
  const puedeVolver = usePuedeVolver();
  return (
    <button
      onClick={() => window.history.back()}
      disabled={!puedeVolver}
      className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-default transition-colors cursor-pointer shrink-0"
      aria-label="Volver a la pantalla anterior"
      title="Volver a la pantalla anterior (Alt + ←)"
    >
      <ArrowLeft className="w-4 h-4" />
    </button>
  );
};

/**
 * Recargar datos: vuelve a pedir al backend todo lo que esta en pantalla
 * (y marca como viejo el resto), sin recargar la pagina ni perder lo que
 * haya escrito en un formulario. Gira mientras haya cualquier peticion en
 * curso, asi tambien sirve de indicador de "actualizando...".
 */
export const BotonRecargar: React.FC = () => {
  const queryClient = useQueryClient();
  const cargando = useIsFetching() > 0;
  return (
    <button
      onClick={() => queryClient.invalidateQueries()}
      className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
      aria-label="Actualizar datos"
      title={cargando ? 'Actualizando datos…' : 'Actualizar datos de esta pantalla'}
    >
      <RotateCw className={`w-4 h-4 ${cargando ? 'animate-spin text-brand-600' : ''}`} />
    </button>
  );
};

/**
 * Migas de pan: "Sección › nivel › nivel". La sección la da el Sidebar; la
 * obra abierta sale del mismo cache que usa su pantalla (['proyectoDetail',
 * id]); el resto lo declara cada pantalla con useMigas (lib/migas.ts). Cada
 * miga con destino vuelve a ese nivel; la última es la pantalla actual.
 */
export const MigasDePan: React.FC<{ seccion: string; titulo: string }> = ({ seccion, titulo }) => {
  const href = useLocationHref();
  const params = new URL(href, window.location.origin).searchParams;
  const proyectoId = params.get('proyecto') || params.get('cotizar');
  const extra = useMigasActuales();

  const { data: proyecto } = useQuery({
    queryKey: ['proyectoDetail', proyectoId],
    queryFn: () => getProyectoById(proyectoId!),
    enabled: !!proyectoId,
  });

  const migas: Miga[] = [
    { label: titulo, alHacerClic: () => navegar(`/${seccion}`) },
    ...(proyectoId ? [{ label: proyecto?.obra || 'Cargando…', codigo: proyecto ? proyecto.codigoInterno || `PRJ-${proyecto.numeroPresupuesto}` : undefined }] : []),
    ...extra,
  ];

  return (
    <nav aria-label="Ruta" className="flex items-center gap-1.5 min-w-0 text-sm">
      {migas.map((m, i) => {
        const ultima = i === migas.length - 1;
        return (
          <React.Fragment key={`${i}-${m.label}`}>
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
            {ultima || !m.alHacerClic ? (
              <span className={`truncate ${ultima ? 'font-bold text-slate-900' : 'font-semibold text-slate-500'}`} title={m.label}>
                {m.label}
              </span>
            ) : (
              <button onClick={m.alHacerClic} className="font-semibold text-slate-500 hover:text-brand-700 transition-colors cursor-pointer truncate max-w-[16rem]" title={m.label}>
                {m.label}
              </button>
            )}
            {m.codigo && (
              <span className="hidden sm:inline-flex shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-mono font-bold text-slate-600" title="Código">
                {m.codigo}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
