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
// El area la asigna el sistema (ver areaDelPendiente); aca solo se muestra.
export const ETIQUETA_DESTINO: Record<DestinoPendiente, string> = { TECNICA: 'Área técnica', FABRICA: 'Fábrica' };
export const ETIQUETA_ORIGEN: Record<OrigenPendiente, string> = { OBRA: 'Obra', FABRICACION: 'Fábrica' };
export const ETIQUETA_TIPO: Record<TipoElementoPendiente, string> = {
  VENTANA: 'Ventana',
  HOJA: 'Hoja',
  VIDRIO: 'Vidrio',
  MATERIAL: 'Material',
  OTRO: 'Otro',
};
export const ETIQUETA_MOTIVO: Record<MotivoPendiente, string> = {
  FALLA: 'Falla',
  DANO_OBRA: 'Daño por obra',
  DANO_INSTALACION: 'Daño por instalación',
  NO_RECEPCION: 'No recepción',
  NO_FABRICADO: 'No fabricado',
};

export const ESTADOS_PENDIENTE: EstadoPendiente[] = ['INGRESADO', 'EN_CURSO', 'RESUELTO'];
export const DESTINOS_PENDIENTE: DestinoPendiente[] = ['TECNICA', 'FABRICA'];
export const ORIGENES_PENDIENTE: OrigenPendiente[] = ['OBRA', 'FABRICACION'];
export const TIPOS_PENDIENTE: TipoElementoPendiente[] = ['VIDRIO', 'HOJA', 'VENTANA', 'MATERIAL', 'OTRO'];
export const MOTIVOS_PENDIENTE: MotivoPendiente[] = ['FALLA', 'DANO_OBRA', 'DANO_INSTALACION', 'NO_RECEPCION', 'NO_FABRICADO'];

// ---- Reglas (espejo de mtw-api/src/pendientes-reglas.ts; el servidor es quien manda) ----

// Lo "no fabricado" y lo "no recibido" van a Fabrica; ventana y hoja tambien; vidrio,
// material y otro van al area tecnica (revisa y envia a Compras la OC).
export function areaDelPendiente(tipo: TipoElementoPendiente, motivo: MotivoPendiente): DestinoPendiente {
  if (motivo === 'NO_FABRICADO' || motivo === 'NO_RECEPCION') return 'FABRICA';
  return tipo === 'VENTANA' || tipo === 'HOJA' ? 'FABRICA' : 'TECNICA';
}

/** Un daño (en obra o en instalacion) pide el responsable. */
export const exigeResponsable = (motivo: MotivoPendiente): boolean => motivo === 'DANO_OBRA' || motivo === 'DANO_INSTALACION';

/** Solo una ventana (se pide a Fabrica) o un vidrio se pueden rectificar. */
export const admiteRectificacion = (tipo: TipoElementoPendiente): boolean => tipo === 'VENTANA' || tipo === 'VIDRIO';

/** Milimetros escritos por una persona ("1.234,5" o "1234,5"); null si no es una medida valida. */
export function leerMilimetros(texto: string): number | null {
  const limpio = texto.trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n > 0 && n <= 20000 ? Math.round(n * 100) / 100 : null;
}

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

// Titulo del pendiente (el campo `descripcion` del servidor), armado con lo que se eligio:
// ya no se escribe a mano. Sin elemento elegido cae al tipo, la ventana y el inicio de las notas.
export function tituloPendiente(d: DatosSugerencia, notas = ''): string {
  const base = sugerirDescripcion(d);
  if (base) return base;
  const resumen = notas.trim().replace(/\s+/g, ' ');
  const corto = resumen.length > 80 ? `${resumen.slice(0, 77)}...` : resumen;
  const nombre = ETIQUETA_TIPO[d.tipo] + (d.ventanaModelo ? ` · ${d.ventanaModelo}` : '');
  return corto ? `${nombre}: ${corto}` : nombre;
}

/** "Rectificar medidas: ancho 2.249 → 2.240 mm · alto 1.749 mm (sin cambio)"; null si no hay rectificacion. */
export function textoRectificacion(
  p: Pick<ObraPendiente, 'anchoOriginalMm' | 'altoOriginalMm' | 'anchoRectificadoMm' | 'altoRectificadoMm'>
): string | null {
  if (p.anchoRectificadoMm == null || p.altoRectificadoMm == null || p.anchoOriginalMm == null || p.altoOriginalMm == null) return null;
  const lado = (nombre: string, original: string, nueva: string) =>
    Number(original) === Number(nueva) ? `${nombre} ${formatoMm(nueva)} mm (sin cambio)` : `${nombre} ${formatoMm(original)} → ${formatoMm(nueva)} mm`;
  return `Rectificar medidas: ${lado('ancho', p.anchoOriginalMm, p.anchoRectificadoMm)} · ${lado('alto', p.altoOriginalMm, p.altoRectificadoMm)}`;
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
export function referenciaPendiente(p: Pick<ObraPendiente, 'ventanaRef' | 'fabricacionVentana'>): string {
  return (p.fabricacionVentana ? `Pos ${p.fabricacionVentana.orden} · ${p.fabricacionVentana.modelo}` : p.ventanaRef) || '';
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
