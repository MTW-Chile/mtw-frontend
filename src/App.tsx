import React, { useState, useEffect } from 'react';
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
  
  // Modo Claro por defecto con persistencia en localStorage
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('mtw_theme');
    return saved ? saved === 'dark' : false;
  });

  useEffect(() => {
    localStorage.setItem('mtw_theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const { data } = useQuery({
    queryKey: ['proyectosCount'],
    queryFn: () => getProyectos({ limit: 1 }),
  });

  return (
    <div className={`min-h-screen flex transition-colors duration-200 ${isDarkMode ? 'bg-[#080C14] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        totalProyectos={data?.total}
        isDarkMode={isDarkMode}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        />

        <main className="flex-1 overflow-y-auto">
          {activeTab === 'cotizaciones' && (
            <CotizacionesPage searchTerm={searchTerm} isDarkMode={isDarkMode} />
          )}

          {activeTab !== 'cotizaciones' && (
            <div className={`p-12 text-center text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
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
