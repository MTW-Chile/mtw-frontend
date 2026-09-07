import React, { useState, useRef, useEffect } from 'react';
import { Menu, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useSession, displayName } from '../../lib/useCloudflareAccessSession';

interface HeaderProps {
  onOpenSidebar: () => void;
  onNavigateHome: () => void;
  onNavigateConfig?: () => void;
  moduleTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSidebar,
  onNavigateHome,
  onNavigateConfig,
  moduleTitle = 'Inicio',
}) => {
  const { usuario } = useSession();
  const nombreUsuario = displayName(usuario);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú al hacer clic afuera o con Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleLogout = () => {
    setIsMenuOpen(false);
    // Redirige al logout estándar de Cloudflare Access
    window.location.href = '/cdn-cgi/access/logout';
  };

  const handleConfig = () => {
    setIsMenuOpen(false);
    onNavigateConfig?.();
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs px-3.5 sm:px-6 flex items-center justify-between gap-3">
      {/* Lado Izquierdo */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Móvil: Menú Hamburguesa */}
        <button
          onClick={onOpenSidebar}
          className="p-2 -ml-1 rounded-xl lg:hidden text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Móvil: Solo el logo en imagen con enlace a Inicio */}
        <button
          onClick={onNavigateHome}
          className="flex lg:hidden items-center group cursor-pointer focus:outline-none shrink-0"
          title="Ir al Inicio de MTW ERP"
        >
          <img
            src="/mtw-logo.png"
            alt="MTW"
            className="h-7 w-auto object-contain transition-transform group-hover:scale-105"
          />
        </button>

        {/* Desktop: Título del módulo activo (el logo ya está en la barra lateral fija) */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800 tracking-tight">
            {moduleTitle}
          </span>
        </div>
      </div>

      {/* Lado Derecho: Menú de Usuario con Dropdown */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all cursor-pointer focus:outline-none max-w-[150px] sm:max-w-none ${
            isMenuOpen
              ? 'bg-slate-100 border-slate-300 shadow-xs ring-2 ring-[#E34A26]/20'
              : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80 shadow-2xs'
          }`}
          aria-expanded={isMenuOpen}
          aria-haspopup="true"
          title={`Sesión iniciada como: ${nombreUsuario}`}
        >
          <div className="w-6 h-6 rounded-full bg-[#E34A26]/10 text-[#E34A26] flex items-center justify-center text-xs font-bold shrink-0">
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs text-slate-600 font-medium truncate text-left">
            <span className="hidden sm:inline text-slate-400">Bienvenido/a: </span>
            <strong className="text-slate-900 font-bold truncate">
              {nombreUsuario}
            </strong>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
              isMenuOpen ? 'rotate-180 text-slate-700' : ''
            }`}
          />
        </button>

        {/* Dropdown flotante */}
        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 z-50 animate-fade-in divide-y divide-slate-100">
            {/* Header del dropdown con info de usuario */}
            <div className="px-3 py-2.5 pb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Cuenta de Usuario
              </div>
              <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                {nombreUsuario}
              </div>
              {usuario?.email && usuario.email !== nombreUsuario && (
                <div className="text-[11px] text-slate-500 font-mono truncate">
                  {usuario.email}
                </div>
              )}
            </div>

            {/* Opciones */}
            <div className="py-1 space-y-0.5">
              <button
                onClick={handleConfig}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer text-left group"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors shrink-0">
                  <Settings className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Configuración</div>
                  <div className="text-[10px] text-slate-400">Preferencias del sistema</div>
                </div>
              </button>
            </div>

            {/* Cerrar Sesión */}
            <div className="pt-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50/80 transition-colors cursor-pointer text-left group"
              >
                <div className="w-7 h-7 rounded-lg bg-rose-100/60 group-hover:bg-rose-100 flex items-center justify-center text-rose-600 transition-colors shrink-0">
                  <LogOut className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-rose-700">Cerrar Sesión</div>
                  <div className="text-[10px] text-rose-400">Salir de Cloudflare Access</div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

