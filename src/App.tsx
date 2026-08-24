import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { CotizacionesPage } from './modules/cotizaciones/CotizacionesPage';
import { useQuery } from '@tanstack/react-query';
import { getProyectos } from './api/client';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('cotizaciones');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
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
    <div className={`min-h-screen flex ${isDarkMode ? 'bg-[#080C14] text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
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
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        />

        <main className="flex-1 overflow-y-auto">
          {activeTab === 'cotizaciones' && (
            <CotizacionesPage searchTerm={searchTerm} />
          )}

          {activeTab !== 'cotizaciones' && (
            <div className="p-12 text-center text-slate-400 text-sm">
              Módulo en construcción para próximas etapas.
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
