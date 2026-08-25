import type { Ventana, VentanaGeometria } from '../../../../types';

const num = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) || n <= 0 ? null : n;
};

export function toLegacyLine(ventana: Ventana): any {
  if (!ventana) return null;
  
  return {
    ancho: num(ventana.anchoMm) || num((ventana as any).ancho),
    alto: num(ventana.altoMm) || num((ventana as any).alto),
    ancho_mm: num(ventana.anchoMm) || num((ventana as any).ancho),
    alto_mm: num(ventana.altoMm) || num((ventana as any).alto),
    dibujo_ancho: num((ventana as any).dibujoAncho) || num(ventana.anchoMm) || num((ventana as any).ancho),
    dibujo_alto: num((ventana as any).dibujoAlto) || num(ventana.altoMm) || num((ventana as any).alto),
    uds: num(ventana.unidades) || num((ventana as any).uds),
    linea_hetmo: num(ventana.lineaHetmo) || num((ventana as any).linea_hetmo),
    dibujo_tipo_apertura: ventana.dibujoTipoApertura || (ventana as any).dibujo_tipo_apertura || (ventana as any).tipo_apertura,
    tipo_apertura: ventana.dibujoTipoApertura || (ventana as any).tipo_apertura,
    apertura: ventana.dibujoTipoApertura || (ventana as any).tipo_apertura || (ventana as any).apertura,
    acabado: ventana.acabadoCodigo || (ventana as any).acabado,
    acabado_descripcion: (ventana as any).acabadoDescripcion || (ventana as any).acabado_descripcion,
    acabado_patron: (ventana as any).acabadoPatron || (ventana as any).acabado_patron,
    geometria: ventana.geometrias?.length ? ventana.geometrias.map((g: VentanaGeometria) => ({
      ...g,
      numero_ventana: g.perteneceHueco || g.posicion || 1,
      orden: g.ordenGeometria,
      orden_geometria: g.ordenGeometria,
      tipo_elemento: num(g.tipoElemento),
      elemento: num(g.tipoElemento),
      tipo_geometria: num(g.tipoGeometria),
      ancho: num(g.anchoMm) || num((g as any).ancho),
      alto: num(g.altoMm) || num((g as any).alto),
      ancho_mm: num(g.anchoMm) || num((g as any).ancho),
      alto_mm: num(g.altoMm) || num((g as any).alto),
      tipo_apertura: num(g.tipoApertura),
      apertura: num(g.tipoApertura),
      posicion: g.posicion,
      pertenece_hueco: g.perteneceHueco,
      forma_codigo: num(g.formaCodigo),
      modificador_x: num(g.modificadorX),
      modificador_y: num(g.modificadorY),
    })) : ((ventana as any).geometria || []),
    materiales: ventana.materiales?.length ? ventana.materiales : ((ventana as any).materiales || [])
  };
}
