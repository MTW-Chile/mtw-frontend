import React from 'react';
import {
  Building2,
  Hammer,
  Package,
  FileSpreadsheet,
  X
} from 'lucide-react';

export const Sidebar: React.FC<{
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  totalProyectos?: number;
  isDarkMode?: boolean;
}> = ({ activeTab, setActiveTab, isOpen, onClose, totalProyectos = 0, isDarkMode = true }) => {
  const menuItems = [
    {
      id: 'cotizaciones',
      label: 'Cotizaciones & Obras',
      icon: Building2,
      count: totalProyectos,
      color: 'text-[#E34A26]',
    },
    {
      id: 'taller',
      label: 'Taller & Fabricación',
      icon: Hammer,
      badge: 'Pronto',
      color: 'text-amber-500',
    },
    {
      id: 'materiales',
      label: 'Catálogo de Materiales',
      icon: Package,
      badge: 'Pronto',
      color: 'text-emerald-500',
    },
    {
      id: 'reportes',
      label: 'Reportes & Métricas',
      icon: FileSpreadsheet,
      badge: 'Pronto',
      color: 'text-indigo-500',
    },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 p-5 flex flex-col justify-between transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isDarkMode 
            ? 'bg-slate-950 border-r border-white/10 text-slate-100' 
            : 'bg-white border-r border-slate-200 text-slate-900 shadow-sm'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="space-y-6">
          {/* Logo & Marca Oficial MTW */}
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-3">
              <img 
                src="/mtw-logo.png" 
                alt="MTW - More Than Windows" 
                className={`h-9 w-auto object-contain ${!isDarkMode ? '' : 'brightness-110'}`} 
              />
              <div>
                <h2 className={`text-xs font-bold tracking-tight uppercase ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  MTW Frontend
                </h2>
                <span className="text-[10px] font-mono text-[#E34A26] tracking-widest uppercase font-semibold">
                  Alpha V0.1
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-xl lg:hidden ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Módulos Principales
            </div>
            <nav className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? isDarkMode
                          ? 'bg-[#E34A26]/15 text-[#FF6B4A] border border-[#E34A26]/30 shadow-sm'
                          : 'bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 font-bold'
                        : isDarkMode
                          ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 ${isActive ? 'text-[#E34A26]' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.count !== undefined && item.count > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                        isDarkMode ? 'bg-[#E34A26]/20 text-[#FF6B4A]' : 'bg-[#E34A26]/10 text-[#E34A26]'
                      }`}>
                        {item.count}
                      </span>
                    )}

                    {item.badge && (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${
                        isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border space-y-1.5 ${
          isDarkMode ? 'bg-slate-900/60 border-white/5' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-xs">
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Relay API</span>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-500 font-mono font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              En línea
            </span>
          </div>
          <div className={`text-[10px] leading-relaxed font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Railway PostgreSQL & HETMO Server
          </div>
        </div>
      </aside>
    </>
  );
};
