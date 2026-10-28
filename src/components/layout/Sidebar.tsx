import React, { useEffect, useState } from 'react';
import { X, PanelLeftClose, PanelLeftOpen, ChevronDown } from 'lucide-react';
import { MENU_LATERAL, SECCIONES_FRONTEND } from '../../lib/accessControl';
import { VERSION, VERSION_VISIBLE } from '../../lib/version';

// Preferencia de esta pantalla (no de datos): si el menú queda fijado abierto.
const CLAVE_FIJADO = 'mtw-sidebar-fijado';
// Por defecto el menú va desplegado; solo queda contraído si la persona lo contrajo.
const leerFijado = () => {
  try {
    return localStorage.getItem(CLAVE_FIJADO) !== '0';
  } catch {
    return true;
  }
};
// Grupo del menú desplegado (uno a la vez, para que el menú no se alargue).
const CLAVE_GRUPO = 'mtw-sidebar-grupo';
const leerGrupo = (): string | null | undefined => {
  try {
    const v = localStorage.getItem(CLAVE_GRUPO);
    return v === null ? undefined : v || null;
  } catch {
    return undefined;
  }
};
const guardarGrupo = (id: string | null) => {
  try {
    localStorage.setItem(CLAVE_GRUPO, id ?? '');
  } catch {
    // Sin storage: el grupo se despliega igual, sin recordarlo.
  }
};
const guardarFijado = (valor: boolean) => {
  try {
    localStorage.setItem(CLAVE_FIJADO, valor ? '1' : '0');
  } catch {
    // Sin storage (modo privado): el menú funciona igual, sin recordar la preferencia.
  }
};

