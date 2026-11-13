import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, ClipboardList, Landmark, ShoppingCart, ChevronRight } from 'lucide-react';
import { getMisAprobacionesPendientes } from '../../api/client';
import { PageHeader } from '../../components/ui/PageHeader';
import { BotonFila } from '../../components/ui/Lista';
import { EtiquetaObraLegacy } from '../../components/ui/CodigoObra';
import { Cargando, ErrorCarga, EstadoVacio } from '../../components/ui/Estados';

const formatoMoneda = (valor: number) => valor.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

interface CentroNotificacionesPageProps {
  // Ir directo a donde ya existe la accion de aprobar/rechazar -- Paso 5
  // del Cotizador para una cotizacion, modulo Compras para una OC (ahi se
  // aprueba Y se envia, ya no desde la ficha de un proyecto puntual).
  // Nada de popups con un resumen aparte: la pagina real ya tiene toda la
  // info y el boton de aprobar.
  onAbrirCotizacion?: (proyectoId: string) => void;
  onAbrirCompras?: () => void;
  onAbrirAdicional?: (proyectoId: string, adicionalId: string) => void;
  /** Pendientes de una obra, en el visor del área (Taller o Abastecimiento). */
  onAbrirPendientesObra?: (area: 'FABRICA' | 'COMPRAS', proyectoId: string) => void;
}

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });

/**
 * Destino estable del menú de notificaciones y de los correos de aprobacion
 * pendiente ("Ver Centro de Notificaciones") -- a diferencia de un
 * deep-link a un item puntual, esto no queda "roto" si ese item ya se
 * resolvio para cuando alguien lo abre. Lista todo lo gerencial pendiente
 * (Cotizaciones + OC) y cada item lleva directo a la pagina donde ya vive
 * la accion de aprobar/rechazar. Y los pendientes de obra que el area de la
 * persona (Fabrica o Compras) todavia no recibe, una linea por obra.
 */
export const CentroNotificacionesPage: React.FC<CentroNotificacionesPageProps> = ({
  onAbrirCotizacion,
  onAbrirCompras,
  onAbrirAdicional,
  onAbrirPendientesObra,
}) => {
  const { data: pendientes, isLoading, isError, refetch } = useQuery({
    queryKey: ['misAprobacionesPendientes'],
    queryFn: getMisAprobacionesPendientes,
  });

  const gerencial = pendientes?.gerencial || [];
  const pendientesObra = pendientes?.pendientesObra || [];

  return (
    <div className="w-full min-w-0 p-3 sm:p-5 md:p-6 xl:p-8 max-w-3xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Centro de Notificaciones"
        description="Pendientes que requieren tu atención."
        icon={Bell}
      />

      {isLoading ? (
        <Cargando />
      ) : isError ? (
        <ErrorCarga que="tus notificaciones" onReintentar={() => refetch()} />
      ) : gerencial.length === 0 && pendientesObra.length === 0 ? (
        <EstadoVacio icono={Bell} titulo="Sin pendientes por ahora" descripcion="Aquí aparece lo que espera una aprobación tuya o que tu área debe recibir." />
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-50">
          {pendientesObra.map((item) => (
            <BotonFila key={`pen-${item.proyectoId}-${item.area}`} onClick={() => onAbrirPendientesObra?.(item.area, item.proyectoId)} className="flex items-center justify-between gap-3 px-5! py-4!">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {item.cantidad === 1 ? '1 pendiente de obra nuevo' : `${item.cantidad} pendientes de obra nuevos`}
                    </h3>
                    <EtiquetaObraLegacy obra={item} />
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {item.obra} · {item.area === 'FABRICA' ? 'Fábrica' : 'Compras'} · {item.cantidad === 1 ? 'ingresado' : 'desde'} el {fechaCorta(item.desde)}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </BotonFila>
          ))}
          {gerencial.map((item) => (
            <BotonFila
              key={item.tipo === 'orden_compra' ? `oc-${item.ordenCompraId}` : item.tipo === 'adicional' ? `adi-${item.adicionalId}` : `cot-${item.versionId}`}
              onClick={() =>
                item.tipo === 'orden_compra'
                  ? onAbrirCompras?.()
                  : item.tipo === 'adicional'
                    ? onAbrirAdicional?.(item.proyectoId, item.adicionalId)
                    : onAbrirCotizacion?.(item.proyectoId)
              }
              className="flex items-center justify-between gap-3 px-5! py-4!"
              >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  {item.tipo === 'orden_compra' ? <ShoppingCart className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  {item.tipo === 'adicional' ? (
                    <>
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        Adicional A{item.numero} · {item.titulo}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">{item.obra} · Esperando aprobación gerencial</p>
                    </>
                  ) : item.tipo === 'orden_compra' ? (
                    <>
                      <h3 className="text-sm font-bold text-slate-900 truncate">{item.numero} · {item.proveedorNombre}</h3>
                      <p className="text-xs text-slate-500 truncate">
                        {item.obra} · {formatoMoneda(item.total)}
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-sm font-bold text-slate-900 truncate">{item.obra}</h3>
                      <p className="text-xs text-slate-500 truncate">{item.codigoInterno || 'Presupuesto'} · Esperando aprobación gerencial</p>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </BotonFila>
          ))}
        </div>
      )}
    </div>
  );
};
