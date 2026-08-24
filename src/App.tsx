import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { CotizacionesPage } from './modules/cotizaciones/CotizacionesPage';
import { getProyectos } from './api/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('cotizaciones');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { data } = useQuery({
    queryKey: ['proyectosCount'],
    queryFn: () => getProyectos({ limit: 1 }),
  });

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
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        <main className="flex-1 overflow-y-auto">
          {activeTab === 'cotizaciones' && (
            <CotizacionesPage searchTerm={searchTerm} />
          )}

          {activeTab !== 'cotizaciones' && (
            <div className="p-12 text-center text-slate-500 text-sm">
              Módulo en construcción para próximas etapas.
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
};

export default App;
