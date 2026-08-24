import React from 'react';
import { Menu, Search } from 'lucide-react';

export const Header: React.FC<{
  onOpenSidebar: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}> = ({ onOpenSidebar, searchTerm, onSearchChange }) => {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 sm:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-xl lg:hidden text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-100/90 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#E34A26] transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 font-mono">
          MTW Frontend · <strong className="text-[#E34A26]">Alpha V0.1</strong>
        </span>
      </div>
    </header>
  );
};
