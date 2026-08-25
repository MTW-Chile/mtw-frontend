import type { Ventana, VentanaGeometria } from '../../../../types';

export function toLegacyLine(ventana: Ventana): any {
  if (!ventana) return null;
  
  return {
    ancho: ventana.anchoMm || (ventana as any).ancho,
    alto: ventana.altoMm || (ventana as any).alto,
    ancho_mm: ventana.anchoMm || (ventana as any).ancho,
    alto_mm: ventana.altoMm || (ventana as any).alto,
    dibujo_ancho: ventana.anchoMm || (ventana as any).ancho, // Forzar que no sea 0 si viene de la BBDD
    dibujo_alto: ventana.altoMm || (ventana as any).alto,
    uds: ventana.unidades || (ventana as any).uds,
    linea_hetmo: ventana.lineaHetmo || (ventana as any).linea_hetmo,
    dibujo_tipo_apertura: ventana.dibujoTipoApertura || (ventana as any).dibujo_tipo_apertura || (ventana as any).tipo_apertura,
    tipo_apertura: ventana.dibujoTipoApertura || (ventana as any).tipo_apertura,
    apertura: ventana.dibujoTipoApertura || (ventana as any).tipo_apertura || (ventana as any).apertura,
    acabado: ventana.acabadoCodigo || (ventana as any).acabado,
    geometria: ventana.geometrias?.length ? ventana.geometrias.map((g: VentanaGeometria) => ({
      ...g,
      numero_ventana: g.perteneceHueco || g.posicion || 1,
      orden: g.ordenGeometria,
      orden_geometria: g.ordenGeometria,
      tipo_elemento: g.tipoElemento,
      elemento: g.tipoElemento,
      tipo_geometria: g.tipoGeometria,
      ancho: g.anchoMm,
      alto: g.altoMm,
      ancho_mm: g.anchoMm,
      alto_mm: g.altoMm,
      tipo_apertura: g.tipoApertura,
      apertura: g.tipoApertura,
      posicion: g.posicion,
      pertenece_hueco: g.perteneceHueco,
      forma_codigo: g.formaCodigo,
      modificador_x: g.modificadorX,
      modificador_y: g.modificadorY,
    })) : ((ventana as any).geometria || []),
    materiales: ventana.materiales?.length ? ventana.materiales : ((ventana as any).materiales || [])
  };
}