// Escritorio y tablet (md+): riel angosto con íconos, o menú completo. El
// botón alterna entre ambos; no reacciona al mouse. Móvil: cajón que se abre
// con el menú hamburguesa.
//
// Clases `md:` solo aplican desde 768px; `ocultarEnRiel` esconde textos
// únicamente cuando el riel está contraído, sin afectar al cajón de móvil.
export const Sidebar: React.FC<{
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  // Ids de SECCIONES_FRONTEND que el usuario puede ver (ver App.tsx).
  seccionesPermitidas: string[];
}> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
  seccionesPermitidas,
}) => {
  const [fijado, setFijado] = useState(leerFijado);
  const expandido = fijado;
  const ocultarEnRiel = expandido ? '' : 'md:hidden';

  const toggleFijado = () => {
    const siguiente = !fijado;
    setFijado(siguiente);
    guardarFijado(siguiente);
  };

  // Sin insignias numericas: el menu solo navega.
  const menuItems = SECCIONES_FRONTEND.filter((s) => seccionesPermitidas.includes(s.id));
  const item = (id: string) => menuItems.find((m) => m.id === id);

  // Un solo grupo desplegado: abrir uno cierra el otro. Por defecto, el de la sección activa.
  const grupoDeActiva = MENU_LATERAL.find((e) => e.tipo === 'grupo' && e.secciones.includes(activeTab))?.id ?? null;
  const [abierto, setAbierto] = useState<string | null>(() => {
    const guardado = leerGrupo();
    return guardado === undefined ? grupoDeActiva : guardado;
  });
  // Al llegar a una sección de otro grupo (ej. un enlace), se despliega ese grupo.
  useEffect(() => {
    if (grupoDeActiva && abierto !== grupoDeActiva && !MENU_LATERAL.some((e) => e.tipo === 'grupo' && e.id === abierto && e.secciones.includes(activeTab))) {
      setAbierto(grupoDeActiva);
      guardarGrupo(grupoDeActiva);
    }
    // Solo cuando cambia la sección activa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);
  const alternarGrupo = (id: string) => {
    const siguiente = abierto === id ? null : id;
    setAbierto(siguiente);
    guardarGrupo(siguiente);
  };

  // Botón de una sección del Sidebar (usado por el menú principal y por el pie).
  const renderItem = (item: (typeof menuItems)[number], anidado = false, clave: string = item.id) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={clave}
            onClick={() => {
              setActiveTab(item.id);
              onClose();
            }}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
            title={item.label}
            className={`relative w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              isActive
                ? 'bg-white/10 text-white font-semibold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r before:bg-brand-400'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            } ${anidado && expandido ? 'pl-9' : ''} ${expandido ? '' : 'md:justify-center md:px-0'}`}
          >
            <div className={`flex items-center gap-3 min-w-0 ${expandido ? '' : 'md:gap-0'}`}>
              <Icon
                className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-300' : 'text-slate-500'}`}
              />
              <span className={`truncate ${ocultarEnRiel}`}>{item.label}</span>
            </div>

            {item.enConstruccion && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-white/8 text-slate-500 ${ocultarEnRiel}`}>Pronto</span>
            )}

          </button>
        );
  };

  return (
    <>
      {/* Backdrop para móviles */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-950/50 backdrop-blur-xs md:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Columna que el menú ocupa en el layout (solo md+): riel o menú fijado */}
      <div
        aria-hidden="true"
        className={`hidden md:block shrink-0 h-dvh transition-[width] duration-200 ease-in-out ${fijado ? 'w-64' : 'w-16'}`}
      />

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 max-w-[85vw] bg-ink-900 text-slate-300 px-3.5 py-4 flex flex-col justify-between transition-[width,transform] duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        } ${expandido ? 'md:w-64' : 'md:w-16 md:px-2.5'}`}
      >
        <div className="flex flex-col gap-6 min-w-0 min-h-0 flex-1">
          {/* Marca pequeña (sin texto ni versión) y botón para contraer / expandir */}
          <div
            className={`flex items-center justify-between gap-2 px-1.5 pb-4 border-b border-white/8 ${
              expandido ? '' : 'md:flex-col md:justify-center md:gap-3 md:px-0'
            }`}
          >
            <button
              onClick={() => {
                setActiveTab('inicio');
                onClose();
              }}
              className="flex items-center gap-3 group text-left cursor-pointer focus:outline-none min-w-0"
              title="Ir al Inicio de MTW ERP"
            >
              <img
                src={`${import.meta.env.BASE_URL}mtw-logo-light.png`}
                alt="MTW ERP"
                className={`h-8 w-auto object-contain transition-all duration-200 group-hover:scale-105 ${expandido ? '' : 'md:h-auto md:w-9'}`}
              />
              <div className={`min-w-0 ${ocultarEnRiel}`}>
                <h2 className="text-xs font-black tracking-tight uppercase text-white">MTW ERP</h2>
                <span className="text-[10px] font-mono text-brand-300 tracking-wider font-medium" title={`Versión ${VERSION}`}>{VERSION_VISIBLE}</span>
              </div>
            </button>

            <button
              onClick={toggleFijado}
              className="hidden md:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              aria-pressed={fijado}
              aria-label={fijado ? 'Contraer menú' : 'Expandir menú'}
              title={fijado ? 'Contraer menú' : 'Expandir menú'}
            >
              {fijado ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl md:hidden text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navegación: si no cabe (pantalla baja, móvil), hace scroll sin mover la marca ni Configuración. */}
          <div className="space-y-1.5 min-h-0 flex-1 overflow-y-auto overscroll-contain -mx-1 px-1 [scrollbar-width:thin]">
            <div className={`text-[10px] font-bold uppercase tracking-[0.14em] px-3 py-1 text-slate-500 ${ocultarEnRiel}`}>
              Menú Principal
            </div>
            <nav className="space-y-1">
              {MENU_LATERAL.map((entrada) => {
                if (entrada.tipo === 'seccion') {
                  const it = item(entrada.id);
                  return it ? renderItem(it) : null;
                }
                const hijos = entrada.secciones.map(item).filter((x): x is NonNullable<typeof x> => !!x);
                if (hijos.length === 0) return null;
                const GrupoIcon = entrada.icon;
                const contieneActiva = hijos.some((h) => h.id === activeTab);
                return (
                  <div key={entrada.id} className="space-y-1">
                    {/* En el riel (contraído) no hay grupos que desplegar: se ve un separador y los íconos. */}
                    <div className={`hidden ${expandido ? '' : 'md:block'} mx-2 my-2 border-t border-white/8`} />
                    <button
                      onClick={() => alternarGrupo(entrada.id)}
                      aria-expanded={abierto === entrada.id}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer hover:bg-white/5 ${
                        contieneActiva && abierto !== entrada.id ? 'text-white' : 'text-slate-400 hover:text-white'
                      } ${expandido ? '' : 'md:hidden'}`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <GrupoIcon className={`w-4 h-4 shrink-0 ${contieneActiva ? 'text-brand-300' : 'text-slate-500'}`} />
                        <span className="truncate">{entrada.titulo}</span>
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-slate-500 transition-transform ${abierto === entrada.id ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`space-y-1 ${abierto === entrada.id ? '' : 'hidden'} ${expandido ? '' : 'md:block'}`}>
                      {hijos.map((h) => renderItem(h, true, `${entrada.id}-${h.id}`))}
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>
        </div>

        {menuItems.some((item) => item.id === 'configuracion') && (
          <div className="pt-2 border-t border-white/10">
            {menuItems.filter((item) => item.id === 'configuracion').map((it) => renderItem(it))}
          </div>
        )}
      </aside>
    </>
  );
};
