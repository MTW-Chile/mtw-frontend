import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache, useQuery } from '@tanstack/react-query';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { InicioPage } from './modules/inicio/InicioPage';
import { CotizacionesPage } from './modules/cotizaciones/CotizacionesPage';
import { MaestroPage } from './modules/cotizaciones/MaestroPage';
import { ClientesPage } from './modules/clientes/ClientesPage';
import { ConfiguracionPage } from './modules/configuracion/ConfiguracionPage';
import { ProyectosPage } from './modules/proyectos/ProyectosPage';
import { ComprasPage } from './modules/abastecimiento/ComprasPage';
import { BodegaPage } from './modules/abastecimiento/BodegaPage';
import { CentroNotificacionesPage } from './modules/notificaciones/CentroNotificacionesPage';
import { getProyectos, getMisPermisos } from './api/client';
import { useCloudflareAccessSession, SessionContext } from './lib/useCloudflareAccessSession';
import { SECCIONES_FRONTEND } from './lib/accessControl';
import { mostrarToast, extraerErrorParaToast } from './lib/toast';

// Tab especial, fuera de SECCIONES_FRONTEND a proposito (no va en el
// Sidebar -- solo se llega ahi desde la campanita del Header o el link de
// un correo de aprobacion pendiente, ver puedeVerCentro mas abajo).
const TAB_CENTRO_NOTIFICACIONES = 'centro-notificaciones';

// Debug global: CUALQUIER query o mutation que falle en cualquier parte de
// la app dispara un toast (ver ToastContainer, montado en main.tsx) --
// ademas del manejo de error puntual que ya tenga esa pantalla, no en vez
// de. No reemplaza el interceptor de axios en api/client.ts (ese cubre un
// caso distinto: sesion de Cloudflare Access vencida, sin response HTTP --
// ahi la promesa nunca llega a rechazarse, asi que esto nunca se dispara
// para ese caso).
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const { mensaje, detalle } = extraerErrorParaToast(error);
      // El toast desaparece solo a los 10s -- esto es lo que queda
      // despues, buscable en la consola del navegador (F12) mientras dure
      // la pestaña abierta.
      console.error('[queryCache]', query.queryKey, error);
      mostrarToast(mensaje, { detalle });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const { mensaje, detalle } = extraerErrorParaToast(error);
      console.error('[mutationCache]', mutation.options.mutationKey, error);
      mostrarToast(mensaje, { detalle });
    },
  }),
  defaultOptions: {
    queries: {
      // Antes: 5 min sin refetch al volver a la pestaña -- la info se veia
      // desactualizada por minutos con varias personas usando la app a la
      // vez. Se probo con 60s de intervalo, pero con varias pestañas
      // abiertas (cada una poleando sola, sin compartir el intervalo) el
      // volumen de fondo llegaba a pisar el limite de 300 req/15min por
      // usuario de apiRateLimiter (ver mtw-api/src/security.ts) -- 429
      // "Demasiadas peticiones" en uso normal, y paginas que no muestran el
      // error de su query (ej. ProyectosPage) se veian con datos
      // vacios/viejos sin avisar. 3 min deja un refresco igual mucho mas
      // seguido que antes, con bastante margen contra ese limite. Una
      // pantalla puntual puede pisar cualquiera de estos tres pasando sus
      // propias opciones a useQuery.
      staleTime: 1000 * 60 * 3,
      refetchInterval: 1000 * 60 * 3,
      refetchOnWindowFocus: true,
    },
  },
});

import { ScrollToTop } from './components/ui/ScrollToTop';

// Generado desde SECCIONES_FRONTEND (lib/accessControl.ts) -- una seccion
// nueva agrega su titulo de pestaña del navegador sola, sin tocar este archivo.
const MODULE_TITLES: Record<string, string> = {
  ...Object.fromEntries(SECCIONES_FRONTEND.map((s) => [s.id, s.label])),
  [TAB_CENTRO_NOTIFICACIONES]: 'Centro de Notificaciones',
};

