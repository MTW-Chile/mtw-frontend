import React from 'react';
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCw, ChevronRight } from 'lucide-react';
import { getProyectoById } from '../../api/client';
import { navegar, useLocationHref, usePuedeVolver } from '../../lib/navigation';

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
 * Migas de pan: "Proyectos › Edificio X". La primera miga vuelve al
 * listado de la seccion. El nombre de la obra sale del mismo cache que usa
 * la pantalla de detalle (['proyectoDetail', id]), no hace un fetch extra.
 */
export const MigasDePan: React.FC<{ seccion: string; titulo: string }> = ({ seccion, titulo }) => {
  const href = useLocationHref();
  const params = new URL(href, window.location.origin).searchParams;
  const proyectoId = params.get('proyecto') || params.get('cotizar');
  const paso = params.get('paso');

  const { data: proyecto } = useQuery({
    queryKey: ['proyectoDetail', proyectoId],
    queryFn: () => getProyectoById(proyectoId!),
    enabled: !!proyectoId,
  });

  return (
    <nav aria-label="Ruta" className="flex items-center gap-1.5 min-w-0 text-sm">
      {proyectoId ? (
        <button
          onClick={() => navegar(`/${seccion}`)}
          className="font-semibold text-slate-500 hover:text-brand-700 transition-colors cursor-pointer shrink-0"
        >
          {titulo}
        </button>
      ) : (
        <span className="font-bold text-slate-900 tracking-tight truncate">{titulo}</span>
      )}
      {proyectoId && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <span className="font-bold text-slate-900 truncate" title={proyecto?.obra}>
            {proyecto?.obra || 'Cargando…'}
          </span>
          {paso && (
            <span className="ml-1 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-semibold text-slate-500 shrink-0">
              Paso {paso}
            </span>
          )}
        </>
      )}
    </nav>
  );
};
