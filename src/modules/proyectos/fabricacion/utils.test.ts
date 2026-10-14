import { describe, it, expect } from 'vitest';
import { varianteEstadoFabricacion, textoEstadoFabricacion, formatoMm, resumenCuadros } from './utils';
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
