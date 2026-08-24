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
}> = ({ activeTab, setActiveTab, isOpen, onClose, totalProyectos = 0 }) => {
  const menuItems = [
    {
      id: 'cotizaciones',
      label: 'Cotizaciones & Obras',
      icon: Building2,
      count: totalProyectos,
    },
    {
      id: 'taller',
      label: 'Taller & Fabricación',
      icon: Hammer,
      badge: 'Pronto',
    },
    {
      id: 'materiales',
      label: 'Catálogo de Materiales',
      icon: Package,
      badge: 'Pronto',
    },
    {
      id: 'reportes',
      label: 'Reportes & Métricas',
      icon: FileSpreadsheet,
      badge: 'Pronto',
    },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white border-r border-slate-200 p-5 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <img 
                src="/mtw-logo.png" 
                alt="MTW" 
                className="h-10 w-auto object-contain" 
              />
              <div>
                <h2 className="text-xs font-black tracking-tight uppercase text-slate-900">
                  MTW Frontend
                </h2>
                <span className="text-[10px] font-mono text-[#E34A26] tracking-wider uppercase font-bold">
                  Alpha V0.1
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl lg:hidden text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 text-slate-400">
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
                        ? 'bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 ${isActive ? 'text-[#E34A26]' : 'text-slate-400'}`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.count !== undefined && item.count > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#E34A26]/10 text-[#E34A26]">
                        {item.count}
                      </span>
                    )}

                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider bg-slate-100 text-slate-500">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Relay API</span>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              En línea
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            PostgreSQL Railway · HETMO
          </div>
        </div>
      </aside>
    </>
  );
};
