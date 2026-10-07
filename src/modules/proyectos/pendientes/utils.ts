import type { BadgeVariant } from '../../../components/ui/Badge';
import type {
  DestinoPendiente,
  EstadoPendiente,
  EtapaPendiente,
  MotivoPendiente,
  ObraPendiente,
  OrigenPendiente,
  TipoElementoPendiente,
} from '../../../types';
import { formatoMm } from '../fabricacion/utils';

// Correlativo legible para nombrar un pendiente en una conversacion: PEN-000123.
export const codigoPendiente = (numero: number): string => `PEN-${String(numero).padStart(6, '0')}`;

export const ETIQUETA_ESTADO: Record<EstadoPendiente, string> = {
  INGRESADO: 'Ingresado',
  EN_CURSO: 'En curso',
  RESUELTO: 'Resuelto',
};
export const ETIQUETA_DESTINO: Record<DestinoPendiente, string> = { COMPRAS: 'Compras', FABRICACION: 'Fabricación' };
export const ETIQUETA_ORIGEN: Record<OrigenPendiente, string> = { OBRA: 'Obra', FABRICACION: 'Fabricación' };
export const ETIQUETA_TIPO: Record<TipoElementoPendiente, string> = {
  VENTANA: 'Ventana',
  HOJA: 'Hoja',
  VIDRIO: 'Vidrio',
  MATERIAL: 'Material',
  OTRO: 'Otro',
};
export const ETIQUETA_MOTIVO: Record<MotivoPendiente, string> = {
  NO_FABRICADO: 'No fabricado',
  MERMA: 'Merma',
  FALLA: 'Falla',
  DANO: 'Daño',
  NO_RECEPCION: 'No recepción',
  ERROR_MEDIDA: 'Error de medida',
  OTRO: 'Otro',
};

export const ESTADOS_PENDIENTE: EstadoPendiente[] = ['INGRESADO', 'EN_CURSO', 'RESUELTO'];
export const DESTINOS_PENDIENTE: DestinoPendiente[] = ['COMPRAS', 'FABRICACION'];
export const ORIGENES_PENDIENTE: OrigenPendiente[] = ['OBRA', 'FABRICACION'];
export const TIPOS_PENDIENTE: TipoElementoPendiente[] = ['VIDRIO', 'HOJA', 'VENTANA', 'MATERIAL', 'OTRO'];
export const MOTIVOS_PENDIENTE: MotivoPendiente[] = ['FALLA', 'DANO', 'MERMA', 'NO_RECEPCION', 'NO_FABRICADO', 'ERROR_MEDIDA', 'OTRO'];

export function varianteEstadoPendiente(estado: EstadoPendiente): BadgeVariant {
  if (estado === 'EN_CURSO') return 'warning';
  if (estado === 'RESUELTO') return 'success';
  return 'info';
}

// "En curso · Orden de compra enviada": dentro de EN_CURSO lo que importa es la etapa.
export function textoEstadoPendiente(p: { estado: EstadoPendiente; etapa?: { nombre: string } | null }): string {
  if (p.estado === 'EN_CURSO' && p.etapa) return `${ETIQUETA_ESTADO.EN_CURSO} · ${p.etapa.nombre}`;
  return ETIQUETA_ESTADO[p.estado];
}

// Etapas que se pueden elegir para un pendiente: activas y que apliquen a su
// destino (destino null = aplica a ambos), en el orden del catalogo.
export function etapasPara(etapas: EtapaPendiente[], destino: DestinoPendiente): EtapaPendiente[] {
  return etapas
    .filter((e) => e.activa && (e.destino === null || e.destino === destino))
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
}

// Descripcion sugerida al elegir QUE se esta pidiendo -- el usuario la puede
// editar. Para un vidrio incluye codigo y medidas reales (de la ventana ya
// fabricada: si estaba rectificada, la medida rectificada).
export interface DatosSugerencia {
  tipo: TipoElementoPendiente;
  ventanaModelo?: string;
  vidrio?: { codigo: string; ancho: number; alto: number } | null;
  hoja?: { numero: number; ancho?: number | string | null; alto?: number | string | null } | null;
  material?: { codigo: string; descripcion: string } | null;
}

export function sugerirDescripcion(d: DatosSugerencia): string {
  switch (d.tipo) {
    case 'VIDRIO':
      return d.vidrio ? `Vidrio ${d.vidrio.codigo} · ${formatoMm(d.vidrio.ancho)} × ${formatoMm(d.vidrio.alto)} mm` : '';
    case 'HOJA': {
      if (!d.hoja) return '';
      const medida = d.hoja.ancho != null && d.hoja.alto != null ? ` · ${formatoMm(d.hoja.ancho)} × ${formatoMm(d.hoja.alto)} mm` : '';
      return `Hoja ${d.hoja.numero}${medida}`;
    }
    case 'MATERIAL':
      return d.material ? `${d.material.descripcion} (${d.material.codigo})` : '';
    case 'VENTANA':
      return d.ventanaModelo ? `Ventana ${d.ventanaModelo}` : '';
    default:
      return '';
  }
}

// Texto de a que elemento se refiere el pendiente: la ventana ligada, o el
// texto libre, o lo que haya.
export function referenciaPendiente(p: Pick<ObraPendiente, 'ventanaRef' | 'fabricacionVentana' | 'ubicacion'>): string {
  const ventana = p.fabricacionVentana ? `Pos ${p.fabricacionVentana.orden} · ${p.fabricacionVentana.modelo}` : p.ventanaRef;
  return [ventana, p.ubicacion].filter(Boolean).join(' — ');
}

export interface ResumenEstados {
  INGRESADO: number;
  EN_CURSO: number;
  RESUELTO: number;
}

export function contarPorEstado(pendientes: Pick<ObraPendiente, 'estado'>[]): ResumenEstados {
  const r: ResumenEstados = { INGRESADO: 0, EN_CURSO: 0, RESUELTO: 0 };
  for (const p of pendientes) r[p.estado]++;
  return r;
}
