import { describe, it, expect } from 'vitest';
import { FORMATO_NOMENCLATURA_DEFECTO, estadoSaldo, formatoMonto, generarNomenclatura, mmATexto, validarFormato } from './utils';

describe('generarNomenclatura', () => {
  it('el código original va primero: V01, piso 1, depto 1, torre A -> V01_101A', () => {
    expect(generarNomenclatura(FORMATO_NOMENCLATURA_DEFECTO, { codigo: 'V01', torre: 'A', piso: 1, dpto: 1 })).toBe('V01_101A');
  });
  it('piso de dos cifras, torre en minúscula y sin torre', () => {
    expect(generarNomenclatura(FORMATO_NOMENCLATURA_DEFECTO, { codigo: 'PV01', torre: 'b', piso: 12, dpto: 3 })).toBe('PV01_1203B');
    expect(generarNomenclatura(FORMATO_NOMENCLATURA_DEFECTO, { codigo: 'V02', torre: null, piso: 3, dpto: 10 })).toBe('V02_310');
  });
  it('sin piso o departamento no hay nomenclatura final', () => {
    expect(generarNomenclatura(FORMATO_NOMENCLATURA_DEFECTO, { codigo: 'V02', piso: 3 })).toBeNull();
  });
});

describe('validarFormato', () => {
  it('acepta el formato por defecto y variantes', () => {
    expect(validarFormato(FORMATO_NOMENCLATURA_DEFECTO)).toBeNull();
    expect(validarFormato('{codigo}-{torre}{piso}{dpto}')).toBeNull();
  });
  it('rechaza lo que el servidor rechaza', () => {
    expect(validarFormato('')).toMatch(/vacío/);
    expect(validarFormato('{piso}{dpto}_{codigo}')).toMatch(/empezar con \{codigo\}/);
    expect(validarFormato('{codigo}_{foo}{piso}')).toMatch(/desconocida/);
    expect(validarFormato('{codigo}_{torre}')).toMatch(/\{piso\} o \{dpto\}/);
    expect(validarFormato('{codigo}/{piso}')).toMatch(/no permitidos/);
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
