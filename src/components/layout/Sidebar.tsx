import React from 'react';
import {
  Building2,
  Hammer,
  Package,
  FileSpreadsheet,
  X,
  Boxes
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
      color: 'text-cyan-400',
    },
    {
      id: 'taller',
      label: 'Taller & Fabricación',
      icon: Hammer,
      badge: 'Pronto',
      color: 'text-amber-400',
    },
    {
      id: 'materiales',
      label: 'Catálogo de Materiales',
      icon: Package,
      badge: 'Pronto',
      color: 'text-emerald-400',
    },
    {
      id: 'reportes',
      label: 'Reportes & Métricas',
      icon: FileSpreadsheet,
      badge: 'Pronto',
      color: 'text-indigo-400',
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
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-950/95 border-r border-white/10 p-5 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-100 tracking-tight leading-tight">
                  MTW FRONTEND
                </h2>
                <span className="text-[10px] font-mono text-cyan-400 tracking-widest uppercase font-semibold">
                  Alpha V0.1
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1">
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
                        ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.count !== undefined && item.count > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[11px] font-mono font-bold">
                        {item.count}
                      </span>
                    )}

                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[9px] uppercase font-bold tracking-wider">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Relay API</span>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              En línea
            </span>
          </div>
          <div className="text-[10px] text-slate-400 leading-relaxed font-mono">
            Railway PostgreSQL & HETMO Server
          </div>
        </div>
      </aside>
    </>
  );
};
