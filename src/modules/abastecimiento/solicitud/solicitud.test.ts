import { describe, it, expect } from 'vitest';
import {
  categoriaDe,
  conteoCategorias,
  estadoInicialSolicitud,
  faltante,
  filasDesdeRequerimiento,
  itemsSolicitud,
  resumenSolicitud,
  validarSolicitud,
  type FilaSolicitud,
} from './solicitud';

const item = (materialId: string, cantidad: number, extra: Record<string, unknown> = {}) => ({
  materialId,
  descripcion: `Mat ${materialId}`,
  partida: { codigo: 'PER', nombre: 'Perfilería' },
  unidad: 'BARRA',
  cantidad,
  stockDisponible: 0,
  cantidadDesdeObrasMayores: 0,
  cantidadCalculada: null,
  precioUnitario: 1000,
  anchoMm: null,
  altoMm: null,
  ventanaId: null,
  referenciaVentana: null,
  sinMedidas: false,
  ...extra,
});

const requerimiento = {
  grupos: [
    { proveedorId: 'p1', proveedorNombre: 'Tecnocom', items: [item('perfil', 18), item('manilla', 24, { partida: { codigo: 'HER', nombre: 'Herrajes' }, unidad: 'UN' })] },
    { proveedorId: null, proveedorNombre: 'Sin proveedor', items: [item('vidrio', 1, { anchoMm: 1000, altoMm: 1200, ventanaId: 'v1', referenciaVentana: 'V01', unidad: 'UN' })] },
  ],
  trasladosDesdeObrasMayores: [],
} as any;

const stockObra = new Map([
  ['perfil', 4],
  ['manilla', 30],
]);
const stockOM = new Map([['perfil', 6]]);

describe('filasDesdeRequerimiento', () => {
  it('arma una fila por material con la necesidad bruta y el stock de ambas bodegas', () => {
    const filas = filasDesdeRequerimiento(requerimiento, stockObra, stockOM);
    expect(filas.map((f) => [f.clave, f.necesario, f.obra, f.obrasMayores, faltante(f)])).toEqual([
      ['perfil', 18, 4, 6, 8],
      ['manilla', 24, 30, 0, 0],
      ['vidrio:v1', 1, 0, 0, 1],
    ]);
  });
  it('filtra por partida cuando se pide desde una partida puntual', () => {
    expect(filasDesdeRequerimiento(requerimiento, stockObra, stockOM, 'HER').map((f) => f.clave)).toEqual(['manilla']);
  });
  it('clasifica lo cubierto con stock aparte de lo que falta', () => {
    const filas = filasDesdeRequerimiento(requerimiento, stockObra, stockOM);
    expect(filas.map(categoriaDe)).toEqual(['faltan', 'con-stock', 'faltan']);
    expect(conteoCategorias(filas)).toEqual({ todos: 3, faltan: 2, 'con-stock': 1 });
  });
});

describe('estado, resumen y envío', () => {
  const filas = filasDesdeRequerimiento(requerimiento, stockObra, stockOM);

  it('precarga "A pedir" con lo que falta y deja sin marcar lo que ya hay', () => {
    const estado = estadoInicialSolicitud(filas);
    expect(estado.perfil).toEqual({ marcada: true, cantidad: 8 });
    expect(estado.manilla).toEqual({ marcada: false, cantidad: 24 });
    expect(estado['vidrio:v1']).toEqual({ marcada: true, cantidad: 1 });
    expect(resumenSolicitud(filas, estado)).toEqual({ items: 2, unidades: 9, totalReferencial: 9000 });
  });

  it('manda solo lo marcado, con la pieza a medida y sin partida para lo del catálogo', () => {
    const estado = estadoInicialSolicitud(filas);
    const items = itemsSolicitud(filas, estado);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ materialId: 'perfil', cantidad: 8, unidadMedida: 'BARRA', precioUnitario: 1000, partidaId: undefined });
    expect(items[1]).toMatchObject({ materialId: 'vidrio', cantidad: 1, anchoMm: 1000, altoMm: 1200, ventanaId: 'v1', referenciaVentana: 'V01' });
  });

  it('un ítem de texto libre necesita partida; un adicional necesita su adicional', () => {
    const texto: FilaSolicitud = { clave: 'texto:1', descripcion: 'Flete', unidad: 'UN', necesario: 0, obra: 0, obrasMayores: 0, pieza: null, sinMedidas: false, precioReferencial: null, cantidadCalculada: null, origen: 'texto' };
    const estado = { 'texto:1': { marcada: true, cantidad: 1 } };
    expect(validarSolicitud([texto], estado, { adicional: false, adicionalId: '' })).toMatch(/partida/);
    expect(validarSolicitud([{ ...texto, partidaId: 'pa' }], estado, { adicional: true, adicionalId: '' })).toMatch(/adicional/);
    expect(validarSolicitud([{ ...texto, partidaId: 'pa' }], estado, { adicional: false, adicionalId: '' })).toBeNull();
    expect(validarSolicitud(filas, {}, { adicional: false, adicionalId: '' })).toMatch(/al menos un material/);
  });
});
