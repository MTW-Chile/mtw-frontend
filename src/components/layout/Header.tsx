import React from 'react';
import { Menu, Search, Sun, Moon } from 'lucide-react';

export const Header: React.FC<{
  onOpenSidebar: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}> = ({ onOpenSidebar, searchTerm, onSearchChange, isDarkMode, onToggleTheme }) => {
  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-950/80 backdrop-blur-md border-b border-white/[0.08] px-4 sm:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-64 sm:w-80 md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por obra, cliente, RUT o código..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onToggleTheme}
          className="px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/10 hover:border-cyan-500/30 transition-all flex items-center gap-2 text-xs font-semibold"
          title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
        >
          {isDarkMode ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline text-slate-300">Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline text-slate-300">Modo Oscuro</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
