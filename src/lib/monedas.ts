import { useQuery } from '@tanstack/react-query';
import { getMonedas } from '../api/client';

/**
 * Divisas de HETMO.
 *
 * En los materiales HETMO manda sólo el código (`moneda_origen_codigo: "2"`),
 * sin nombre ni símbolo. El nombre y el símbolo viajan únicamente a nivel de
 * presupuesto (`moneda_codigo` / `moneda_descripcion` / `moneda_simbolo`), así
 * que el relay expone ese diccionario en `/api/monedas` y acá se resuelve el
 * código contra él. Comparar el código crudo contra 'USD'/'EUR' nunca calzaba:
 * los precios se mostraban como pesos sin decimales y, en la analítica, se
 * convertían con factor 1.
 */
export interface MonedaHetmo {
  codigo: string;
  descripcion: string | null;
  simbolo: string | null;
  presupuestos?: number;
}

export type MonedaIso = 'CLP' | 'USD' | 'EUR' | 'UF';

/** Símbolo por divisa, para cuando HETMO no manda uno. */
const SIMBOLOS: Record<MonedaIso, string> = {
  CLP: '$',
  USD: 'US$',
  EUR: '€',
  UF: 'UF',
};

const NOMBRES: Record<MonedaIso, string> = {
  CLP: 'Peso',
  USD: 'Dólar',
  EUR: 'Euro',
  UF: 'UF',
};

/**
 * Lleva una divisa a su código ISO. Acepta tanto un ISO ya escrito ('USD')
 * como el nombre que manda HETMO ('EURO', 'DOLAR', 'UNIDAD DE FOMENTO').
 */
export function isoDeTexto(texto?: string | null): MonedaIso | null {
  const t = String(texto || '').trim().toUpperCase();
  if (!t) return null;
  if (/^(CLP|PESO)/.test(t) || t.includes('PESO')) return 'CLP';
  if (t === 'USD' || t.includes('DOLAR') || t.includes('DÓLAR')) return 'USD';
  if (t === 'EUR' || t.includes('EURO')) return 'EUR';
  if (t === 'UF' || t.includes('FOMENTO')) return 'UF';
  return null;
}

export interface MonedaResuelta {
  iso: MonedaIso | null;
  /** Etiqueta para mostrar: 'EURO', 'USD', 'UF'... nunca el código crudo. */
  nombre: string;
  simbolo: string;
}

/**
 * Resuelve el valor que traen los materiales (código numérico de HETMO, o ya
 * un ISO si lo cargó alguien a mano) contra el diccionario del presupuesto.
 */
export function resolverMoneda(
  valor?: string | null,
  diccionario?: MonedaHetmo[]
): MonedaResuelta {
  const crudo = String(valor ?? '').trim();

  // Puede venir ya como ISO (materiales creados a mano en el maestro).
  const isoDirecto = isoDeTexto(crudo);
  if (isoDirecto) {
    return { iso: isoDirecto, nombre: NOMBRES[isoDirecto], simbolo: SIMBOLOS[isoDirecto] };
  }

  const entrada = (diccionario || []).find((m) => String(m.codigo) === crudo);
  if (entrada) {
    const iso = isoDeTexto(entrada.descripcion);
    return {
      iso,
      nombre: entrada.descripcion?.trim() || (iso ? NOMBRES[iso] : crudo),
      simbolo: entrada.simbolo?.trim() || (iso ? SIMBOLOS[iso] : ''),
    };
  }

  // Código desconocido: se muestra tal cual en vez de fingir que son pesos.
  return { iso: null, nombre: crudo || '—', simbolo: '' };
}

/**
 * Monto con su divisa. Los precios de materiales son chicos (0,731 · 1,535),
 * así que se muestran con decimales reales en vez de redondear a entero.
 */
export function formatMonto(
  valor: number | null | undefined,
  moneda: MonedaResuelta,
  opciones: { minDecimales?: number; maxDecimales?: number } = {}
): string {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '—';

  // Los pesos no usan decimales salvo que el monto sea menor a 1.
  const esPeso = moneda.iso === 'CLP';
  const min = opciones.minDecimales ?? (esPeso && Math.abs(Number(valor)) >= 1 ? 0 : 2);
  const max = opciones.maxDecimales ?? (esPeso && Math.abs(Number(valor)) >= 1 ? 0 : 4);

  const numero = new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: min,
    maximumFractionDigits: Math.max(min, max),
  }).format(Number(valor));

  const prefijo = moneda.simbolo || moneda.nombre;
  return prefijo ? `${prefijo} ${numero}` : numero;
}

/** Diccionario de divisas, cacheado: cambia muy de vez en cuando. */
export function useMonedas() {
  const { data } = useQuery<MonedaHetmo[]>({
    queryKey: ['monedas'],
    queryFn: getMonedas,
    staleTime: 1000 * 60 * 30,
  });
  return data || [];
}
