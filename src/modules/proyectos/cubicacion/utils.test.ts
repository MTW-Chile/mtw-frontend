import { describe, it, expect } from 'vitest';
import { FORMATO_NOMENCLATURA_DEFECTO, estadoSaldo, formatoMonto, generarNomenclatura, leerEntero, leerTorres, lineaReporteSincronizacion, lineasReporteImportacion, mensajeAsignacion, mensajeCopiaPiso, mmATexto, rangoPisos, textoTorre, validarFormato } from './utils';

describe('generarNomenclatura', () => {
  it('el código original va primero: V01, unidad "101", torre A -> V01_101A', () => {
    expect(generarNomenclatura(FORMATO_NOMENCLATURA_DEFECTO, { codigo: 'V01', torre: 'A', nombreUnidad: '101' })).toBe('V01_101A');
  });
  it('torre en minúscula y sin torre', () => {
    expect(generarNomenclatura(FORMATO_NOMENCLATURA_DEFECTO, { codigo: 'PV01', torre: 'b', nombreUnidad: '1203' })).toBe('PV01_1203B');
    expect(generarNomenclatura(FORMATO_NOMENCLATURA_DEFECTO, { codigo: 'V02', torre: null, nombreUnidad: '310' })).toBe('V02_310');
  });
  it('sin unidad no hay nomenclatura final', () => {
    expect(generarNomenclatura(FORMATO_NOMENCLATURA_DEFECTO, { codigo: 'V02' })).toBeNull();
  });
});

describe('validarFormato', () => {
  it('acepta el formato por defecto y variantes', () => {
    expect(validarFormato(FORMATO_NOMENCLATURA_DEFECTO)).toBeNull();
    expect(validarFormato('{codigo}-{torre}{nombreUnidad}')).toBeNull();
  });
  it('rechaza lo que el servidor rechaza', () => {
    expect(validarFormato('')).toMatch(/vacío/);
    expect(validarFormato('{nombreUnidad}_{codigo}')).toMatch(/empezar con \{codigo\}/);
    expect(validarFormato('{codigo}_{foo}{nombreUnidad}')).toMatch(/desconocida/);
    expect(validarFormato('{codigo}_{torre}')).toMatch(/\{nombreUnidad\}/);
    expect(validarFormato('{codigo}/{nombreUnidad}')).toMatch(/no permitidos/);
  });
});

describe('formato de montos y saldos', () => {
  it('UF con separadores chilenos', () => {
    expect(formatoMonto(1234.567)).toBe('1.234,57 UF');
    expect(formatoMonto(13.28)).toBe('13,28 UF');
    expect(formatoMonto(null)).toBe('—');
  });
  it('estado del saldo', () => {
    expect(estadoSaldo(0)).toBe('completo');
    expect(estadoSaldo(5)).toBe('pendiente');
    expect(estadoSaldo(-1)).toBe('excedido');
  });
  it('milímetros como texto con coma', () => {
    expect(mmATexto(2204.5)).toBe('2204,5');
    expect(mmATexto(null)).toBe('');
  });
});

describe('texto de los reportes', () => {
  it('planilla completada', () => {
    expect(lineasReporteImportacion({ formato: 'plantilla', filas: 1336, actualizadas: 3, sinCambios: 0, posicionadasAhora: 3, rectificadasAhora: 1, advertencias: [] })).toEqual([
      '3 ventana(s) actualizada(s) de 1336 filas · 3 con posición nueva · 1 rectificada(s)',
    ]);
  });
  it('planilla HR', () => {
    const l = lineasReporteImportacion({
      formato: 'hr',
      tipos: { nuevos: 0, actualizados: 32 },
      unidades: { nuevas: 0, asignadas: 95, existentes: 0, rectificadasAhora: 2, areasComunes: 0 },
      advertencias: [],
    });
    expect(l[1]).toBe('Ventanas: 95 asignadas a ventanas del presupuesto, 0 nuevas, 0 ya existían, 2 con rasgo cargado');
  });
  it('sincronización con el presupuesto', () => {
    expect(lineaReporteSincronizacion({ tipos: { nuevos: 1, actualizados: 31 }, unidadesCreadas: 7, unidadesQuitadas: 3, avisos: [] })).toBe(
      '1 tipo(s) nuevo(s) · 31 actualizado(s) · 7 unidad(es) creada(s) · 3 sin posición quitada(s)'
    );
  });
});

describe('cubicador visual', () => {
  it('leerEntero acepta enteros con signo y rechaza el resto', () => {
    expect(leerEntero(' 12 ')).toBe(12);
    expect(leerEntero('-1')).toBe(-1);
    expect(leerEntero('')).toBeNull();
    expect(leerEntero('1,5')).toBeNull();
    expect(leerEntero('a')).toBeNull();
  });
  it('leerTorres: separa por coma o espacio, en mayúscula y sin repetir; vacío = sin torres', () => {
    expect(leerTorres('a, b  c;a')).toEqual(['A', 'B', 'C']);
    expect(leerTorres('  ')).toEqual(['']);
  });
  it('textoTorre y rangoPisos', () => {
    expect(textoTorre('A')).toBe('Torre A');
    expect(textoTorre('')).toBe('Sin torre');
    expect(rangoPisos(2, 4)).toEqual([2, 3, 4]);
    expect(rangoPisos(5, 2)).toEqual([]);
  });
  it('los mensajes dicen cuántas quedaron y por qué faltan', () => {
    expect(mensajeAsignacion({ asignadas: 2, faltan: 0 }, 'V01')).toBe('2 V01 asignada(s).');
    expect(mensajeAsignacion({ asignadas: 5, faltan: 2 }, 'V02')).toContain('faltaron 2');
    const m = mensajeCopiaPiso({ pisos: 2, ventanas: 10, deptosOmitidos: 1, faltan: [{ codigo: 'V02', cantidad: 3 }] });
    expect(m).toContain('10 ventana(s) copiada(s) a 2 piso(s)');
    expect(m).toContain('3 V02');
  });
});
