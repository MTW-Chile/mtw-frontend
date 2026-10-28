import { describe, it, expect } from 'vitest';
import { varianteEstadoFabricacion, textoEstadoFabricacion, formatoMm, resumenCuadros, textoVinculosMultiples } from './utils';
import type { FabricacionCuadro } from '../../../types';

const cuadro = (tipo: 'MARCO' | 'HOJA', retirada = false): FabricacionCuadro => ({
  id: Math.random().toString(),
  ventanaId: 'v',
  numeroCuadro: 1,
  numeroCuadroInterno: null,
  tipo,
  anchoMm: null,
  altoMm: null,
  retirada,
});

describe('varianteEstadoFabricacion', () => {
  it('agrupa por etapa y no rompe con codigos desconocidos', () => {
    expect(varianteEstadoFabricacion(4)).toBe('warning');
    expect(varianteEstadoFabricacion(5)).toBe('success');
    expect(varianteEstadoFabricacion(6)).toBe('success');
    expect(varianteEstadoFabricacion(99)).toBe('danger');
    expect(varianteEstadoFabricacion(2)).toBe('info');
    expect(varianteEstadoFabricacion(0)).toBe('default');
    expect(varianteEstadoFabricacion(777)).toBe('default');
  });
});

describe('textoEstadoFabricacion', () => {
  it('usa la glosa de HETMO y cae al codigo', () => {
    expect(textoEstadoFabricacion(4, 'Inicio Fabricación')).toBe('Inicio Fabricación');
    expect(textoEstadoFabricacion(777, null)).toBe('Estado 777');
    expect(textoEstadoFabricacion(777, '  ')).toBe('Estado 777');
  });
});

describe('formatoMm', () => {
  it('acepta numero o string y conserva un decimal', () => {
    expect(formatoMm('1144.5')).toBe('1.144,5');
    expect(formatoMm(2309)).toBe('2.309');
    expect(formatoMm('1666.00')).toBe('1.666');
  });
  it('devuelve un guion si no hay dato', () => {
    expect(formatoMm(null)).toBe('—');
    expect(formatoMm(undefined)).toBe('—');
    expect(formatoMm('abc')).toBe('—');
  });
});

describe('resumenCuadros', () => {
  it('cuenta marcos y hojas vigentes', () => {
    expect(resumenCuadros([cuadro('MARCO'), cuadro('HOJA'), cuadro('HOJA')])).toBe('1 marco · 2 hojas');
  });
  it('ignora los retirados y maneja vacio', () => {
    expect(resumenCuadros([cuadro('HOJA', true)])).toBe('Sin cuadros');
    expect(resumenCuadros(undefined)).toBe('Sin cuadros');
    expect(resumenCuadros([cuadro('MARCO'), cuadro('MARCO')])).toBe('2 marcos');
  });
});

describe('textoVinculosMultiples', () => {
  const ok = (nuevas: number, vinculadas: number | null) =>
    ({ fabricacionId: 'f', hetmoId: 1, ventanas: { nuevas, actualizadas: 0, retiradas: 0 }, cuadros: { nuevos: 0, actualizados: 0, retirados: 0 }, advertencias: [], vinculacionCubicacion: vinculadas === null ? null : { vinculadas, sinMatch: [], faseInferida: null, faseConflicto: false } }) as const;
  it('suma documentos, ventanas leidas y las conectadas con la cubicacion', () => {
    expect(textoVinculosMultiples([ok(3, 2), ok(4, null)], [])).toBe('2 documento(s) vinculado(s): 7 ventana(s) leída(s), 2 conectada(s) con la cubicación.');
  });
  it('lista los que fallaron sin ocultar los que sí se vincularon', () => {
    expect(textoVinculosMultiples([ok(3, 0)], ['EX_P22: ya vinculado'])).toBe('1 documento(s) vinculado(s): 3 ventana(s) leída(s). 1 no se pudo vincular: EX_P22: ya vinculado');
  });
});
