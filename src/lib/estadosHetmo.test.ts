import { describe, it, expect } from 'vitest';
import {
  glosaEstadoPresupuesto,
  varianteEstadoPresupuesto,
  etiquetaEstadoProyecto,
  varianteEstadoProyecto,
  esPresupuestoPrincipal,
} from './estadosHetmo';

const proy = (estadoHetmo: number, origen?: 'HETMO' | 'MANUAL_PRESUPUESTO' | 'MANUAL_OBRA') => ({
  origen,
  versiones: [{ estadoHetmo }],
});

describe('glosaEstadoPresupuesto (catalogo real de HETMO)', () => {
  it('usa los significados reales, no los del mapa antiguo', () => {
    expect(glosaEstadoPresupuesto(2)).toBe('Presupuesto cerrado');
    expect(glosaEstadoPresupuesto(30)).toBe('Aceptado comercial'); // antes: "Pasado a pedido"
    expect(glosaEstadoPresupuesto(20)).toBe('Presupuesto denegado'); // antes: "Aceptado por el cliente"
    expect(glosaEstadoPresupuesto(105)).toBe('Fabricando');
    expect(glosaEstadoPresupuesto(100)).toBe('Aceptado comercial y producción');
  });
  it('un codigo desconocido se muestra tal cual y no rompe', () => {
    expect(glosaEstadoPresupuesto(777)).toBe('Estado 777');
    expect(glosaEstadoPresupuesto(null)).toBe('Sin estado');
    expect(glosaEstadoPresupuesto(undefined)).toBe('Sin estado');
  });
});

describe('varianteEstadoPresupuesto', () => {
  it('colorea por significado y cae a default', () => {
    expect(varianteEstadoPresupuesto(2)).toBe('info');
    expect(varianteEstadoPresupuesto(30)).toBe('success');
    expect(varianteEstadoPresupuesto(105)).toBe('warning');
    expect(varianteEstadoPresupuesto(20)).toBe('danger');
    expect(varianteEstadoPresupuesto(777)).toBe('default');
  });
});

describe('estado mostrado de un proyecto', () => {
  it('un presupuesto manual se rotula como tal (su estado 2 es sintetico)', () => {
    expect(etiquetaEstadoProyecto(proy(2, 'MANUAL_PRESUPUESTO'))).toBe('Presupuesto manual');
    expect(varianteEstadoProyecto(proy(2, 'MANUAL_PRESUPUESTO'))).toBe('brand');
  });
  it('uno de HETMO muestra el estado real de su version vigente', () => {
    expect(etiquetaEstadoProyecto(proy(2, 'HETMO'))).toBe('Presupuesto cerrado');
    expect(etiquetaEstadoProyecto(proy(30))).toBe('Aceptado comercial');
  });
});

describe('esPresupuestoPrincipal (filtro por defecto y insignia)', () => {
  it('incluye estado 2 de HETMO y los presupuestos manuales', () => {
    expect(esPresupuestoPrincipal(proy(2, 'HETMO'))).toBe(true);
    expect(esPresupuestoPrincipal(proy(2))).toBe(true);
    expect(esPresupuestoPrincipal(proy(2, 'MANUAL_PRESUPUESTO'))).toBe(true);
  });
  it('un presupuesto manual cuenta aunque no tenga el estado 2', () => {
    expect(esPresupuestoPrincipal(proy(30, 'MANUAL_PRESUPUESTO'))).toBe(true);
  });
  it('excluye otros estados de HETMO', () => {
    expect(esPresupuestoPrincipal(proy(30, 'HETMO'))).toBe(false);
    expect(esPresupuestoPrincipal(proy(105))).toBe(false);
    expect(esPresupuestoPrincipal(proy(1))).toBe(false);
  });
  it('nunca incluye una obra manual (no es un presupuesto)', () => {
    expect(esPresupuestoPrincipal(proy(2, 'MANUAL_OBRA'))).toBe(false);
  });
});
