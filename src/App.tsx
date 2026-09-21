import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { InicioPage } from './modules/inicio/InicioPage';
import { CotizacionesPage } from './modules/cotizaciones/CotizacionesPage';
import { MaestroPage } from './modules/cotizaciones/MaestroPage';
import { ConfiguracionPage } from './modules/configuracion/ConfiguracionPage';
import { ProyectosPage } from './modules/proyectos/ProyectosPage';
import { getProyectos, getMisPermisos } from './api/client';
import { useCloudflareAccessSession, SessionContext } from './lib/useCloudflareAccessSession';
import { SECCIONES_FRONTEND } from './lib/accessControl';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

import { ScrollToTop } from './components/ui/ScrollToTop';

// Generado desde SECCIONES_FRONTEND (lib/accessControl.ts) -- una seccion
// nueva agrega su titulo de pestaña del navegador sola, sin tocar este archivo.
const MODULE_TITLES: Record<string, string> = Object.fromEntries(
  SECCIONES_FRONTEND.map((s) => [s.id, s.label])
);

const AppContent: React.FC = () => {
  const [activeTab, setActiveTabState] = useState('inicio');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // Deep-link desde la campanita de notificaciones (Header) hacia un
  // proyecto puntual (ej. una OC pendiente de aprobación) -- ProyectosPage
  // lo consume y avisa por onProyectoAbierto para que no se reabra solo.
  const [proyectoAAbrir, setProyectoAAbrir] = useState<{ id: string; seccion?: string } | null>(null);

  const { data: permisos, isLoading: cargandoPermisos } = useQuery({
    queryKey: ['misPermisos'],
    queryFn: getMisPermisos,
  });

  // null = administrador, ve todo sin filtrar.
  const seccionesPermitidas = permisos ? (permisos.esAdmin ? null : permisos.secciones) : [];
  const puedeVer = (id: string) => seccionesPermitidas === null || seccionesPermitidas.includes(id);

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

  const handleNavigate = (tab: string, query?: string) => {
    setActiveTabState(tab);
    if (query !== undefined) {
      setSearchTerm(query);
    }
  };

  const abrirProyecto = (proyectoId: string, seccion?: string) => {
    setActiveTabState('proyectos');
    setProyectoAAbrir({ id: proyectoId, seccion });
  };

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
          onAbrirProyecto={abrirProyecto}
        />

        <main className="flex-1 overflow-y-auto flex flex-col min-h-0">
          {activeTab === 'inicio' && (
            <InicioPage onNavigate={handleNavigate} />
          )}

          {activeTab === 'maestro' && <MaestroPage />}

          {activeTab === 'cotizaciones' && (
            <CotizacionesPage
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          )}

          {activeTab === 'proyectos' && (
            <ProyectosPage proyectoAAbrir={proyectoAAbrir} onProyectoAbierto={() => setProyectoAAbrir(null)} />
          )}

          {activeTab === 'configuracion' && (
            <ConfiguracionPage tabsPermitidas={permisos?.esAdmin ? null : permisos?.configTabs ?? []} />
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
