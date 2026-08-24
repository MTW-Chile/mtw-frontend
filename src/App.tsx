import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { CotizacionesPage } from './modules/cotizaciones/CotizacionesPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  const [activeTab, setActiveTab] = useState('cotizaciones');
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen bg-[#080C14] text-slate-100">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <main className="flex-1 overflow-y-auto">
            {activeTab === 'cotizaciones' && (
              <CotizacionesPage searchTerm={searchTerm} />
            )}
            {activeTab !== 'cotizaciones' && (
              <div className="p-12 text-center text-slate-500 text-sm">
                Módulo en desarrollo (Fase siguiente).
              </div>
            )}
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default App;