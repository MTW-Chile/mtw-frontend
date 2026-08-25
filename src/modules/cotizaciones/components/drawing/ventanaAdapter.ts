import type { Ventana, VentanaGeometria, MaterialVentana } from '../../../../types';

export function toLegacyLine(ventana: Ventana): any {
  if (!ventana) return null;
  
  return {
    ...ventana,
    ancho: ventana.anchoMm,
    alto: ventana.altoMm,
    uds: ventana.unidades,
    linea_hetmo: ventana.lineaHetmo,
    dibujo_tipo_apertura: ventana.dibujoTipoApertura,
    tipo_apertura: ventana.dibujoTipoApertura,
    apertura: ventana.dibujoTipoApertura,
    acabado: ventana.acabadoCodigo,
    geometria: (ventana.geometrias || []).map((g: VentanaGeometria) => ({
      ...g,
      // Mapeos críticos para el motor HETMO original
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
      apertura: g.tipoApertura, // apertura local del paño
      posicion: g.posicion,
      pertenece_hueco: g.perteneceHueco,
      forma_codigo: g.formaCodigo,
      modificador_x: g.modificadorX,
      modificador_y: g.modificadorY,
    })),
    materiales: (ventana.materiales || []).map((m: MaterialVentana) => ({
      ...m,
      // legacy code just checks m.codigo or description, wait... let's see what legacy expects from materiales
      // usually it checks material descriptions for hardware like handle, hinge, etc.
      // the V2 material type might not have the descriptions directly if they are just IDs.
      // We will copy them over as is for now.
    }))
  };
}
