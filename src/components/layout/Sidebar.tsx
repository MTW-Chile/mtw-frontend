import React from 'react';
import { X, User } from 'lucide-react';
import { SECCIONES_FRONTEND } from '../../lib/accessControl';
import { displayName } from '../../lib/useCloudflareAccessSession';

interface UsuarioSidebar {
  nombre: string | null;
  email: string;
  rol: string | null;
}

export const Sidebar: React.FC<{
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  totalProyectos?: number;
  totalProyectosEnCurso?: number;
  // null = administrador, ve todas las secciones sin filtrar.
  seccionesPermitidas: string[] | null;
  usuarioActual?: UsuarioSidebar;
}> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
  totalProyectos = 0,
  totalProyectosEnCurso = 0,
  seccionesPermitidas,
  usuarioActual,
}) => {
  const menuItems = SECCIONES_FRONTEND.filter(
    (s) => seccionesPermitidas === null || seccionesPermitidas.includes(s.id)
  ).map((s) => ({
    ...s,
    count: s.id === 'cotizaciones' ? totalProyectos : s.id === 'proyectos' ? totalProyectosEnCurso : undefined,
  }));

  return (
    <>
      {/* Backdrop para móviles */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-950/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer / Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 max-w-[85vw] bg-ink-900 text-slate-300 px-3.5 py-4 flex flex-col justify-between transition-transform duration-250 ease-in-out lg:static lg:h-screen lg:shrink-0 lg:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          {/* Logo y Encabezado */}
          <div className="flex items-center justify-between px-1.5 pb-4 border-b border-white/8">
            <button
              onClick={() => {
                setActiveTab('inicio');
                onClose();
              }}
              className="flex items-center gap-3 group text-left cursor-pointer focus:outline-none"
              title="Ir al Inicio de MTW ERP"
            >
              <img
                src="/mtw-logo-light.png"
                alt="MTW ERP"
                className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
              />
              <div>
                <h2 className="text-xs font-black tracking-tight uppercase text-white">
                  MTW ERP
                </h2>
                <span className="text-[10px] font-mono text-brand-300 tracking-wider uppercase font-medium">
                  Alpha V1
                </span>
              </div>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl lg:hidden text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navegación */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] px-3 py-1 text-slate-500">
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
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-white/10 text-white font-semibold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r before:bg-brand-400'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-brand-300' : 'text-slate-500'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.count !== undefined && item.count > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono font-semibold ${isActive ? 'bg-brand-400/20 text-brand-100' : 'bg-white/8 text-slate-400'}`}>
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Usuario actual */}
        {usuarioActual && (
          <div className="p-3 rounded-xl bg-white/5 border border-white/8 space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-brand-500/25 flex items-center justify-center text-brand-200 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {displayName({ nombre: usuarioActual.nombre ?? undefined, email: usuarioActual.email })}
                </div>
                <div className="text-[10px] text-slate-500 truncate">{usuarioActual.email}</div>
              </div>
            </div>
            <div className="text-[10px] text-brand-300 font-semibold truncate pl-[42px]">
              {usuarioActual.rol ?? 'Sin rol asignado'}
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
