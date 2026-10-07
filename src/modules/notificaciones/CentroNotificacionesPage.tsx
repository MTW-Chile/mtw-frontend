import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Landmark, ShoppingCart, Loader2, ChevronRight } from 'lucide-react';
import { getMisAprobacionesPendientes } from '../../api/client';
import { PageHeader } from '../../components/ui/PageHeader';

const formatoMoneda = (valor: number) => valor.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

interface CentroNotificacionesPageProps {
  // Ir directo a donde ya existe la accion de aprobar/rechazar -- Paso 5
  // del Cotizador para una cotizacion, modulo Compras para una OC (ahi se
  // aprueba Y se envia, ya no desde la ficha de un proyecto puntual).
  // Nada de popups con un resumen aparte: la pagina real ya tiene toda la
  // info y el boton de aprobar.
  onAbrirCotizacion?: (proyectoId: string) => void;
  onAbrirCompras?: () => void;
}

/**
 * Destino estable de la campanita y de los correos de aprobacion
 * pendiente ("Ver Centro de Notificaciones") -- a diferencia de un
 * deep-link a un item puntual, esto no queda "roto" si ese item ya se
 * resolvio para cuando alguien lo abre. Lista todo lo gerencial pendiente
 * (Cotizaciones + OC) y cada item lleva directo a la pagina donde ya vive
 * la accion de aprobar/rechazar.
 */
export const CentroNotificacionesPage: React.FC<CentroNotificacionesPageProps> = ({
  onAbrirCotizacion,
  onAbrirCompras,
}) => {
  const { data: pendientes, isLoading } = useQuery({
    queryKey: ['misAprobacionesPendientes'],
    queryFn: getMisAprobacionesPendientes,
  });

  const gerencial = pendientes?.gerencial || [];

  return (
    <div className="w-full min-w-0 p-3 sm:p-5 md:p-6 xl:p-8 max-w-3xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Centro de Notificaciones"
        description="Cotizaciones y Órdenes de Compra esperando tu aprobación gerencial."
        icon={Bell}
      />

      {isLoading ? (
        <div className="p-12 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : gerencial.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          Sin pendientes por ahora.
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-50">
          {gerencial.map((item) => (
            <button
              key={item.tipo === 'orden_compra' ? `oc-${item.ordenCompraId}` : `cot-${item.versionId}`}
              onClick={() => (item.tipo === 'orden_compra' ? onAbrirCompras?.() : onAbrirCotizacion?.(item.proyectoId))}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  {item.tipo === 'orden_compra' ? <ShoppingCart className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  {item.tipo === 'orden_compra' ? (
                    <>
                      <h3 className="text-sm font-bold text-slate-900 truncate">{item.numero} · {item.proveedorNombre}</h3>
                      <p className="text-xs text-slate-500 truncate">
                        {item.obra} · {formatoMoneda(item.total)}
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-sm font-bold text-slate-900 truncate">{item.obra}</h3>
                      <p className="text-xs text-slate-500 truncate">{item.codigoInterno || 'Cotización'} · Esperando aprobación gerencial</p>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
