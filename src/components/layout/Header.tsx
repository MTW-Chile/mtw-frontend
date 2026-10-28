import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Menu, User, LogOut, ChevronDown, Bell, UserCog } from 'lucide-react';
import { BotonAtras, BotonRecargar, MigasDePan } from './NavControls';
import { seccionDesdePath, useLocationHref } from '../../lib/navigation';
import { useSession, displayName } from '../../lib/useCloudflareAccessSession';
import { getMisPermisos, getMisAprobacionesPendientes } from '../../api/client';

interface HeaderProps {
  onOpenSidebar: () => void;
  moduleTitle?: string;
  // Navegación genérica (ej. al Centro de Notificaciones desde el menú de usuario).
  onNavigate?: (tab: string, search?: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSidebar,
  moduleTitle = 'Inicio',
  onNavigate,
}) => {
  const { usuario } = useSession();
  const seccionActual = seccionDesdePath() || 'inicio';
  useLocationHref();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // mismo queryKey que App.tsx -- sale del cache de react-query, no pega
  // de nuevo al backend.
  const { data: permisos } = useQuery({ queryKey: ['misPermisos'], queryFn: getMisPermisos });
  // Mismo nombre que muestra el Sidebar (el de MTW ERP) -- el de la sesion
  // de Cloudflare queda solo de respaldo. Antes el Header decia "Usuario
  // MTW" mientras el Sidebar mostraba el nombre real.
  const nombreUsuario = permisos?.nombre || displayName(permisos ? { email: permisos.email } : usuario);
  // El menú de notificaciones lo ve cualquier usuario con rol. Hoy la lista
  // solo trae pendientes gerenciales (ver GET /mis-aprobaciones-pendientes):
  // para el resto aparece "Todo al día" hasta que existan otros tipos.
  const puedeVerNotificaciones = !!permisos;

  const { data: pendientes } = useQuery({
    queryKey: ['misAprobacionesPendientes'],
    queryFn: getMisAprobacionesPendientes,
    enabled: puedeVerNotificaciones,
    // Cada 20s + al volver el foco a la pestaña (override del default
    // global refetchOnWindowFocus:false, ver App.tsx) -- ademas se
    // invalida al toque desde las mutaciones que crean/resuelven un
    // pendiente (ver useCotizadorWorkspace, OrdenesCompraList,
    // OrdenCompraModal), este poll es la red de seguridad para
    // cuando el cambio lo hizo OTRO usuario mientras este navega.
    refetchInterval: 1000 * 20,
    refetchOnWindowFocus: true,
  });

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

  return (
    <header className="@container sticky top-0 z-30 h-14 sm:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-2 sm:px-6 flex items-center justify-between gap-2 sm:gap-3">
      {/* Lado Izquierdo */}
      <div className="flex items-center gap-1 sm:gap-3 min-w-0 flex-1">
        {/* Móvil: Menú Hamburguesa */}
        <button
          onClick={onOpenSidebar}
          className="p-2 -ml-1 rounded-xl md:hidden text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="w-5 h-5" />
        </button>


        {/* Navegación dentro de la app: Atrás + Actualizar datos + migas
            de pan (sección › obra abierta). Ver NavControls.tsx. */}
        <div className="flex items-center gap-0 sm:gap-0.5 shrink-0 md:-ml-2">
          <BotonAtras />
          <BotonRecargar />
        </div>
        {/* Migas en todos los anchos: en una línea con espacio, en dos sin él (ver MigasDePan). */}
        <div className="flex min-w-0 overflow-hidden pl-0.5 sm:pl-1">
          <MigasDePan seccion={seccionActual} titulo={moduleTitle} />
        </div>
      </div>

      {/* Contexto de la pantalla abierta (ej. selector de paso y estado del
          cotizador, ver HeaderContexto.tsx): cada pantalla lo llena por portal. */}
      <div id="header-contexto" className="min-w-0 flex items-center gap-2 empty:hidden" />

      {/* Lado derecho: el menú de usuario (con Notificaciones) es el último elemento. */}
      <div className="relative flex items-center gap-2 shrink-0">
        {/* Menú de Usuario con Dropdown */}
        <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className={`flex items-center gap-2 p-1 sm:px-3 sm:py-1.5 rounded-full sm:rounded-xl border transition-all cursor-pointer focus:outline-none sm:max-w-[220px] ${
            isMenuOpen
              ? 'bg-slate-100 border-slate-300 shadow-xs ring-2 ring-brand-600/20'
              : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80 shadow-2xs'
          }`}
          aria-expanded={isMenuOpen}
          aria-haspopup="true"
          title={`Sesión iniciada como: ${nombreUsuario}`}
        >
          {/* El contador de notificaciones va tambien aqui, siempre visible (el detalle esta en el menu y en el Centro). */}
          <div className="relative w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-brand-600/10 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0">
            <User className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            {!!pendientes?.total && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-signal ring-2 ring-white text-white text-[9px] font-bold flex items-center justify-center" aria-label={`${pendientes.total} notificaciones pendientes`}>
                {pendientes.total > 9 ? '9+' : pendientes.total}
              </span>
            )}
          </div>
          <div className="hidden sm:block text-xs text-slate-600 font-medium truncate text-left">
            <strong className="text-slate-900 font-bold truncate">
              {nombreUsuario}
            </strong>
          </div>
          <ChevronDown
            className={`hidden sm:block w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
              isMenuOpen ? 'rotate-180 text-slate-700' : ''
            }`}
          />
        </button>

        {/* Dropdown flotante */}
        {isMenuOpen && (
          // En móvil, a lo ancho de la pantalla bajo el header; desde sm, colgando del botón.
          <div className="fixed left-2 right-2 top-14 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-64 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 z-50 animate-fade-in divide-y divide-slate-100">
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
              {puedeVerNotificaciones && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onNavigate?.('centro-notificaciones');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer text-left group"
                >
                  <div className="relative w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors shrink-0">
                    <Bell className="w-3.5 h-3.5" />
                    {!!pendientes?.total && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-signal ring-2 ring-white text-white text-[9px] font-bold flex items-center justify-center">
                        {pendientes.total > 9 ? '9+' : pendientes.total}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">Notificaciones</div>
                    <div className={`text-[10px] ${pendientes?.total ? 'text-amber-600' : 'text-slate-400'}`}>
                      {pendientes?.total ? 'Notificaciones Pendientes' : 'Todo al día'}
                    </div>
                  </div>
                </button>
              )}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onNavigate?.('mi-configuracion');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer text-left group"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors shrink-0">
                  <UserCog className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Mi configuración</div>
                  <div className={`text-[10px] ${permisos?.tieneTokenClay ? 'text-slate-400' : 'text-amber-600'}`}>
                    {permisos?.tieneTokenClay ? 'Mis datos y token de Clay' : 'Token de Clay sin configurar'}
                  </div>
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
      </div>
    </header>
  );
};

