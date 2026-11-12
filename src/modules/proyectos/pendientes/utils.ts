import type { BadgeVariant } from '../../../components/ui/Badge';
import type {
  DestinoPendiente,
  EstadoPendiente,
  EtapaPendiente,
  MotivoPendiente,
  ObraPendiente,
  OrigenPendiente,
  PasoPendiente,
  TipoElementoPendiente,
  FabricacionPieza,
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
export const ETIQUETA_DESTINO: Record<DestinoPendiente, string> = { TECNICA: 'Área técnica', FABRICA: 'Fábrica', COMPRAS: 'Compras' };
export const ETIQUETA_ORIGEN: Record<OrigenPendiente, string> = { OBRA: 'Obra', FABRICACION: 'Fábrica' };
export const ETIQUETA_TIPO: Record<TipoElementoPendiente, string> = {
  VENTANA: 'Ventana completa',
  MARCO: 'Marco',
  HOJA: 'Hoja',
  VIDRIO: 'Vidrio',
  MATERIAL: 'Material',
  OTRO: 'Otro',
};
export const ETIQUETA_MOTIVO: Record<MotivoPendiente, string> = {
  FALLA: 'Falla',
  DANO_OBRA: 'Daño en obra',
  ERROR_MEDIDAS: 'Error de medidas',
  DANO_INSTALACION: 'Daño por instalación',
  NO_RECEPCION: 'No recepción',
  NO_FABRICADO: 'No fabricado',
  CAMBIO_CLIENTE: 'Cambio del cliente',
};

export const ESTADOS_PENDIENTE: EstadoPendiente[] = ['INGRESADO', 'EN_CURSO', 'RESUELTO'];
// Áreas vigentes (TECNICA queda solo en pendientes antiguos y se ve junto a Compras).
export const DESTINOS_PENDIENTE: DestinoPendiente[] = ['FABRICA', 'COMPRAS'];

/** Área que gestiona el pendiente: los antiguos de «área técnica» son de Compras. */
export type AreaPendiente = 'FABRICA' | 'COMPRAS';
export const areaDe = (destino: DestinoPendiente): AreaPendiente => (destino === 'FABRICA' ? 'FABRICA' : 'COMPRAS');
export const ORIGENES_PENDIENTE: OrigenPendiente[] = ['OBRA', 'FABRICACION'];
// Lo que se puede ingresar, en el orden en que se ofrece. OTRO queda solo para los pendientes antiguos.
export const TIPOS_PENDIENTE: TipoElementoPendiente[] = ['MARCO', 'HOJA', 'VIDRIO', 'MATERIAL', 'VENTANA'];
// Motivos con los que se ingresa hoy. Los demás quedan solo para los pendientes antiguos.
export const MOTIVOS_PENDIENTE: MotivoPendiente[] = ['DANO_OBRA', 'NO_RECEPCION', 'ERROR_MEDIDAS'];

// ---- Reglas (espejo de mtw-api/src/pendientes-reglas.ts; el servidor es quien manda) ----

// El área depende solo de lo pedido: marco, hoja y ventana completa van a Fábrica (taller); vidrio y material, a Compras.
export function areaDelPendiente(tipo: TipoElementoPendiente, _motivo?: MotivoPendiente): DestinoPendiente {
  return tipo === 'VENTANA' || tipo === 'MARCO' || tipo === 'HOJA' ? 'FABRICA' : 'COMPRAS';
}

// ---- Flujo de los pendientes de obras legacy (espejo de pasosDeArea / pasosSiguientes del servidor) ----

export const ETIQUETA_PASO: Record<PasoPendiente, string> = {
  INGRESADO: 'Ingresado',
  RECIBIDO: 'Recibido',
  EN_PROCESO_COMPRA: 'En proceso de compra',
  EN_PRODUCCION: 'En producción',
  LISTO_DESPACHO: 'Listo para despacho',
  DESPACHADO: 'Despachado',
};

export const VARIANTE_PASO: Record<PasoPendiente, BadgeVariant> = {
  INGRESADO: 'info',
  RECIBIDO: 'warning',
  EN_PROCESO_COMPRA: 'warning',
  EN_PRODUCCION: 'warning',
  LISTO_DESPACHO: 'violet',
  DESPACHADO: 'success',
};

/** Los pasos de un área, en orden (Fábrica puede saltarse «En producción» si el producto ya está en la fábrica). */
export function pasosDeArea(destino: DestinoPendiente): PasoPendiente[] {
  return ['INGRESADO', 'RECIBIDO', destino === 'FABRICA' ? 'EN_PRODUCCION' : 'EN_PROCESO_COMPRA', 'LISTO_DESPACHO', 'DESPACHADO'];
}

/** Solo una ventana (se pide a Fabrica) o un vidrio se pueden rectificar. */
export const admiteRectificacion = (tipo: TipoElementoPendiente): boolean => tipo === 'VENTANA' || tipo === 'VIDRIO';

/** Milimetros escritos por una persona ("1.234,5" o "1234,5"); null si no es una medida valida. */
export function leerMilimetros(texto: string): number | null {
  const limpio = texto.trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n > 0 && n <= 20000 ? Math.round(n * 100) / 100 : null;
}

export function varianteEstadoPendiente(estado: EstadoPendiente, paso?: PasoPendiente | null): BadgeVariant {
  if (paso) return VARIANTE_PASO[paso];
  if (estado === 'EN_CURSO') return 'warning';
  if (estado === 'RESUELTO') return 'success';
  return 'info';
}

// "En curso · Orden de compra enviada": dentro de EN_CURSO lo que importa es la etapa.
// Un pendiente de obra legacy muestra su paso ("Listo para despacho").
export function textoEstadoPendiente(p: { estado: EstadoPendiente; paso?: PasoPendiente | null; etapa?: { nombre: string } | null }): string {
  if (p.paso) return ETIQUETA_PASO[p.paso];
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
  marco?: { numero: number; ancho?: number | string | null; alto?: number | string | null } | null;
  material?: { codigo: string; descripcion: string } | null;
  // Pieza cortada puntual (perfil de un cuadro) cuando el tipo es MATERIAL.
  pieza?: Pick<FabricacionPieza, 'codigoArticulo' | 'descripcion' | 'acabadoDescripcion' | 'longitudMm' | 'posicion' | 'numeroCuadro'> & { cuadro?: string | null };
}

const NOMBRE_POSICION: Record<string, string> = { S: 'superior', I: 'inferior', D: 'derecha', Z: 'izquierda' };

/** "S" → "superior", "ZB" → "ZB" (lo que HETMO no nombra se deja tal cual). */
export function nombrePosicionPieza(posicion: string | null | undefined): string {
  if (!posicion) return '';
  return NOMBRE_POSICION[posicion.toUpperCase()] ?? posicion;
}

/** "Marco 3" / "Hoja 9" según el tipo del cuadro. */
export function nombreCuadro(c: { numeroCuadro: number; tipo: 'MARCO' | 'HOJA' }): string {
  return `${c.tipo === 'MARCO' ? 'Marco' : 'Hoja'} ${c.numeroCuadro}`;
}

/** Línea corta de una pieza: "superior · 41028 Blanco · 796 mm" (con descripción si se pide). */
export function etiquetaPieza(p: Pick<FabricacionPieza, 'codigoArticulo' | 'descripcion' | 'acabadoDescripcion' | 'longitudMm' | 'posicion'>, conDescripcion = false): string {
  const partes = [nombrePosicionPieza(p.posicion), conDescripcion ? `${p.descripcion} (${p.codigoArticulo})` : p.codigoArticulo, p.acabadoDescripcion ?? '', `${formatoMm(p.longitudMm)} mm`];
  return partes.filter(Boolean).join(' · ');
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
    case 'MARCO': {
      if (!d.marco) return '';
      const medida = d.marco.ancho != null && d.marco.alto != null ? ` · ${formatoMm(d.marco.ancho)} × ${formatoMm(d.marco.alto)} mm` : '';
      return `Marco ${d.marco.numero}${medida}`;
    }
    case 'MATERIAL':
      if (d.pieza) {
        const donde = [d.pieza.cuadro, nombrePosicionPieza(d.pieza.posicion)].filter(Boolean).join(' ');
        return `${d.pieza.descripcion} (${d.pieza.codigoArticulo})${d.pieza.acabadoDescripcion ? ` ${d.pieza.acabadoDescripcion}` : ''} · ${formatoMm(d.pieza.longitudMm)} mm${donde ? ` · ${donde}` : ''}`;
      }
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

// ---------- Perfiles de un cuadro (qué hay que fabricar) ----------

export interface FilaPerfil {
  clave: string;
  codigo: string;
  descripcion: string;
  acabado: string | null;
  largo: number;
  corte: string;
  posiciones: string[];
  cantidad: number;
}

const grados = (v: number | string | null) => (v === null || v === '' || !Number.isFinite(Number(v)) ? null : `${Number(v)}°`);

/**
 * Los perfiles de UN cuadro, juntando los iguales (mismo perfil, acabado, largo y corte) con su cantidad. Si el
 * documento trae la línea para varias ventanas iguales, se toma una sola (la primera unidad).
 */
export function perfilesDeCuadro(piezas: FabricacionPieza[]): FilaPerfil[] {
  const unidades = piezas.map((z) => z.unidad).filter((u): u is number => u !== null);
  const unidad = unidades.length ? Math.min(...unidades) : null;
  const filas = new Map<string, FilaPerfil>();
  for (const z of piezas) {
    if (unidad !== null && z.unidad !== null && z.unidad !== unidad) continue;
    const corte = [grados(z.anguloInicio), grados(z.anguloFin)].filter(Boolean).join(' / ');
    const clave = [z.codigoArticulo, z.acabadoCodigo ?? '', Number(z.longitudMm), corte].join('|');
    const fila = filas.get(clave) ?? { clave, codigo: z.codigoArticulo, descripcion: z.descripcion, acabado: z.acabadoDescripcion, largo: Number(z.longitudMm), corte, posiciones: [], cantidad: 0 };
    fila.cantidad += 1;
    const posicion = nombrePosicionPieza(z.posicion);
    if (posicion && !fila.posiciones.includes(posicion)) fila.posiciones.push(posicion);
    filas.set(clave, fila);
  }
  return [...filas.values()];
}

// ---------- Gestión de varios pendientes a la vez ----------

export type AccionLote = 'OC' | 'RECIBIR' | 'PRODUCCION' | 'LISTO';

/**
 * Qué se puede hacer con varios pendientes a la vez: solo lo que vale para todos, así que tienen que ir en el mismo
 * tramo del flujo. Compras: subir una OC para los que aún no la tienen, o marcar recibidos los que están en compra.
 * Fábrica: pasarlos a producción con una fecha o dejarlos listos para despacho.
 */
export function accionesDeLote(area: AreaPendiente, seleccion: Pick<ObraPendiente, 'paso'>[]): AccionLote[] {
  if (seleccion.length === 0) return [];
  const todos = (...pasos: string[]) => seleccion.every((p) => !!p.paso && pasos.includes(p.paso));
  if (area === 'COMPRAS') {
    if (todos('INGRESADO', 'RECIBIDO')) return ['OC'];
    if (todos('EN_PROCESO_COMPRA')) return ['RECIBIR'];
    return [];
  }
  return todos('INGRESADO', 'RECIBIDO', 'EN_PRODUCCION') ? ['PRODUCCION', 'LISTO'] : [];
}

/** Se pueden gestionar en lote los que el área todavía puede mover a mano. */
export const esGestionableEnLote = (area: AreaPendiente, p: Pick<ObraPendiente, 'paso'>): boolean => accionesDeLote(area, [p]).length > 0;
