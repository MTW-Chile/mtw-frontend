import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Circle, CircleDashed, Hammer, Package, PackageCheck, Truck } from 'lucide-react';
import type { BadgeVariant } from '../../../components/ui/Badge';
import type { EstadoDespacho, EstadoEstadoPago, EstadoVentanaObra, HitoCobro, ParteVentana, TipoGuiaDespacho } from '../../../types';

// Vocabulario compartido de Despachos, Instalación y Estados de
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

// Ícono de cada estado: el color pastel solo no se distingue bajo el sol de la obra ni para quien no distingue
// colores (pauta 11 de NN/g); el ícono va en el chip del plano y en la leyenda del avance.
export const ICONO_ESTADO_VENTANA: Record<EstadoVentanaObra, LucideIcon> = {
  SIN_POSICION: CircleDashed,
  CUBICADA: Circle,
  EN_FABRICACION: Hammer,
  FABRICADA: Package,
  DESPACHADA: Truck,
  RECIBIDA: PackageCheck,
  INSTALADA: CheckCircle2,
};

// Color de fondo del chip de una ventana en el plano de instalación (móvil primero: el color es la lectura rápida).
export const CLASE_CHIP_ESTADO: Record<EstadoVentanaObra, string> = {
  SIN_POSICION: 'bg-slate-50 border-slate-200 text-slate-500',
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

// ---- Marco y hoja: los dos estados de la ventana ----
// Una ventana tiene SIEMPRE dos estados, el del marco y el de la hoja (o el vidrio, en una fija): el marco puede
// estar instalado semanas antes de que salga su hoja. `v.estado` (el menor de los dos) sirve para ordenar y para
// decir "completa"; lo que se muestra y lo que se filtra sale de aquí.

/** Mitad del chip del plano cuando marco y hoja van en estados distintos (solo fondo; el texto es neutro). */
export const CLASE_MEDIA_ESTADO: Record<EstadoVentanaObra, string> = {
  SIN_POSICION: 'bg-slate-50',
  CUBICADA: 'bg-white',
  EN_FABRICACION: 'bg-amber-100',
  FABRICADA: 'bg-sky-100',
  DESPACHADA: 'bg-violet-100',
  RECIBIDA: 'bg-brand-100',
  INSTALADA: 'bg-emerald-100',
};

/** Cómo se llama la segunda parte de ESTA ventana. */
export const nombreParteHoja = (v: { esFija?: boolean }): 'hoja' | 'vidrio' => (v.esFija ? 'vidrio' : 'hoja');

/** Nombre de una parte de ESTA ventana: "marco", "hoja" o "vidrio" (vacío si es la ventana completa). Es la forma única de nombrarla. */
export const parteDe = (v: { esFija?: boolean } | null | undefined, parte: ParteVentana): string => (parte === 'HOJA' ? nombreParteHoja(v ?? {}) : ETIQUETA_PARTE_CORTA[parte]);

/** Marco y hoja van en estados distintos. */
export const partesEnDistintoEstado = (v: { estadoPartes: { marco: EstadoVentanaObra; hoja: EstadoVentanaObra } }): boolean => v.estadoPartes.marco !== v.estadoPartes.hoja;

/** El marco o la hoja están en ese estado. */
export const algunaParteEn = (v: { estadoPartes: { marco: EstadoVentanaObra; hoja: EstadoVentanaObra } }, e: EstadoVentanaObra): boolean => v.estadoPartes.marco === e || v.estadoPartes.hoja === e;

/** "marco instalada · hoja en fabricación": los dos estados en una línea. */
export const textoEstadoPartes = (v: { esFija?: boolean; estadoPartes: { marco: EstadoVentanaObra; hoja: EstadoVentanaObra } }): string =>
  partesEnDistintoEstado(v) ? `marco: ${ETIQUETA_ESTADO_VENTANA[v.estadoPartes.marco].toLowerCase()} · ${nombreParteHoja(v)}: ${ETIQUETA_ESTADO_VENTANA[v.estadoPartes.hoja].toLowerCase()}` : ETIQUETA_ESTADO_VENTANA[v.estadoPartes.marco];

/** Una parte, dicha como lo que le falta: es lo que lee quien está en la obra. */
export const ETIQUETA_PARTE_EN: Record<EstadoVentanaObra, string> = {
  SIN_POSICION: 'sin posición',
  CUBICADA: 'sin fabricar',
  EN_FABRICACION: 'en fabricación',
  FABRICADA: 'en fábrica, listos',
  DESPACHADA: 'por recibir',
  RECIBIDA: 'por instalar',
  INSTALADA: 'instalados',
};

export const ETIQUETA_PARTE_CORTA: Record<ParteVentana, string> = { COMPLETA: '', MARCO: 'marco', HOJA: 'hoja' };

// Hitos de cobro (la etiqueta exacta por ventana la manda la API: en una fija el segundo hito es "Vidrio").
export const ETIQUETA_HITO: Record<HitoCobro, string> = { MARCO: 'Marco', HOJA: 'Hoja con vidrio', R1: 'Recepción R1', RF: 'Recepción final' };
export const ETIQUETA_HITO_CORTA: Record<HitoCobro, string> = { MARCO: 'Marco', HOJA: 'Hoja / vidrio', R1: 'R1', RF: 'RF' };
/** Qué habilita cada hito (para ayudas en pantalla). */
export const AYUDA_HITO: Record<HitoCobro, string> = {
  MARCO: 'Se cobra al instalar el marco.',
  HOJA: 'Se cobra al instalar la hoja con su vidrio (en una ventana fija, el vidrio).',
  R1: 'Se cobra al ingresar la recepción R1 del cliente, sin importar el resultado.',
  RF: 'Se cobra cuando el cliente declara resueltas las observaciones.',
};

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
