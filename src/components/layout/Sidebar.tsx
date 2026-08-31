import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Hammer,
  X,
  ShieldCheck,
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
      id: 'inicio',
      label: 'Inicio',
      icon: LayoutDashboard,
    },
    {
      id: 'cotizaciones',
      label: 'Cotizaciones',
      icon: Building2,
      count: totalProyectos,
    },
    {
      id: 'taller',
      label: 'Taller & Fabricación',
      icon: Hammer,
      badge: 'Pronto',
    },
  ];

  return (
    <>
      {/* Backdrop para móviles */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer / Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 max-w-[85vw] bg-white border-r border-slate-200 p-5 flex flex-col justify-between transition-transform duration-250 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          {/* Logo y Encabezado */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <button
              onClick={() => {
                setActiveTab('inicio');
                onClose();
              }}
              className="flex items-center gap-3 group text-left cursor-pointer focus:outline-none"
              title="Ir al Inicio de MTW ERP"
            >
              <img
                src="/mtw-logo.png"
                alt="MTW ERP"
                className="h-9 w-auto object-contain transition-transform group-hover:scale-105"
              />
              <div>
                <h2 className="text-xs font-black tracking-tight uppercase text-slate-900 group-hover:text-[#E34A26] transition-colors">
                  MTW ERP
                </h2>
                <span className="text-[10px] font-mono text-[#E34A26] tracking-wider uppercase font-bold">
                  Alpha V0.2
                </span>
              </div>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl lg:hidden text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navegación */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 text-slate-400">
              Menú Principal
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
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#E34A26]' : 'text-slate-400'
                        }`}
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

        {/* Estado del Sistema en Footer */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Relay API
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              En línea
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono truncate">
            PostgreSQL Railway · MTW
          </div>
        </div>
      </aside>
    </>
  );
};