const AppContent: React.FC = () => {
  const [activeTab, setActiveTabState] = useState('inicio');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // Deep-link hacia una cotizacion puntual (aprobacion gerencial pendiente)
  // -- CotizacionesPage lo consume, abre el Cotizador en el Paso 5
  // (Consolidación) y avisa por onProyectoAbierto para que no se reabra solo.
  const [cotizacionAAbrir, setCotizacionAAbrir] = useState<string | null>(null);

  const { data: permisos, isLoading: cargandoPermisos } = useQuery({
    queryKey: ['misPermisos'],
    queryFn: getMisPermisos,
  });

  // null = administrador, ve todo sin filtrar.
  const seccionesPermitidas = permisos ? (permisos.esAdmin ? null : permisos.secciones) : [];
  // El Centro de Notificaciones no es una seccion real (no vive en
  // SECCIONES_FRONTEND/Sidebar) -- su acceso depende de poder aprobar
  // gerencial, no de secciones habilitadas.
  const puedeVerCentroNotificaciones = !!permisos && (permisos.esAdmin || permisos.aprobaciones.includes('gerencial'));
  const puedeVer = (id: string) =>
    id === TAB_CENTRO_NOTIFICACIONES
      ? puedeVerCentroNotificaciones
      : seccionesPermitidas === null || seccionesPermitidas.includes(id);

  // Si el usuario no tiene acceso a la pestaña activa (recien resueltos
  // los permisos, o un rol le quito acceso a lo que estaba viendo), cae a
  // la primera seccion permitida en vez de mostrar una pantalla vacia.
  useEffect(() => {
    if (!permisos || puedeVer(activeTab)) return;
    const primeraPermitida = SECCIONES_FRONTEND.find((s) => puedeVer(s.id));
    setActiveTabState(primeraPermitida?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permisos, activeTab]);

  // Título dinámico del navegador según el módulo activo
  useEffect(() => {
    const title = MODULE_TITLES[activeTab] || 'Inicio';
    document.title = `MTW ERP - ${title}`;
  }, [activeTab]);

  const { data } = useQuery({
    queryKey: ['proyectosCount'],
    queryFn: () => getProyectos({ limit: 1 }),
    enabled: puedeVer('cotizaciones'),
  });

  // Mismo queryKey que ProyectosPage (['proyectos', 'en-curso']) para
  // compartir el cache -- el badge del Sidebar no dispara un fetch extra.
  const { data: proyectosEnCursoData } = useQuery({
    queryKey: ['proyectos', 'en-curso'],
    queryFn: () => getProyectos({ limit: 200 }),
    enabled: puedeVer('proyectos'),
  });
  const totalProyectosEnCurso = (proyectosEnCursoData?.data || []).filter(
    (p) => p.versiones[0]?.estadoAprobacion === 'ACEPTADO_CLIENTE'
  ).length;

  const handleNavigate = (tab: string, query?: string) => {
    setActiveTabState(tab);
    if (query !== undefined) {
      setSearchTerm(query);
    }
  };

  const abrirCotizacion = (proyectoId: string) => {
    setActiveTabState('cotizaciones');
    setCotizacionAAbrir(proyectoId);
  };

  // Deep-link desde el link "Ver Centro de Notificaciones" de los correos
  // de aprobacion pendiente (?abrir=centro, ver
  // notificarAprobacionGerencialPendiente en mtw-api) -- tambien soporta
  // ?abrir=cotizacion:<obra> / ?abrir=oc:<proyectoId> para ir directo a un
  // item puntual (usado por la campanita del Header). Se consume una sola
  // vez al cargar la app y se limpia de la URL para que un refresh no
  // vuelva a navegar solo.
  useEffect(() => {
    const abrir = new URLSearchParams(window.location.search).get('abrir');
    if (!abrir) return;
    if (abrir === 'centro') {
      handleNavigate(TAB_CENTRO_NOTIFICACIONES);
    } else {
      const [tipo, valor] = abrir.split(/:(.*)/s);
      if (tipo === 'cotizacion' && valor) {
        abrirCotizacion(valor);
      } else if (tipo === 'oc') {
        // Aprobar/enviar una OC es trabajo del módulo Compras, no de un
        // proyecto puntual -- ver modoRestringido en OrdenesCompraList.
        handleNavigate('compras');
      }
    }
    window.history.replaceState({}, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cargandoPermisos) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Verificando permisos...
      </div>
    );
  }

  if (seccionesPermitidas !== null && seccionesPermitidas.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
        <div className="max-w-sm text-center space-y-2">
          <h1 className="text-sm font-black text-slate-900">Sin acceso asignado</h1>
          <p className="text-xs text-slate-500">
            Tu cuenta ({permisos?.email}) todavía no tiene un rol asignado en MTW ERP. Pídele a un administrador que
            te asigne uno en Configuración &gt; Roles de Usuario.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex bg-slate-50 text-slate-900 font-sans">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleNavigate}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        totalProyectos={data?.total}
        totalProyectosEnCurso={totalProyectosEnCurso}
        seccionesPermitidas={seccionesPermitidas}
        usuarioActual={permisos && { nombre: permisos.nombre, email: permisos.email, rol: permisos.rol }}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onNavigateHome={() => handleNavigate('inicio')}
          onNavigateConfig={() => handleNavigate('configuracion')}
          moduleTitle={MODULE_TITLES[activeTab] || 'Inicio'}
          onNavigate={handleNavigate}
          onAbrirCotizacion={abrirCotizacion}
        />

        <main className="flex-1 overflow-y-auto flex flex-col min-h-0">
          {activeTab === 'inicio' && (
            <InicioPage onNavigate={handleNavigate} />
          )}

          {activeTab === 'maestro' && <MaestroPage />}

          {activeTab === 'clientes' && <ClientesPage />}

          {activeTab === 'cotizaciones' && (
            <CotizacionesPage
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              proyectoAAbrir={cotizacionAAbrir}
              onProyectoAbierto={() => setCotizacionAAbrir(null)}
            />
          )}

          {activeTab === 'proyectos' && (
            <ProyectosPage />
          )}

          {activeTab === 'compras' && <ComprasPage />}

          {activeTab === 'bodega' && <BodegaPage />}

          {activeTab === 'configuracion' && (
            <ConfiguracionPage tabsPermitidas={permisos?.esAdmin ? null : permisos?.configTabs ?? []} />
          )}

          {activeTab === TAB_CENTRO_NOTIFICACIONES && (
            <CentroNotificacionesPage onAbrirCompras={() => handleNavigate('compras')} onAbrirCotizacion={abrirCotizacion} />
          )}
        </main>
      </div>

      <ScrollToTop />
    </div>
  );
};

const SessionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = useCloudflareAccessSession();

  if (session.state !== 'ready') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        {session.state === 'redirecting' ? 'Redirigiendo a login...' : 'Verificando sesión...'}
      </div>
    );
  }

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionGate>
        <AppContent />
      </SessionGate>
    </QueryClientProvider>
  );
};

export default App;
