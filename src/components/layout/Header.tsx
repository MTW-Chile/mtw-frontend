import React from 'react';
import { Menu, Search, User } from 'lucide-react';
import { useSession, displayName } from '../../lib/useCloudflareAccessSession';

export const Header: React.FC<{
  onOpenSidebar: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}> = ({ onOpenSidebar, searchTerm, onSearchChange }) => {
  const { usuario } = useSession();
  const nombreUsuario = displayName(usuario);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs px-3.5 sm:px-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 sm:gap-3 flex-1 max-w-md">
        <button
          onClick={onOpenSidebar}
          className="p-2.5 rounded-xl lg:hidden text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar obra, cliente o SKU..."
            className="w-full pl-9 sm:pl-10 pr-4 py-2 rounded-xl bg-slate-100/90 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#E34A26] transition-all"
          />
        </div>
      </div>

      {/* Saludo Usuario Autenticado por Microsoft Entra */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs">
          <div className="w-6 h-6 rounded-full bg-[#E34A26]/10 text-[#E34A26] flex items-center justify-center text-xs font-bold shrink-0">
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs text-slate-600 font-medium">
            <span className="hidden sm:inline text-slate-400">Bienvenido/a: </span>
            <strong className="text-slate-900 font-bold whitespace-nowrap">
              {nombreUsuario}
            </strong>
          </div>
        </div>
      </div>
    </header>
  );
};
