import React from 'react';
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCw, ChevronRight } from 'lucide-react';
import { getProyectoById } from '../../api/client';
import { navegar, useLocationHref, usePuedeVolver } from '../../lib/navigation';
import { useMigasActuales, type Miga } from '../../lib/migas';
import { useAnotarReciente } from '../../lib/recientes';
import { usePermisos } from '../../lib/permisos';

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
      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-default transition-colors cursor-pointer shrink-0"
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
      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
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

  // Inicio › "Visitado recientemente": esta misma ruta, al asentarse.
  const { datos } = usePermisos();
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  useAnotarReciente(datos?.email, {
    href: base && href.startsWith(base) ? href.slice(base.length) || '/' : href,
    seccion,
    ruta: migas.slice(1).map((m) => m.label),
    codigo: migas.find((m) => m.codigo)?.codigo,
  });

  const anteriores = migas.slice(0, -1);
  const actual = migas[migas.length - 1];
  // En dos líneas, con tres niveles o más, la sección (ya marcada en el menú)
  // cede su lugar: así el nombre de la obra no se aprieta hasta desaparecer.
  const compactas = anteriores.length > 2 ? anteriores.slice(1) : anteriores;
  const codigo = (m: Miga, clase = '') =>
    m.codigo && (
      <span className={`shrink-0 text-[10px] px-1.5 py-px rounded-full bg-slate-100 border border-slate-200 font-mono font-bold text-slate-600 ${clase}`} title="Código">
        {m.codigo}
      </span>
    );
  const anterior = (m: Miga, clase: string) =>
    m.alHacerClic ? (
      <button onClick={m.alHacerClic} className={`${clase} hover:text-brand-700 transition-colors cursor-pointer truncate`} title={m.label}>
        {m.label}
      </button>
    ) : (
      <span className={`${clase} truncate`} title={m.label}>
        {m.label}
      </span>
    );

  // Dos formas según el ancho del Header (un @container): con espacio, una
  // sola línea "Sección › Obra [código] › Pestaña"; sin espacio (tablet con
  // el menú lateral, móvil), dos líneas: la ruta en chico arriba y la
  // pantalla actual en negrita abajo, cada una recortada sin desarmarse.
  return (
    <nav aria-label="Ruta" className="min-w-0">
      <div className="hidden @5xl:flex items-center gap-1.5 min-w-0 text-sm">
        {anteriores.map((m, i) => (
          <React.Fragment key={`${i}-${m.label}`}>
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
            <span className="flex items-center gap-1.5 min-w-0 max-w-[16rem]">
              {anterior(m, 'font-semibold text-slate-500 min-w-0')}
              {codigo(m)}
            </span>
          </React.Fragment>
        ))}
        {anteriores.length > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
        <span className="flex items-center gap-1.5 min-w-0 shrink-0 max-w-[24rem]">
          <span className="font-bold text-slate-900 truncate" title={actual.label}>
            {actual.label}
          </span>
          {codigo(actual)}
        </span>
      </div>
      <div className="flex @5xl:hidden flex-col min-w-0 leading-tight">
        {compactas.length > 0 && (
          <div className="flex items-center gap-1 min-w-0 text-[11px] text-slate-500">
            {compactas.map((m, i) => (
              <React.Fragment key={`${i}-${m.label}`}>
                {i > 0 && <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />}
                <span className={`flex items-center gap-1 min-w-0 ${i === compactas.length - 1 ? '' : 'shrink-[3]'}`}>
                  {anterior(m, 'font-semibold min-w-0')}
                  {codigo(m, 'hidden min-[380px]:inline-flex')}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-bold text-slate-900 truncate" title={actual.label}>
            {actual.label}
          </span>
          {codigo(actual)}
        </div>
      </div>
    </nav>
  );
};
