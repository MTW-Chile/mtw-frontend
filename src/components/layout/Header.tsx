import React from 'react';
import { Menu, User } from 'lucide-react';
import { useSession, displayName } from '../../lib/useCloudflareAccessSession';

interface HeaderProps {
  onOpenSidebar: () => void;
  onNavigateHome: () => void;
  moduleTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSidebar,
  onNavigateHome,
  moduleTitle = 'Inicio',
}) => {
  const { usuario } = useSession();
  const nombreUsuario = displayName(usuario);

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

      {/* Lado Derecho: Identificador de Usuario Autenticado */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs max-w-[190px] sm:max-w-none">
          <div className="w-6 h-6 rounded-full bg-[#E34A26]/10 text-[#E34A26] flex items-center justify-center text-xs font-bold shrink-0">
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs text-slate-600 font-medium truncate">
            <span className="hidden sm:inline text-slate-400">Bienvenido/a: </span>
            <strong className="text-slate-900 font-bold truncate">
              {nombreUsuario}
            </strong>
          </div>
        </div>
      </div>
    </header>
  );
};

