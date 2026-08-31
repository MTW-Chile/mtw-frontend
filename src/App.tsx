import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { InicioPage } from './modules/inicio/InicioPage';
import { CotizacionesPage } from './modules/cotizaciones/CotizacionesPage';
import { getProyectos } from './api/client';
import { useCloudflareAccessSession, SessionContext } from './lib/useCloudflareAccessSession';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const MODULE_TITLES: Record<string, string> = {
  inicio: 'Inicio',
  cotizaciones: 'Cotizaciones',
  taller: 'Taller & Fabricación',
};

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('inicio');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Título dinámico del navegador según el módulo activo
  useEffect(() => {
    const title = MODULE_TITLES[activeTab] || 'Inicio';
    document.title = `MTW ERP - ${title}`;
  }, [activeTab]);

  const { data } = useQuery({
    queryKey: ['proyectosCount'],
    queryFn: () => getProyectos({ limit: 1 }),
  });

  const handleNavigate = (tab: string, query?: string) => {
    setActiveTab(tab);
    if (query !== undefined) {
      setSearchTerm(query);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        totalProyectos={data?.total}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onNavigateHome={() => handleNavigate('inicio')}
          moduleTitle={MODULE_TITLES[activeTab] || 'Inicio'}
        />

        <main className="flex-1 overflow-y-auto">
          {activeTab === 'inicio' && (
            <InicioPage onNavigate={handleNavigate} />
          )}

          {activeTab === 'cotizaciones' && (
            <CotizacionesPage
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          )}

          {activeTab === 'taller' && (
            <div className="p-8 sm:p-16 text-center space-y-3 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500 font-bold">
                🛠️
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Módulo de Taller & Fabricación
              </h3>
              <p className="text-xs text-slate-500">
                Este módulo estará disponible en las próximas etapas para la gestión de corte, ensamble y despacho.
              </p>
            </div>
          )}
        </main>
      </div>
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
