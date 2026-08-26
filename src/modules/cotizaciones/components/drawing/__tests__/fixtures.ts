import type { Ventana, VentanaGeometria, MaterialVentana } from '../../../../../types';

/**
 * Builders de fixtures tipados para las pruebas del pipeline de dibujo.
 * Cada builder rellena los campos obligatorios con valores neutros; los
 * tests sólo pasan lo que les importa para el caso que verifican.
 */

let idCounter = 0;
const nextId = () => `test-${++idCounter}`;

export function geometria(overrides: Partial<VentanaGeometria> = {}): VentanaGeometria {
  return {
    id: nextId(),
    ordenGeometria: 0,
    tipoElemento: null,
    tipoGeometria: null,
    numeroPuntos: null,
    anchoMm: null,
    altoMm: null,
    tipoApertura: null,
    posicion: null,
    perteneceHueco: null,
    numeroHoja: null,
    carril: null,
    formaCodigo: null,
    modificadorX: null,
    modificadorY: null,
    parametrosJson: null,
    ...overrides,
  };
}

export function material(overrides: Partial<MaterialVentana> = {}): MaterialVentana {
  return {
    id: nextId(),
    ventanaId: 'v',
    materialId: nextId(),
    cantidad: 1,
    longitudMm: null,
    piezas: null,
    acabado: null,
    precioOrigen: null,
    monedaOrigen: null,
    origen: 'HETMO',
    excluido: false,
    ...overrides,
  };
}

export function materialDescrito(descripcion: string, overrides: Partial<MaterialVentana> = {}): MaterialVentana {
  return material({ material: { id: nextId(), skuInterno: '', descripcion, familia: '', unidadMedida: '', proveedorId: null, creadoEn: '' }, ...overrides });
}

export function ventana(overrides: Partial<Ventana> = {}): Ventana {
  return {
    id: nextId(),
    versionId: 'version-test',
    lineaHetmo: 1,
    orden: 1,
    modelo: 'Ventana de prueba',
    descripcionCorta: null,
    unidades: 1,
    anchoMm: 1000,
    altoMm: 1000,
    m2Ventana: null,
    numeroCuadrosHojas: null,
    dibujoTipoApertura: null,
    acabadoCodigo: null,
    acabadoDescripcion: null,
    acabadoPatron: null,
    importeUnitario: null,
    descuentoLinea: null,
    comentarioPresupuesto: null,
    comentarioFabricacion: null,
    geometrias: [],
    materiales: [],
    ...overrides,
  };
}
