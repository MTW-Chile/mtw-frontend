import React from 'react';
import { 
  Building2, 
  Layers, 
  Hammer, 
  Package, 
  FileSpreadsheet, 
  Sparkles
} from 'lucide-react';

export const Sidebar: React.FC<{
  activeTab: string;
  onTabChange: (tab: string) => void;
}> = ({ activeTab, onTabChange }) => {
  const menuItems = [
    { id: 'cotizaciones', label: 'Cotizaciones & Obras', icon: Building2, count: '52' },
    { id: 'taller', label: 'Taller & Fabricación', icon: Hammer, count: 'Pronto' },
    { id: 'materiales', label: 'Catálogo de Materiales', icon: Package, count: 'Pronto' },
    { id: 'reportes', label: 'Reportes & Métricas', icon: FileSpreadsheet, count: 'Pronto' },
  ];

  return (
    <aside className="w-64 border-r border-white/[0.08] bg-[#080C14] flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div>
        <div className="h-16 px-6 flex items-center gap-3 border-b border-white/[0.08]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold tracking-wider text-sm bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              MTW STUDIO
            </div>
            <div className="text-[10px] text-cyan-400/80 font-mono font-medium tracking-widest uppercase">
              HETMO CORE V2
            </div>
          </div>
        </div>

        <div className="p-4 space-y-1.5">
          <div className="px-3 pb-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
            Módulos Principales
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.count && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-cyan-400/20 text-cyan-300 font-semibold'
                        : 'bg-slate-800/80 text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-white/[0.08] bg-slate-950/40">
        <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-[11px] font-semibold text-slate-200">PostgreSQL Core</div>
              <div className="text-[9px] text-slate-500 font-mono">52 Obras Indexadas</div>
            </div>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
        </div>
      </div>
    </aside>
  );
};