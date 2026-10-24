import type { BadgeVariant } from '../../../components/ui/Badge';
import type { EstadoDespacho, EstadoEstadoPago, EstadoVentanaObra, ParteVentana, TipoGuiaDespacho } from '../../../types';

// Vocabulario compartido de Fabricación > Despachos, Instalación y Estados de
// pago. Las reglas (qué estado tiene cada ventana) las calcula la API; aquí
// solo cómo se muestran.

export const ORDEN_ESTADO_VENTANA: EstadoVentanaObra[] = ['SIN_POSICION', 'CUBICADA', 'EN_FABRICACION', 'FABRICADA', 'DESPACHADA', 'RECIBIDA', 'INSTALADA'];

export const ETIQUETA_ESTADO_VENTANA: Record<EstadoVentanaObra, string> = {
  SIN_POSICION: 'Sin posición',
  CUBICADA: 'Cubicada',
  EN_FABRICACION: 'En fabricación',
  FABRICADA: 'Fabricada',
  DESPACHADA: 'Despachada',
  RECIBIDA: 'Recibida en obra',
  INSTALADA: 'Instalada',
};

export const VARIANTE_ESTADO_VENTANA: Record<EstadoVentanaObra, BadgeVariant> = {
  SIN_POSICION: 'subtle',
  CUBICADA: 'default',
  EN_FABRICACION: 'warning',
  FABRICADA: 'info',
  DESPACHADA: 'violet',
  RECIBIDA: 'brand',
  INSTALADA: 'success',
};

// Color de fondo del chip de una ventana en el plano de instalación (móvil primero: el color es la lectura rápida).
export const CLASE_CHIP_ESTADO: Record<EstadoVentanaObra, string> = {
  SIN_POSICION: 'bg-slate-50 border-slate-200 text-slate-400',
  CUBICADA: 'bg-white border-slate-200 text-slate-700',
  EN_FABRICACION: 'bg-amber-50 border-amber-200 text-amber-800',
  FABRICADA: 'bg-sky-50 border-sky-200 text-sky-800',
  DESPACHADA: 'bg-violet-50 border-violet-200 text-violet-800',
  RECIBIDA: 'bg-brand-50 border-brand-200 text-brand-800',
  INSTALADA: 'bg-emerald-50 border-emerald-300 text-emerald-800',
};

// Tramo de la barra de avance (clases completas: Tailwind solo genera las que ve escritas).
export const CLASE_BARRA_ESTADO: Record<EstadoVentanaObra, string> = {
  SIN_POSICION: 'bg-slate-100',
  CUBICADA: 'bg-slate-300',
  EN_FABRICACION: 'bg-amber-400',
  FABRICADA: 'bg-sky-400',
  DESPACHADA: 'bg-violet-400',
  RECIBIDA: 'bg-brand-500',
  INSTALADA: 'bg-emerald-500',
};

export const nivelEstado = (e: EstadoVentanaObra) => ORDEN_ESTADO_VENTANA.indexOf(e);

export const ETIQUETA_PARTE_CORTA: Record<ParteVentana, string> = { COMPLETA: '', MARCO: 'marco', HOJA: 'hoja' };

export const ETIQUETA_ESTADO_DESPACHO: Record<EstadoDespacho, string> = {
  BORRADOR: 'Borrador',
  EMITIDO: 'Emitido · por recibir',
  RECIBIDO_PARCIAL: 'Recibido parcial',
  RECIBIDO: 'Recibido en obra',
  ANULADO: 'Anulado',
};

export const VARIANTE_ESTADO_DESPACHO: Record<EstadoDespacho, BadgeVariant> = {
  BORRADOR: 'subtle',
  EMITIDO: 'violet',
  RECIBIDO_PARCIAL: 'warning',
  RECIBIDO: 'success',
  ANULADO: 'danger',
};

export const ETIQUETA_TIPO_GUIA: Record<TipoGuiaDespacho, string> = { BSALE: 'Guía electrónica (Bsale)', MANUAL: 'Guía manual', SIN_GUIA: 'Sin guía' };

export const ETIQUETA_ESTADO_PAGO: Record<EstadoEstadoPago, string> = {
  BORRADOR: 'Borrador',
  PRESENTADO: 'Presentado al cliente',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  FACTURADO: 'Facturado',
  PAGADO: 'Pagado',
  ANULADO: 'Anulado',
};

export const VARIANTE_ESTADO_PAGO: Record<EstadoEstadoPago, BadgeVariant> = {
  BORRADOR: 'subtle',
  PRESENTADO: 'info',
  APROBADO: 'brand',
  RECHAZADO: 'danger',
  FACTURADO: 'violet',
  PAGADO: 'success',
  ANULADO: 'default',
};

/** Nombre corto de una ventana para listas: la nomenclatura, o el código del tipo. */
export const nombreVentana = (v: { nomenclatura: string | null; codigo: string }) => v.nomenclatura ?? v.codigo;

export const textoMedida = (ancho: number | null, alto: number | null) =>
  ancho != null && alto != null ? `${Math.round(ancho).toLocaleString('es-CL')} × ${Math.round(alto).toLocaleString('es-CL')} mm` : '—';

/** Fecha de hoy en formato de <input type="date">. */
export const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
