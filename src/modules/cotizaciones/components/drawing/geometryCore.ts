// @ts-nocheck
/* Núcleo geométrico de MTW: interpreta componentes HETMO (paños, hojas,
   aperturas, barrotillos, travesaños) en estructuras genéricas, sin dibujar
   nada. Único consumidor confirmado: windowGeometryBuilder.ts /
   windowSvgMarkup.tsx (SVG, navegador). Ya no hay una segunda copia de este
   archivo en otro repo -- si eso cambia (por ejemplo, un generador de PDF en
   Python), ese consumidor nuevo debe llamar a esta misma lógica en vez de
   duplicarla.

   Acepta directamente los tipos de la app (WindowLine / VentanaGeometria[],
   camelCase) sin una capa de traducción intermedia: normalizeGeometryItem()
   hace el único ajuste de nombres que sigue siendo necesario (los campos de
   nivel 2 -- barrotillos, travesaños, cota, N1/N2, altura de manilla,
   curvatura -- no tienen columna propia y viven en parametrosJson bajo su
   nombre HETMO original en snake_case; ver comentario en normalizeGeometryItem). */

  'use strict';

  // Catálogo estructurado de aperturas HETMO. Esta es la fuente de verdad
  // compartida para etiquetas, símbolos y disposición de hojas. `confidence`
  // distingue reglas confirmadas con proyectos reales de respaldos prudentes:
  // una apertura desconocida nunca se inventa a partir de su número.
  //
  // En layouts correderos, `ext`/`int` indica el carril visto desde el dibujo
  // y left/right la dirección de desplazamiento. Las cotas HETMO reemplazan
  // estas proporciones cuando existen hojas tipo 40001 con medidas completas.
  // Catálogo SQL oficial de HETMO: mano, cantidad de hojas y secuencia de
  // carriles provienen de HT_DES_TIPO_APERTURA y C_DES_APERTURA_VENTANA.
  export const apertureCatalog = {
    0:  { family: 'fixed', label: 'Ventana fija', symbol: 'fixed', confidence: 'hetmo-fixed-code' },
    3:  { family: 'hinged', label: 'Practicable derecha · 1 hoja', symbol: 'hinged', hand: 'right', hinge: 'right', leafCount: 1, confidence: 'sql-catalog' },
    4:  { family: 'hinged', label: 'Practicable izquierda · 1 hoja', symbol: 'hinged', hand: 'left', hinge: 'left', leafCount: 1, confidence: 'sql-catalog' },
    6:  { family: 'hinged', label: 'Practicable derecha · 2 hojas', symbol: 'hinged', hand: 'right', hinge: 'right', leafCount: 2, confidence: 'sql-catalog' },
    7:  { family: 'hinged', label: 'Practicable izquierda · 2 hojas', symbol: 'hinged', hand: 'left', hinge: 'left', leafCount: 2, confidence: 'sql-catalog' },
    10: { family: 'tilt-turn', label: 'Oscilobatiente derecha · 1 hoja', symbol: 'tilt-turn', hand: 'right', hinge: 'right', tiltHinge: 'bottom', leafCount: 1, confidence: 'sql-catalog' },
    11: { family: 'tilt-turn', label: 'Oscilobatiente izquierda · 1 hoja', symbol: 'tilt-turn', hand: 'left', hinge: 'left', tiltHinge: 'bottom', leafCount: 1, confidence: 'sql-catalog' },
    13: { family: 'tilt-turn', label: 'Oscilobatiente derecha · 2 hojas', symbol: 'tilt-turn', hand: 'right', hinge: 'right', tiltHinge: 'bottom', leafCount: 2, confidence: 'sql-catalog' },
    14: { family: 'tilt-turn', label: 'Oscilobatiente izquierda · 2 hojas', symbol: 'tilt-turn', hand: 'left', hinge: 'left', tiltHinge: 'bottom', leafCount: 2, confidence: 'sql-catalog' },
    17: { family: 'door', label: 'Puerta practicable derecha · 1 hoja', symbol: 'hinged', hand: 'right', hinge: 'right', leafCount: 1, confidence: 'sql-catalog' },
    18: { family: 'door', label: 'Puerta practicable izquierda · 1 hoja', symbol: 'hinged', hand: 'left', hinge: 'left', leafCount: 1, confidence: 'sql-catalog' },
    20: { family: 'door', label: 'Puerta practicable derecha · 2 hojas', symbol: 'hinged', hand: 'right', hinge: 'right', leafCount: 2, confidence: 'sql-catalog' },
    21: { family: 'door', label: 'Puerta practicable izquierda · 2 hojas', symbol: 'hinged', hand: 'left', hinge: 'left', leafCount: 2, confidence: 'sql-catalog' },
    22: { family: 'tilt', label: 'Abatible', symbol: 'tilt', hinge: 'bottom', leafCount: 1, confidence: 'sql-catalog' },
    23: { family: 'projecting', label: 'Proyectante · 1 hoja', symbol: 'projecting', face: 'exterior', hinge: 'top', axis: 'vertical', leafCount: 1, confidence: 'sql-catalog' },
    25: { family: 'pivot', label: 'Pivotante horizontal', symbol: 'pivot-horizontal', confidence: 'sql-catalog' },
    26: { family: 'pivot', label: 'Pivotante vertical derecha', symbol: 'pivot-vertical', hand: 'right', confidence: 'sql-catalog' },
    27: { family: 'pivot', label: 'Pivotante vertical izquierda', symbol: 'pivot-vertical', hand: 'left', confidence: 'sql-catalog' },
    29: { family: 'sliding', label: 'Corredera 1 hoja derecha + fijo', symbol: 'sliding', hand: 'right', layout: ['fijo', 'int:left'], rails: ['ext', 'int'], confidence: 'sql-catalog' },
    30: { family: 'sliding', label: 'Corredera 1 hoja izquierda + fijo', symbol: 'sliding', hand: 'left', layout: ['int:right', 'fijo'], rails: ['int', 'ext'], confidence: 'sql-catalog' },
    32: { family: 'sliding', label: 'Corredera 2 hojas derecha', symbol: 'sliding', hand: 'right', layout: ['ext:right', 'int:left'], rails: ['ext', 'int'], confidence: 'sql-catalog' },
    33: { family: 'sliding', label: 'Corredera 2 hojas izquierda', symbol: 'sliding', hand: 'left', layout: ['int:right', 'ext:left'], rails: ['int', 'ext'], confidence: 'sql-catalog' },
    35: { family: 'sliding', label: 'Corredera 3 hojas Int-Fijo-Int', symbol: 'sliding', layout: ['int:right', 'fijo', 'int:left'], rails: ['int', 'ext', 'int'], confidence: 'sql-catalog' },
    // Carriles Int-Ext-Int y hojas corriendo hacia la izquierda. Verificado en
    // terreno contra dos lineas de este codigo fabricadas espejadas: ambas
    // declaran la misma secuencia de carriles y el mismo sentido, y lo unico
    // que cambia entre ellas es la configuración material de las hojas. La
    // altura de manilla nunca decide si una hoja es fija: N1/N2 y el catálogo
    // aportan la posición; los carros sólo confirman la cantidad operable.
    36: { family: 'sliding', label: 'Corredera 3 hojas Int-Ext-Int', symbol: 'sliding', layout: ['int:left', 'ext:left', 'int:left'], rails: ['int', 'ext', 'int'], confidence: 'sql-catalog-real-factory' },
    38: { family: 'sliding', label: 'Corredera 4 hojas Int-Ext-Ext-Int', symbol: 'sliding', layout: ['fijo', 'ext:left', 'ext:right', 'fijo'], rails: ['int', 'ext', 'ext', 'int'], confidence: 'sql-catalog' },
    41: { family: 'sliding', label: 'Corredera 4 hojas Ext-Int-Int-Ext', symbol: 'sliding', layout: ['fijo', 'int:left', 'int:right', 'fijo'], rails: ['ext', 'int', 'int', 'ext'], confidence: 'sql-catalog' },
    44: { family: 'sliding', label: 'Corredera 4 hojas Fijo-Int-Int-Fijo', symbol: 'sliding', layout: ['fijo', 'int:left', 'int:right', 'fijo'], rails: ['ext', 'int', 'int', 'ext'], confidence: 'sql-catalog' },
    46: { family: 'sliding', label: 'Corredera 6 hojas derecha', symbol: 'sliding', hand: 'right', layout: ['ext:right', 'int:right', 'ext:right', 'ext:left', 'int:left', 'ext:left'], rails: ['ext', 'int', 'ext', 'ext', 'int', 'ext'], confidence: 'sql-catalog-provisional-layout' },
    55: { family: 'parallel', label: 'Paralela izquierda', symbol: 'parallel', hand: 'left', confidence: 'sql-catalog-symbol-provisional' }
  };

  // Catálogo español C_DES_APERTURA_VENTANA. Se omiten deliberadamente las
  // familias Plegable, Guillotina y Contraventana. Los códigos cuyo texto es
  // sólo un número (106, 109, etc.) tampoco se interpretan: no contienen una
  // regla geométrica verificable.
  export const balancedSlidingLayout = count => Array.from({ length: count }, (_, index) => {
    if (count % 2 && index === Math.floor(count / 2)) return 'int:both';
    return index < count / 2 ? (index % 2 ? 'int:right' : 'ext:right') : (index % 2 ? 'int:left' : 'ext:left');
  });
  Object.assign(apertureCatalog, {
    47: { family: 'sliding', label: 'Corredera · 6 hojas', symbol: 'sliding', layout: balancedSlidingLayout(6), rails: ['ext', 'int', 'ext', 'ext', 'int', 'ext'], confidence: 'sql-label-provisional-layout' },
    54: { family: 'parallel', label: 'Corredera paralela derecha · 1 hoja', symbol: 'parallel', hand: 'right', leafCount: 1, confidence: 'sql-label' },
    57: { family: 'parallel', label: 'Corredera paralela derecha · 2 hojas', symbol: 'parallel', hand: 'right', leafCount: 2, confidence: 'sql-label' },
    58: { family: 'parallel', label: 'Corredera paralela izquierda · 2 hojas', symbol: 'parallel', hand: 'left', leafCount: 2, confidence: 'sql-label' },
    61: { family: 'lift-slide', label: 'Elevadora esquema A · Móvil-Fijo', symbol: 'sliding', layout: ['int:right', 'fijo'], rails: ['int', 'ext'], confidence: 'sql-label' },
    62: { family: 'lift-slide', label: 'Elevadora esquema A · Fijo-Móvil', symbol: 'sliding', layout: ['fijo', 'int:left'], rails: ['ext', 'int'], confidence: 'sql-label' },
    67: { family: 'lift-slide', label: 'Elevadora esquema D derecha · Móvil-Móvil', symbol: 'sliding', hand: 'right', layout: ['ext:right', 'int:left'], rails: ['ext', 'int'], confidence: 'sql-label' },
    68: { family: 'lift-slide', label: 'Elevadora esquema D izquierda · Móvil-Móvil', symbol: 'sliding', hand: 'left', layout: ['int:right', 'ext:left'], rails: ['int', 'ext'], confidence: 'sql-label' },
    452: { family: 'sliding', label: 'Corredera · 5 hojas', symbol: 'sliding', layout: balancedSlidingLayout(5), rails: ['ext', 'int', 'ext', 'int', 'ext'], confidence: 'sql-label-provisional-layout' },
    1336: { family: 'lift-slide', label: 'Elevadora esquema H · Móvil-Fijo-Móvil', symbol: 'sliding', layout: ['int:right', 'fijo', 'int:left'], rails: ['int', 'ext', 'int'], confidence: 'sql-label' }
  });

  // En los códigos ADENE "Deslizante ABC", A es el total de hojas y B/C
  // indican cuántas recogen a cada lado (B + C = A). El sufijo OB identifica
  // la hoja oscilobatiente independiente del grupo de una sola hoja.
  export const adeneSlidingLabels = {
    110081: 'Deslizante 321', 110082: 'Deslizante 312', 110084: 'Deslizante 321-OB', 110085: 'Deslizante 312-OB',
    110087: 'Deslizante 303', 110088: 'Deslizante 330', 110091: 'Deslizante 431', 110092: 'Deslizante 413',
    110094: 'Deslizante 431-OB', 110095: 'Deslizante 413-OB', 110097: 'Deslizante 532', 110098: 'Deslizante 523',
    111091: 'Deslizante 422', 112091: 'Deslizante 440', 113091: 'Deslizante 404',
    1100101: 'Deslizante 541', 1100102: 'Deslizante 514', 1100104: 'Deslizante 541-OB', 1100105: 'Deslizante 514-OB',
    1100107: 'Deslizante 505', 1100108: 'Deslizante 550', 1100110: 'Deslizante 633',
    1100114: 'Deslizante 651', 1100115: 'Deslizante 615', 1100117: 'Deslizante 651-OB', 1100118: 'Deslizante 615-OB',
    1100141: 'Deslizante 220', 1110110: 'Deslizante 660', 1110141: 'Deslizante 202',
    1120110: 'Deslizante 606', 1130110: 'Deslizante 642', 1140110: 'Deslizante 624'
  };
  Object.entries(adeneSlidingLabels).forEach(([code, label]) => {
    const match = label.match(/(\d)(\d)(\d)(-OB)?$/);
    if (!match) return;
    const total = Number(match[1]), left = Number(match[2]), right = Number(match[3]);
    if (left + right !== total) return;
    const layout = [
      ...Array.from({ length: left }, () => 'int:left'),
      ...Array.from({ length: right }, () => 'int:right')
    ];
    const obLeaf = match[4] ? (left === 1 ? 0 : right === 1 ? total - 1 : -1) : -1;
    apertureCatalog[code] = { family: 'adene-sliding', label, symbol: 'sliding', layout, rails: layout.map(() => 'int'), obLeaf, leafCount: total, confidence: 'sql-adene-pattern-provisional' };
  });
  export const sliderLayouts = Object.fromEntries(Object.entries(apertureCatalog)
    .filter(([, definition]) => Array.isArray(definition.layout))
    .map(([code, definition]) => [code, definition.layout]));
  export const hingedExteriorCodes = Object.entries(apertureCatalog)
    .filter(([, definition]) => definition.symbol === 'hinged')
    .map(([code]) => Number(code));
  export const hingedInteriorCodes = Object.entries(apertureCatalog)
    .filter(([, definition]) => definition.symbol === 'tilt-turn' || definition.symbol === 'tilt')
    .map(([code]) => Number(code));
  // Sin cotas de hoja, el respaldo es neutro y equidistante. Las proporciones
  // de una obra real nunca se convierten en una regla global del catálogo.
  export const sliderWeights = {};

  // Trazos normalizados (0..1) de las aperturas practicables. Mantenerlos en
  // el nucleo evita que SVG y el respaldo vectorial del PDF interpreten de
  // manera distinta una bisagra o inviertan el eje vertical.
  // El vertice del triangulo marca el lado de la MANILLA, y su base el de la
  // bisagra. Confirmado contra la ficha de fabrica de P6 (Vista Monsenor,
  // 900x2600, codigo 18 "practicable izquierda"): la bisagra va a la
  // izquierda y las diagonales convergen a la derecha, donde esta la manilla
  // a 1020mm. Un intento anterior invirtio estos puntos asumiendo que el
  // vertice marcaba la bisagra; la ficha lo desmiente.
  export function openingSymbolSegments(line, value) {
    const definition = apertureDefinition(line, value);
    if (definition.symbol === 'projecting') {
      // Proyectante: bisagra horizontal superior, apertura hacia el exterior.
      return [{ role: 'projecting', face: 'exterior', dashed: false, points: [[.08, .08], [.5, .92], [.92, .08]] }];
    }
    if (definition.symbol === 'tilt-turn') {
      // Oscilobatiente interior: giro lateral según la mano HETMO y oscilo
      // con bisagra inferior.
      return [
        { role: 'turn', dashed: false, points: definition.hinge === 'right' ? [[.94, .94], [.06, .5], [.94, .06]] : [[.06, .94], [.94, .5], [.06, .06]] },
        { role: 'tilt', face: 'interior', dashed: false, points: [[.06, .94], [.5, .06], [.94, .94]] }
      ];
    }
    if (definition.symbol === 'hinged') {
      return [{ role: 'turn', dashed: false, points: definition.hinge === 'right' ? [[.94, .94], [.06, .5], [.94, .06]] : [[.06, .94], [.94, .5], [.06, .06]] }];
    }
    if (definition.symbol === 'tilt') return [{ role: 'tilt', dashed: false, points: [[.06, .94], [.5, .5], [.94, .94]] }];
    if (definition.symbol === 'parallel') return [
      { role: 'parallel', dashed: false, points: [[.92, .5], [.08, .5], [.17, .42], [.08, .5], [.17, .58]] },
      { role: 'tilt', face: 'interior', dashed: false, points: [[.08, .92], [.5, .08], [.92, .92]] }
    ];
    if (definition.symbol === 'pivot-horizontal') return [{ role: 'pivot-horizontal', dashed: false, points: [[.08, .5], [.92, .5]] }];
    if (definition.symbol === 'pivot-vertical') return [{ role: 'pivot-vertical', dashed: false, points: [[.5, .08], [.5, .92]] }];
    return [];
  }

  export const number = value => Math.max(0, Number(value) || 0);
  export const firstPositive = function () {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = number(arguments[index]);
      if (value > 0) return value;
    }
    return 0;
  };
  // ─── Normalización de geometría ────────────────────────────────────────────
  // Un item de línea.geometria trae los campos tipados en camelCase
  // (tipoElemento, anchoMm, altoMm, tipoApertura, posicion, perteneceHueco,
  // numeroHoja, carril, formaCodigo, modificadorX, modificadorY,
  // ordenGeometria) más, cuando existen, los campos crudos de HETMO sin
  // columna propia (barrotillos_*, bh_*, cota, geometria_n1/n2,
  // altura_manilla, radio/angulo_curvatura, codigo_componente, orden_hoja)
  // bajo su nombre HETMO original en parametrosJson -- no tiene sentido
  // normalizarlos a camelCase porque no describen un concepto propio de esta
  // app, sino una fila HETMO tal cual.
  //
  // Idempotente a propósito: un paño de compositePanels() vuelve a pasar sus
  // propios items (ya normalizados) a otras funciones del núcleo, y esto no
  // debe duplicar ni perder nada la segunda vez.
  export function normalizeGeometryItem(item) {
    if (!item) return item;
    const params = (item.parametrosJson && typeof item.parametrosJson === 'object') ? item.parametrosJson : {};
    const perteneceHueco = item.perteneceHueco != null ? item.perteneceHueco : item.pertenece_hueco;
    // numero_ventana (a qué paño de una ventana compuesta pertenece esta fila)
    // y pertenece_hueco/perteneceHueco NO son el mismo dato, aunque el nombre
    // de la columna tipada sugiera lo contrario. Confirmado con datos reales
    // (Franklin Sánchez V01, HETMO 10200): las filas tipo 10000 que definen
    // cada paño traen pertenece_hueco=0 para las 5, pero numero_ventana
    // 1..5 correcto; en cambio sus filas hijas (travesaño tipo 6, vidrio
    // tipo 200) traen pertenece_hueco con la SUB-región dentro del paño
    // (marco=1, vidrio superior=2, vidrio inferior=4) -- un dato real pero
    // de otro nivel, no el número de paño. Confiar en pertenece_hueco para
    // agrupar paños hacía que esas filas hijas con valores 1/2/4 se
    // confundieran con paños reales y la ventana completa se descartara
    // como compuesta (compositePanels() no encontraba sus filas tipo 10000
    // agrupadas bajo ningún número real). numero_ventana crudo es el dato
    // que HETMO usa consistentemente para esto; se prioriza siempre que
    // venga poblado (>0). El respaldo de perteneceHueco/assignPanelNumbers
    // (ventanaAdapter.ts) sólo aplica cuando numero_ventana crudo falta.
    const numeroVentanaCrudo = params.numero_ventana;
    return {
      ...params,
      ...item,
      orden_geometria: item.ordenGeometria != null ? item.ordenGeometria : item.orden_geometria,
      tipo_elemento: item.tipoElemento != null ? item.tipoElemento : item.tipo_elemento,
      tipo_apertura: item.tipoApertura != null ? item.tipoApertura : item.tipo_apertura,
      apertura: item.tipoApertura != null ? item.tipoApertura : item.apertura,
      ancho: item.anchoMm != null ? item.anchoMm : item.ancho,
      alto: item.altoMm != null ? item.altoMm : item.alto,
      posicion: item.posicion,
      numero_ventana: numeroVentanaCrudo != null && Number(numeroVentanaCrudo) > 0 ? numeroVentanaCrudo
        : (perteneceHueco != null && perteneceHueco > 0 ? perteneceHueco : (item.numero_ventana != null ? item.numero_ventana : 1)),
      pertenece_hueco: perteneceHueco,
      forma_codigo: item.formaCodigo != null ? item.formaCodigo : item.forma_codigo,
      modificador_x: item.modificadorX != null ? item.modificadorX : item.modificador_x,
      modificador_y: item.modificadorY != null ? item.modificadorY : item.modificador_y,
      numero_hoja: item.numeroHoja != null ? item.numeroHoja : item.numero_hoja,
      carril: item.carril,
    };
  }
  export const geometryItemsOf = source => {
    const raw = Array.isArray(source) ? source : (source && (source.raw || source.geometria));
    return (Array.isArray(raw) ? raw : []).map(normalizeGeometryItem);
  };

  // HETMO nombra la cota de manilla de cuatro formas distintas segun por
  // donde salga la fila. El renderizador anterior (mtw-dashboard) las leia
  // todas; leer solo altura_manilla dejaba la manilla al centro en las lineas
  // que la declaran como cota_manilla.
  export function alturaManillaDe(item) {
    return firstPositive(
      item && item.altura_manilla,
      item && item.ALTURA_MANILLA,
      item && item.cota_manilla,
      item && item.COTA_MANILLA
    );
  }

  export function normalizedApertura(line, value) {
    const code = number(value);
    // La serie comercial nunca reemplaza el código real. Advance, Prime,
    // Prime 74 y Jumbo contienen múltiples TIPO_APERTURA en HETMO. Si llega
    // cero se conserva como apertura fija; si llega un código desconocido se
    // conserva para ampliar el catálogo sin convertirlo silenciosamente en 32.
    return code;
  }

  export function apertureDefinition(line, value) {
    const code = normalizedApertura(line, value);
    return apertureCatalog[code] || { code, family: 'unknown', label: '', symbol: 'unknown', confidence: 'unknown' };
  }

  // Sólo el elemento tipo 3 describe una hoja/apertura individual. Cuando no
  // existe (ventana fija normal), las filas restantes son marco, uniones y
  // cotas: tratarlas como hojas creaba separadores y paños falsos.
  export function sourceComponents(line) {
    const raw = geometryItemsOf(line);
    const openingRows = raw.filter(item => number(item && item.tipo_elemento) === 3);
    const components = openingRows.map((item, index) => ({
      orden: number(item && (item.orden != null ? item.orden : index)),
      posicion: number(item && (item.posicion != null ? item.posicion : index)),
      apertura: normalizedApertura(line, item && (item.apertura != null ? item.apertura : item.tipo_apertura)),
      // En algunos modelos HETMO conserva el ancho de hoja en COTA y no en
      // DIMEN_X. La cota se usa sólo cuando la dimensión directa no existe.
      ancho: firstPositive(item && item.ancho, item && item.ancho_mm, item && item.cota, item && item.cota_fija),
      alto: firstPositive(item && item.alto, item && item.alto_mm),
      geometria: String((item && (item.geometria != null ? item.geometria : item.numero_geometria)) != null ? (item.geometria != null ? item.geometria : item.numero_geometria) : index),
      // N1/N2 en la propia fila de apertura (tipo_elemento=3): confirmado
      // contrastando 200 líneas reales de varios proyectos -- en el
      // herraje "2 guías" (Advance/Prime, ambas hojas siempre móviles)
      // quedan en cero y HETMO usa N4 para otra cota; en el herraje
      // GU-M2C, que sí puede traer un paño realmente fijo, N1 marca qué
      // posición del layout (1=primera, 2=segunda) trae la única hoja
      // móvil real y N2 su ancho real en mm.
      movilLado: number(item && item.geometria_n1),
      movilAncho: firstPositive(item && item.geometria_n2),
      alturaManilla: alturaManillaDe(item)
    })).sort((a, b) => a.posicion - b.posicion || a.orden - b.orden);
    if (components.length) return components;
    return [{ apertura: normalizedApertura(line, line && (line.dibujoTipoApertura != null ? line.dibujoTipoApertura : line.tipoApertura)), ancho: 0, alto: 0, geometria: 'principal' }];
  }

  // Algunas líneas no son un solo rectángulo: HETMO registra cada paño con
  // NUMERO_VENTANA y sus cotas (ej. un proyectante sobre un fijo). Esta
  // lectura respeta esas cotas en vez de inventar paños iguales.
  export function compositePanels(line) {
    const raw = geometryItemsOf(line);
    const groups = new Map();
    raw.forEach((item, index) => {
      const panelNumber = number(item && item.numero_ventana);
      if (!panelNumber) return;
      if (!groups.has(panelNumber)) groups.set(panelNumber, { number: panelNumber, order: index, width: 0, height: 0, apertura: 0, aperturaCount: 0, raw: [] });
      const panel = groups.get(panelNumber);
      panel.raw.push(item);
      panel.order = Math.min(panel.order, number(item && item.orden_geometria != null ? item.orden_geometria : index));
      const tipo = number(item && item.tipo_elemento);
      if (tipo === 10000) {
        panel.width = firstPositive(item.ancho, item.ancho_mm, panel.width);
        panel.height = firstPositive(item.alto, item.alto_mm, panel.height);
      }
      // HETMO puede registrar una puerta abatible de dos hojas dentro de un
      // mismo paño como dos filas tipo 3 (una por hoja). Se conserva la
      // última apertura como valor representativo del paño (compatibilidad
      // con el resto de esta función) y además se cuenta cuántas filas de
      // apertura hubo, para que el dibujo pueda distinguir una puerta de una
      // hoja de una de dos sin inventar una partición donde HETMO no la deja.
      if (tipo === 3) {
        panel.apertura = normalizedApertura(line, item.tipo_apertura);
        panel.aperturaCount += 1;
        // N1/N2 de la fila de apertura de ESTE paño: es lo que declara si el
        // paño trae un fijo (ver slidingPieces). Sin conservarlo aquí, la
        // ruta compuesta no tenía forma de saberlo.
        panel.movilLado = number(item.geometria_n1);
        panel.movilAncho = firstPositive(item.geometria_n2);
        panel.alturaManilla = alturaManillaDe(item);
      }
    });
    const panels = [...groups.values()].filter(panel => panel.width > 0 && panel.height > 0).sort((a, b) => a.number - b.number || a.order - b.order);
    if (panels.length < 2) return null;
    // HETMO puede dejar una sola fila tipo 3 para una puerta abatible de dos
    // hojas dentro de un paño compuesto -- igual que en una línea simple (ver
    // declaredLeaves en leavesFor), pero ese respaldo nunca se extendió acá.
    // Confirmado en terreno (Franklin Sánchez, V02): NUMERO_CUADROS_HOJAS=2 a
    // nivel de línea, un solo paño con apertura (código 21) y una sola fila
    // tipo 3 en ese paño -- sin esto se dibujaba como una única bisagra
    // gigante en vez de dos puertas independientes.
    const declaredLeaves = number(line && (line.numeroCuadrosHojas != null ? line.numeroCuadrosHojas : line.cantidadVidriosPorUnidad));
    const openingPanels = panels.filter(panel => panel.aperturaCount > 0);
    if (openingPanels.length === 1 && openingPanels[0].aperturaCount === 1 && declaredLeaves === 2
      && apertureDefinition(line, openingPanels[0].apertura).leafCount === 2) {
      openingPanels[0].aperturaCount = 2;
    }
    // La orientación se determina contra la medida total de la línea: un
    // conjunto de N paños puede apilarse en horizontal o en vertical según
    // cuál combinación efectivamente suma el ancho/alto declarado.
    const lineWidth = firstPositive(line && line.dibujoAncho, line && line.ancho);
    const lineHeight = firstPositive(line && line.dibujoAlto, line && line.alto);
    const widthError = lineWidth ? Math.abs(panels.reduce((sum, panel) => sum + panel.width, 0) - lineWidth) : Number.POSITIVE_INFINITY;
    const heightError = lineHeight ? Math.abs(panels.reduce((sum, panel) => sum + panel.height, 0) - lineHeight) : Number.POSITIVE_INFINITY;
    const verticalCuts = [...new Set(raw
      .filter(item => number(item && item.tipo_elemento) === 6)
      .map(item => firstPositive(item.cota, item.cota_fija))
      .filter(cut => cut > 0 && cut < lineWidth))].sort((a, b) => a - b);
    const tolerance = value => Math.max(3, value * .006);
    const unused = new Set(panels.map(panel => panel.number));
    const columns = [];
    for (const panel of panels) {
      if (!unused.has(panel.number)) continue;
      const column = [panel]; unused.delete(panel.number);
      let columnHeight = panel.height;
      if (lineHeight && Math.abs(columnHeight - lineHeight) > tolerance(lineHeight)) {
        for (const candidate of panels) {
          if (!unused.has(candidate.number) || Math.abs(candidate.width - panel.width) > tolerance(panel.width)) continue;
          if (columnHeight + candidate.height <= lineHeight + tolerance(lineHeight)) {
            column.push(candidate); unused.delete(candidate.number); columnHeight += candidate.height;
          }
          if (Math.abs(columnHeight - lineHeight) <= tolerance(lineHeight)) break;
        }
      }
      columns.push(column);
    }
    const packedWidth = columns.reduce((sum, column) => sum + Math.max(...column.map(panel => panel.width)), 0);
    const packedHeightValid = columns.every(column => !lineHeight || Math.abs(column.reduce((sum, panel) => sum + panel.height, 0) - lineHeight) <= tolerance(lineHeight));
    if (!packedHeightValid || (lineWidth && Math.abs(packedWidth - lineWidth) > tolerance(lineWidth))) return null;
    let packedX = 0;
    const tiles = [];
    columns.forEach(column => {
      const columnWidth = Math.max(...column.map(panel => panel.width));
      let packedY = 0;
      column.sort((a, b) => a.number - b.number).forEach(panel => {
        tiles.push({ panel, x: packedX, y: packedY, width: columnWidth, height: panel.height });
        packedY += panel.height;
      });
      packedX += columnWidth;
    });
    return {
      panels, tiles,
      width: lineWidth || packedWidth,
      height: lineHeight || Math.max(...columns.map(column => column.reduce((sum, panel) => sum + panel.height, 0))),
      direction: widthError <= heightError ? 'horizontal' : 'vertical',
      verticalCuts
    };
  }

  // Hojas exactas (elemento 40001) declaradas por HETMO para un componente
  // corredizo: sólo un paño con herraje móvil real genera este componente
  // en el despiece; un paño fijo queda como vidrio suelto (40000) sin hoja.
  export function collectExactLeaves(rawItems) {
    const map = new Map();
    geometryItemsOf(rawItems).filter(item => number(item && item.tipo_elemento) === 40001 && firstPositive(item.ancho) > 0).forEach(item => {
      const key = [number(item.numero_ventana), number(item.numero_hoja), number(item.orden_hoja), firstPositive(item.ancho), firstPositive(item.alto)].join('|');
      if (!map.has(key)) map.set(key, item);
    });
    return [...map.values()].sort((a, b) => number(a.numero_ventana) - number(b.numero_ventana) || number(a.orden_hoja) - number(b.orden_hoja) || number(a.numero_hoja) - number(b.numero_hoja));
  }

  export function railForLeaf(leaf, definition, index) {
    const explicit = number(leaf && (leaf.carril != null ? leaf.carril : leaf.CARRIL_CORREDERA));
    if (explicit > 0) return { number: explicit, source: String(leaf.carrilFuente || leaf.carril_fuente || 'hetmo') };
    const legacy = definition && Array.isArray(definition.rails) ? definition.rails[index] : String(leaf && leaf.kind || '').split(':')[0];
    if (legacy === 'int') return { number: 1, source: 'catalog-fallback' };
    if (legacy === 'ext') return { number: 2, source: 'catalog-fallback' };
    return { number: 0, source: 'unknown' };
  }

  // El sistema de corredera también está declarado por los perfiles de la
  // propia línea. Por ejemplo, Prime y Jumbo pueden traer literalmente
  // "MARCO 3 GUIAS". Esta señal es más específica que el nombre comercial
  // de la serie y sigue disponible aunque la obra aún no tenga mecanizados.
  export function sliderGuideCount(source) {
    const texts = [];
    const add = value => { if (value != null && String(value).trim()) texts.push(String(value)); };
    const line = source && source.linea && typeof source.linea === 'object' ? source.linea : null;
    ['seriePerfiles', 'modelo'].forEach(key => add(line && line[key]));
    (Array.isArray(source && source.materiales) ? source.materiales : []).forEach(item => {
      add(item && (item.descripcionArticulo ?? item.descripcion));
    });
    let count = 0;
    texts.forEach(text => {
      const match = text.match(/\b([123])\s*(?:gu[ií]as?|carriles?)\b/i);
      if (match) count = Math.max(count, number(match[1]));
    });
    return count;
  }

  // Cuando existen tantas hojas como guías y todas recogen hacia un mismo
  // lado, el orden físico es determinista: al recoger a la izquierda la hoja
  // izquierda queda en C3 (más profunda) y la derecha en C1 (más próxima);
  // hacia la derecha se espeja. Un CARRIL_CORREDERA explícito prevalece y
  // desactiva por completo esta reconstrucción.
  export function applySliderGuideRails(pieces, source) {
    const list = Array.isArray(pieces) ? pieces : [];
    if (list.some(piece => number(piece && piece.carril) > 0)) return list;
    const guideCount = sliderGuideCount(source);
    if (guideCount < 3 || list.length !== guideCount) return list;
    const directions = [...new Set(list
      .filter(piece => piece && piece.kind !== 'fijo')
      .map(piece => String(piece.kind || '').split(':')[1])
      .filter(direction => direction === 'left' || direction === 'right'))];
    if (directions.length !== 1) return list;
    const rails = directions[0] === 'left'
      ? Array.from({ length: guideCount }, (_, index) => guideCount - index)
      : Array.from({ length: guideCount }, (_, index) => index + 1);
    return list.map((piece, index) => ({
      ...piece, carril: rails[index], carrilFuente: `perfil-marco-${guideCount}-guias+sentido-apertura`
    }));
  }

  // Cuando su cantidad calza exactamente con el layout esperado del código
  // de apertura, los anchos reales de estas hojas reemplazan la repartición
  // proporcional habitual.
  export function exactLeavesFor(rawItems, layoutLength, totalWidth) {
    const leaves = collectExactLeaves(rawItems);
    if (leaves.length !== layoutLength) return null;
    // HETMO a veces declara el mismo ancho generico para todas las hojas de
    // una corredera en vez de la medida real por hoja (visto en Casa La
    // Aurora V03A, HETMO 10335, apertura 36: 3 hojas "exactas" de 1393,30mm
    // cada una, sumando 4179,9mm contra un ANCHO real de 4100mm -- ninguna
    // corredera física tiene ~80mm de holgura ahí). El numero de hojas
    // puede ser correcto sin que el ancho lo sea: si la suma no calza con
    // el ancho total conocido de la linea (misma tolerancia que usa el
    // servidor al validar el corrector), esos anchos no son confiables y el
    // llamador cae al reparto proporcional en su lugar.
    if (totalWidth > 0) {
      const sum = leaves.reduce((total, leaf) => total + firstPositive(leaf.ancho, leaf.ancho_mm), 0);
      if (Math.abs(sum - totalWidth) > Math.max(3, totalWidth * 0.001)) return null;
    }
    return leaves;
  }

  // Movimiento que le corresponde a un paño según su posición dentro del
  // layout del código. Se lee del propio layout en vez de mantener una
  // tabla paralela por código: si esa posición ya venía marcada fija se
  // toma el primer movimiento declarado del layout.
  export function mobileKindAt(layout, position) {
    const atPosition = layout[position - 1];
    if (atPosition && atPosition !== 'fijo') return atPosition;
    // Esa posición venía marcada fija: la línea real tiene el fijo del otro
    // lado. Se conserva el carril declarado (int/ext) pero se espeja el
    // sentido, porque una hoja corre hacia el paño fijo y ese paño acaba de
    // cambiar de lado.
    const declared = layout.find(kind => kind !== 'fijo') || 'int:left';
    return declared.endsWith(':left') ? declared.replace(':left', ':right')
      : declared.endsWith(':right') ? declared.replace(':right', ':left')
      : declared;
  }

  // Un código de dos hojas puede fabricarse en la práctica con una sola
  // hoja móvil real y un paño fijo del lado contrario al que asume el
  // código HETMO -- confirmado con la ficha de fábrica real de V2H1
  // (código 32: un solo riel Ext. móvil y un paño Int. fijo más ancho, sin
  // flecha). Se reconstruye a partir de la única hoja real que sí declaró
  // el despiece. orden_hoja ordena de izquierda a derecha -- misma
  // convención que ya usa collectExactLeaves para repartir varias hojas --
  // y decide de qué lado queda esa hoja real.
  export function reconcileSingleLeafSlider(rawItems) {
    const leaves = collectExactLeaves(rawItems);
    if (leaves.length !== 1) return null;
    const leaf = leaves[0];
    return { leaf, side: number(leaf.orden_hoja || leaf.posicion) <= 1 ? 'left' : 'right' };
  }

  // ÚNICA resolución de hojas de una corredera, compartida por la línea
  // simple y por cada paño de una composición. Existían dos caminos de
  // dibujo -- build() y buildComposite() -- y sólo el primero pasaba por
  // acá: las ventanas compuestas leían sliderLayouts crudo del catálogo y
  // se saltaban toda la detección de paño fijo. Por eso una misma
  // corrección arreglaba unas líneas y dejaba otras igual.
  //
  // Que un paño sea fijo lo declara N1/N2 de su propia fila de apertura:
  // N2 es el ancho de la ÚNICA hoja móvil y N1 su posición (1..N); el
  // resto va fijo. Verificado contra las 8 líneas de Portal Las Pataguas
  // que lo traen, cruzando N2 con los anchos reales del despiece: V2H1
  // 1500|2162 N2=1500, V3A1 2522|1500 N2=1500, V5b 1248|510 N2=510, V12a
  // 830|2348 N2=830. Sin N1 no hay fijo, lo que reproduce la ficha de V8A1
  // (764|764, dos móviles) y explica que V8A1 y V3A1 compartan el código 33
  // con configuraciones distintas.
  //
  // La manilla no sirve para distinguir: las correderas dejan
  // ALTURA_MANILLA en cero (sólo puertas y practicables la declaran).
  // Cantidad de hojas MOVILES segun los herrajes que HETMO factura para la
  // linea. Es el unico dato que distingue un paño fijo de uno movil cuando
  // el codigo de apertura no lo declara.
  //
  // Confirmado con dos lineas de Portal Las Pataguas que son identicas en
  // todo lo demas -- mismo codigo 33, mismo herraje GU-M2C-V-0001, mismas
  // dos hojas de igual ancho, mismos perfiles -- y distinta configuracion de
  // fabrica:
  //   V1A1 (9566): 2 carros, 1 manilla, 1 seguro  -> 1 hoja movil + 1 fijo
  //   V8A1 (9582): 4 carros, 2 manillas, 2 seguros -> 2 hojas moviles
  // La ficha de fabrica de V8A1 confirma sus dos hojas moviles.
  //
  // Una hoja fija no lleva carro: va atornillada. El articulo lo dice
  // explicito ("CARRO ... 70KG/HOJA") y vienen dos por hoja. La manilla
  // sirve de contraste porque hay una por hoja operable.
  export function mobileLeavesFromHardware(materials, unidades) {
    if (!Array.isArray(materials) || !materials.length) return 0;
    // `cantidad` viene multiplicada por las unidades de la linea
    // (SUM(d.UDS * l.UDS) en la consulta de materiales), asi que hay que
    // dividir para saber cuantos herrajes lleva UNA ventana.
    const perWindow = Math.max(1, number(unidades) || 1);
    let carros = 0;
    materials.forEach(item => {
      const text = String((item && (item.descripcionArticulo ?? item.descripcion)) || '');
      const total = number(item && (item.cantidad != null ? item.cantidad : item.uds));
      if (total <= 0) return;
      const units = total / perWindow;
      // "CALZO CARRO VENTO ..." es el suplemento del carro, no un carro: si
      // se cuenta duplica el total y una corredera con fijo aparece como de
      // dos hojas moviles. Confirmado en Gorbea, donde la linea trae 48 de
      // "CARRO VENTO SIMP VE180" y otros 48 de su calzo.
      if (/\bcarro\b/i.test(text) && !/\bcalzo\b/i.test(text)) carros += units;
    });
    // Dos carros por hoja movil. Se redondea porque la cantidad viene como
    // decimal y una linea puede traer herrajes compartidos.
    if (carros >= 1.5) return Math.max(1, Math.round(carros / 2));
    return 0;
  }

  export function sliderHardware(leaves) {
    const list = Array.isArray(leaves) ? leaves : [];
    const rail = leaf => {
      const explicit = number(leaf && (leaf.carril != null ? leaf.carril : leaf.CARRIL_CORREDERA));
      return explicit > 0 ? `C${explicit}` : String(leaf && leaf.kind || '').split(':')[0];
    };
    const direction = leaf => String(leaf && leaf.kind || '').split(':')[1] || '';
    return list.map((leaf, index) => {
      if (!leaf || leaf.kind === 'fijo' || leaf.kind === 'oculta' || leaf.oculta) return { role: 'none', reason: leaf && (leaf.kind === 'oculta' || leaf.oculta) ? 'mtw-hidden-space' : 'catalog-fixed', rail: 'fixed' };
      const leafRail = rail(leaf), move = direction(leaf);
      if (move === 'both') return { role: 'none', reason: 'two-directions-no-closing-edge', rail: leafRail };
      const closingSide = move === 'left' ? 'right' : 'left';
      const neighborIndex = closingSide === 'left' ? index - 1 : index + 1;
      if (neighborIndex < 0 || neighborIndex >= list.length) {
        return { role: 'handle', style: 'straight', side: closingSide, reason: 'closes-against-frame', rail: leafRail };
      }
      const neighbor = list[neighborIndex], neighborRail = rail(neighbor), neighborMove = direction(neighbor);
      // El reparto activa/pasiva sólo existe cuando dos hojas se encuentran
      // en el mismo carril. Una hoja nunca puede cerrar su cremona contra el
      // canto de otra hoja situada en un carril diferente.
      const reciprocal = list.length > 2 && neighbor && neighbor.kind !== 'fijo' && neighborRail === leafRail
        && ((closingSide === 'right' && neighborMove === 'right') || (closingSide === 'left' && neighborMove === 'left'));
      // Si el canto de cierre queda frente a una hoja de otro carril, no se
      // inventa manilla ni cerradero. Es el caso de las hojas interiores de
      // la apertura 36 (Int-Ext-Int). Sólo un borde exterior llega realmente
      // al marco; ese caso ya se resolvió arriba como closes-against-frame.
      if (neighbor && neighborRail !== leafRail) return { role: 'none', reason: 'different-rail-no-closing-point', rail: leafRail };
      if (!reciprocal) return { role: 'handle', style: 'straight', side: closingSide, reason: 'same-rail-closing-edge', rail: leafRail };
      // En un encuentro recíproco del mismo carril una hoja es activa y la
      // otra pasiva. La activa es la de mayor índice visual; la pasiva lleva
      // cerradero, no una segunda manilla inventada.
      return index > neighborIndex
        ? { role: 'handle', style: 'straight', side: closingSide, reason: 'same-rail-active-meeting', rail: leafRail }
        : { role: 'striker', style: 'angled', side: closingSide, reason: 'same-rail-passive-meeting', rail: leafRail };
    });
  }

  export function hingeCountFromHardware(materials, unidades, operableLeaves) {
    if (!Array.isArray(materials) || !materials.length) return { count: 0, reason: 'no-hardware-data' };
    const perWindow = Math.max(1, number(unidades) || 1);
    const leafCount = Math.max(1, number(operableLeaves) || 1);
    let total = 0;
    materials.forEach(item => {
      const text = String((item && (item.descripcionArticulo ?? item.descripcion)) || '');
      if (!/\b(bisagra|pernio)\b/i.test(text)) return;
      total += number(item && (item.cantidad != null ? item.cantidad : item.uds)) / perWindow;
    });
    const count = total > 0 ? Math.max(1, Math.round(total / leafCount)) : 0;
    return { count, reason: count ? 'hardware-quantity-per-leaf' : 'no-hinge-hardware' };
  }

  // Color del herraje. Ya no sigue el color del perfil ni el que declare la
  // descripcion del articulo: hoy solo hay dos herrajes en catalogo, blanco y
  // negro. Blanco unicamente cuando el acabado es blanco; en cualquier otro
  // acabado el herraje es negro.
  export const HARDWARE_WHITE = '#eef1f4';
  export const HARDWARE_BLACK = '#1c1f24';

  // Luminancia relativa del acabado del marco: sirve para reconocer un blanco
  // real sin tener que enumerar cada codigo de acabado que exista.
  function relativeLuminance(hex) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!match) return 0;
    const value = parseInt(match[1], 16);
    const channel = raw => {
      const c = raw / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel((value >> 16) & 255)
      + 0.7152 * channel((value >> 8) & 255)
      + 0.0722 * channel(value & 255);
  }

  // Un herraje MONOBLOCK trae cerradura con cilindro integrado, no solo la
  // manilla: cuando la receta lo declara asi, el dibujo lo muestra.
  export function hasMonoblock(materials) {
    return (Array.isArray(materials) ? materials : []).some(item =>
      /\bmonoblock\b/i.test(String((item && (item.descripcionArticulo ?? item.descripcion)) || ''))
    );
  }

  export function hardwareColor(materials, frameColor) {
    return relativeLuminance(frameColor) >= 0.8 ? HARDWARE_WHITE : HARDWARE_BLACK;
  }

  export function handleHeightFor(line, leaf, physicalHeight) {
    const geometryItems = geometryItemsOf(line);
    // Barrer TODA la geometria de la linea en busca de una cota de manilla
    // sólo es seguro cuando la linea tiene a lo sumo una hoja real (una fila
    // tipo_elemento=3): con varias hojas -- ej. un compuesto de un paño
    // practicable con manilla a medida junto a un paño fijo, o una
    // corredera -- ese barrido tomaba el altura_manilla de UNA hoja y lo
    // aplicaba a TODAS las demas de la misma linea, mostrando la cota en
    // hojas que en realidad van al centro. Con mas de una hoja, cada leaf
    // debe traer su propio alturaManilla ya resuelto (sourceComponents,
    // compositePanels, o el .component compartido que arma leavesFor() para
    // una corredera) -- sin eso, se cae a centro, nunca se adivina.
    const openingRowCount = geometryItems.filter(item => number(item && item.tipo_elemento) === 3).length;
    const geometryCustom = geometryItems.length && openingRowCount <= 1
      ? firstPositive(...geometryItems.map(alturaManillaDe))
      : 0;
    const custom = firstPositive(leaf && leaf.alturaManilla, leaf && leaf.altura_manilla,
      leaf && leaf.component && leaf.component.alturaManilla,
      line && line.alturaManilla,
      geometryCustom);
    const height = Math.max(1, number(physicalHeight) || (line && line.alto) || 1);
    // ALTURA_MANILLA se mide desde la base. Cuando HETMO la informa, manilla
    // y vértice de apertura comparten esa cota; si falta, ambos quedan al
    // centro. El clamp evita que una cota inválida saque el herraje del marco.
    if (custom > 0) {
      const millimeters = Math.max(0, Math.min(height, custom));
      return { millimeters, reason: 'hetmo-custom', reportedMillimeters: millimeters };
    }
    return { millimeters: height / 2, reason: 'center-default', reportedMillimeters: 0 };
  }

  export function slidingPieces(source) {
    const layout = sliderLayouts[source.apertura];
    if (!layout) return null;
    const totalWidth = Math.max(1, number(source.width) || 1);
    const collectedLeaves = collectExactLeaves(source.raw);
    // Mismo caso que exactLeavesFor: HETMO puede declarar el mismo ancho
    // generico para todas las hojas en vez de la medida real por hoja
    // (Casa La Aurora, apertura 36: 3 hojas "exactas" de 1393,30mm cada
    // una, sumando 4179,9mm contra un ANCHO real de 4100mm). Si la suma no
    // calza con el ancho conocido de la linea, esas hojas no son
    // confiables para ninguna de las ramas de abajo -- se descartan aca,
    // antes de usarlas, en vez de en exactLeavesFor (que esta funcion ni
    // siquiera llega a ejecutar si esta responde primero).
    const collectedSum = collectedLeaves.reduce((sum, leaf) => sum + firstPositive(leaf.ancho, leaf.ancho_mm), 0);
    const realLeaves = collectedLeaves.length && Math.abs(collectedSum - totalWidth) <= Math.max(3, totalWidth * 0.001)
      ? collectedLeaves : [];
    const mobileWidth = firstPositive(source.movilAncho);
    const mobileSlot = number(source.movilLado);
    const base = { apertura: source.apertura, exacta: true };
    if (mobileSlot >= 1 && mobileSlot <= layout.length && mobileWidth > 0) {
      const widths = realLeaves.length === layout.length
        ? realLeaves.map(leaf => firstPositive(leaf.ancho, leaf.ancho_mm))
        : null;
      const fixedShare = Math.max(1, (totalWidth - mobileWidth) / Math.max(1, layout.length - 1));
      return applySliderGuideRails(layout.map((_, index) => {
        const position = index + 1;
        const mobile = position === mobileSlot;
        const width = widths ? widths[index] : (mobile ? mobileWidth : fixedShare);
        const exact = realLeaves[index];
        return { ...base, kind: mobile ? mobileKindAt(layout, position) : 'fijo', width: width > 0 ? width : fixedShare,
          carril: number(exact && exact.carril), carrilFuente: String(exact && exact.carril_fuente || '') };
      }), source);
    }
    // ALTURA_MANILLA es sólo una cota: cero o ausencia significa altura
    // estándar al centro, nunca hoja fija. Sin N1, los herrajes dicen cuántas
    // hojas se mueven. Si son menos que
    // los paños del layout, las restantes van fijas. Los paños fijos se
    // ubican a la izquierda: es lo confirmado en V1A1 (fijo izquierda) y en
    // la ficha de V03A. Cuando el propio catalogo ya declara posiciones
    // fijas y su cantidad calza, se respetan esas.
    const mobileCount = mobileLeavesFromHardware(source.materiales, source.unidades);
    if (mobileCount > 0 && mobileCount < layout.length) {
      const catalogFixed = layout.reduce((total, kind) => kind === 'fijo' ? total + 1 : total, 0);
      const fixedCount = layout.length - mobileCount;
      const useCatalogPositions = catalogFixed === fixedCount;
      const widths = realLeaves.length === layout.length
        ? realLeaves.map(leaf => firstPositive(leaf.ancho, leaf.ancho_mm))
        : null;
      return applySliderGuideRails(layout.map((kind, index) => {
        const position = index + 1;
        const mobile = useCatalogPositions ? kind !== 'fijo' : position > fixedCount;
        const width = widths ? widths[index] : Math.max(1, totalWidth / layout.length);
        const exact = realLeaves[index];
        return { ...base, kind: mobile ? mobileKindAt(layout, position) : 'fijo', width: width > 0 ? width : Math.max(1, totalWidth / layout.length),
          carril: number(exact && exact.carril), carrilFuente: String(exact && exact.carril_fuente || '') };
      }), source);
    }
    // Sin N1 ni herrajes concluyentes: se respeta el layout del código, con
    // los anchos reales del despiece cuando la cantidad de hojas calza.
    if (realLeaves.length === layout.length) {
      return applySliderGuideRails(realLeaves.map((leaf, index) => ({
        ...base, kind: layout[index],
        width: firstPositive(leaf.ancho, leaf.ancho_mm) || Math.max(1, totalWidth / layout.length),
        altura: firstPositive(leaf.alto, leaf.alto_mm),
        carril: number(leaf.carril), carrilFuente: String(leaf.carril_fuente || '')
      })), source);
    }
    return null;
  }

  function correctedKind(kind, movement) {
    if (movement === 'oculta') return 'oculta';
    if (movement === 'fija') return 'fijo';
    const prefix = /^(int|ext):/.test(String(kind || '')) ? String(kind).split(':')[0] : 'int';
    const dirMap = { izquierda: 'left', derecha: 'right', ambos: 'both' };
    return `${prefix}:${dirMap[movement] || 'left'}`;
  }

  export function correctedLeaves(line, baseLeaves) {
    const correction = line && (line.correccionGeometria || line.correccion_geometria);
    if (!correction || !Array.isArray(correction.hojas) || !correction.hojas.length) return baseLeaves;
    const byIndex = new Map(correction.hojas.map(item => [number(item.indice), item]));
    return baseLeaves.map((leaf, index) => {
      const item = byIndex.get(index);
      if (!item) return leaf;
      const hidden = item.movimiento === 'oculta' || number(item.carril) === 0;
      return {
        ...leaf,
        width: number(item.ancho) > 0 ? number(item.ancho) : leaf.width,
        apertura: number(correction.apertura || leaf.apertura),
        kind: correctedKind(leaf.kind, item.movimiento),
        carril: hidden ? 0 : number(item.carril),
        oculta: hidden,
        carrilFuente: 'mtw-project-version-correction'
      };
    });
  }

  export function isSlidingLine(line) {
    if (!line) return false;
    const composite = compositePanels(line);
    if (composite) {
      return composite.panels.some(panel => apertureDefinition(line, panel.apertura).symbol === 'sliding');
    }
    const def = apertureDefinition(line, line.tipoApertura || line.dibujoTipoApertura);
    if (def && def.symbol === 'sliding') return true;
    const rawLeaves = leavesFor(line);
    return rawLeaves.some(leaf => apertureDefinition(line, leaf.apertura).symbol === 'sliding');
  }

  export function leavesFor(line) {
    const correction = line && (line.correccionGeometria || line.correccion_geometria);
    const computeBaseLeaves = () => {
      const components = sourceComponents(line);
      const fallbackWidth = Math.max(1, (line && line.ancho) || 1);
      const rawGeometry = geometryItemsOf(line);
      const slidingComponent = components.find(part => sliderLayouts[part.apertura]);
      if (slidingComponent) {
        const layout = sliderLayouts[slidingComponent.apertura];
        const pieces = slidingPieces({
          apertura: slidingComponent.apertura,
          raw: rawGeometry,
          width: firstPositive(slidingComponent.ancho) || fallbackWidth,
          movilLado: slidingComponent.movilLado,
          movilAncho: slidingComponent.movilAncho,
          materiales: Array.isArray(line && line.materiales) ? line.materiales : null,
          unidades: number(line && line.uds),
          linea: line
        });
        if (pieces) return pieces.map(piece => ({ ...piece, component: slidingComponent }));
        // Sin N1: ningún paño fijo declarado. Se respeta el layout del código
        // pero con los anchos reales del despiece cuando la cantidad calza.
        const exactLeaves = exactLeavesFor(rawGeometry, layout.length, firstPositive(slidingComponent.ancho) || fallbackWidth);
        if (exactLeaves) {
          return exactLeaves.map((leaf, index) => ({
            kind: layout[index], width: firstPositive(leaf.ancho, leaf.ancho_mm), altura: firstPositive(leaf.alto, leaf.alto_mm),
            apertura: slidingComponent.apertura, component: slidingComponent, exacta: true,
            carril: number(leaf.carril), carrilFuente: String(leaf.carril_fuente || '')
          }));
        }
        // Señal directa HETMO en la fila de apertura para los códigos de dos
        // paños: N1 marca la posición del único paño móvil y N2 su ancho, o
        // sea que la línea trae un fijo aunque su código no lo declare.
        // Sirve cuando el despiece no llegó con las hojas. Que N1 venga en
        // cero es lo normal y significa justamente lo contrario: ningún paño
        // fijo, se respeta el layout del código.
        if (layout.length === 2 && slidingComponent.movilLado > 0 && slidingComponent.movilAncho > 0) {
          const totalWidth = firstPositive(slidingComponent.ancho) || fallbackWidth;
          const mobileWidth = slidingComponent.movilAncho;
          const position = slidingComponent.movilLado === 1 ? 1 : 2;
          const mobileLeaf = { kind: mobileKindAt(layout, position), width: mobileWidth, apertura: slidingComponent.apertura, component: slidingComponent, exacta: true };
          const fixedLeaf = { kind: 'fijo', width: Math.max(1, totalWidth - mobileWidth), apertura: slidingComponent.apertura, component: slidingComponent, exacta: true };
          return position === 1 ? [mobileLeaf, fixedLeaf] : [fixedLeaf, mobileLeaf];
        }
      }
      // El código oficial ya declara la cantidad de hojas. HETMO puede entregar
      // una sola fila tipo 3 para una practicable de dos hojas, de modo que no
      // se exige un segundo campo redundante. Si existen filas 40001, sus anchos
      // reales prevalecen; sólo el catálogo sintético usa reparto equidistante.
      const singleDefinition = components.length === 1 ? apertureDefinition(line, components[0].apertura) : null;
      if (components.length === 1 && singleDefinition?.leafCount > 1 && !sliderLayouts[components[0].apertura]) {
        const count = singleDefinition.leafCount;
        const exactLeaves = exactLeavesFor(rawGeometry, count);
        return Array.from({ length: count }, (_, index) => {
          let kind = 'single';
          if (count === 2 && (singleDefinition.symbol === 'hinged' || singleDefinition.symbol === 'tilt-turn')) {
            const side = index === 0 ? 'left' : 'right';
            kind = singleDefinition.symbol === 'tilt-turn' && singleDefinition.hand === side
              ? `double-tilt-turn:${side}` : `double-hinged:${side}`;
          }
          const exact = exactLeaves?.[index];
          return {
            kind,
            width: exact ? firstPositive(exact.ancho, exact.ancho_mm) : fallbackWidth / count,
            altura: exact ? firstPositive(exact.alto, exact.alto_mm) : 0,
            apertura: components[0].apertura,
            component: components[0],
            exacta: Boolean(exact)
          };
        });
      }
      const usableWidths = components.map(part => part.ancho).filter(width => width > 0);
      const measuredTotal = usableWidths.reduce((sum, width) => sum + width, 0);
      const componentWidth = part => part.ancho > 0 && measuredTotal > 0 ? part.ancho : fallbackWidth / components.length;
      const pieces = [];
      components.forEach(part => {
        const layout = sliderLayouts[part.apertura];
        const kinds = layout || ['single'];
        const weights = sliderWeights[part.apertura] || kinds.map(() => 1 / kinds.length);
        kinds.forEach((kind, index) => pieces.push({ kind, width: componentWidth(part) * (weights[index] != null ? weights[index] : (1 / kinds.length)), apertura: part.apertura, component: part }));
      });
      return pieces.length ? pieces : [{ kind: 'single', width: fallbackWidth, apertura: 0 }];
    };

    const base = computeBaseLeaves();
    if (correction && Array.isArray(correction.hojas) && correction.hojas.length && !compositePanels(line)) {
      return correctedLeaves(line, base);
    }
    return base;
  }

  export function apertureLabel(line) {
    const displayLabel = definition => {
      const label = String(definition && definition.label || '');
      const leaves = Array.isArray(definition && definition.layout) ? definition.layout.length : number(definition && definition.leafCount);
      // Int/Ext/Fijo describe el layout original del catalogo, no el estado
      // vigente despues de corregir carriles. Desde tres hojas se conserva
      // internamente, pero no se presenta como glosa al usuario.
      return leaves >= 3 ? label.replace(/\s+(?:Int|Ext|Fijo)(?:[-_](?:Int|Ext|Fijo))+$/i, '') : label;
    };
    const composite = compositePanels(line);
    if (composite) {
      const labels = composite.panels.map(panel => {
        const definition = apertureDefinition(line, panel.apertura);
        return displayLabel(definition) || 'Ventana fija';
      });
      return [...new Set(labels)].join(' + ');
    }
    const parts = sourceComponents(line), labels = [];
    parts.forEach(part => {
      const definition = apertureDefinition(line, part.apertura);
      let label = displayLabel(definition);
      if (!label && parts.length > 1) label = 'Ventana fija';
      if (label && labels.indexOf(label) < 0) labels.push(label);
    });
    if (labels.length) return labels.join(' - ');
    const source = [line && line.modelo].join(' ').toLowerCase();
    if (/puerta.*(?:ext|exter)/.test(source)) return 'Puerta abatible exterior';
    if (/puerta.*(?:int|inter)/.test(source)) return 'Puerta abatible interior';
    if (/(corred|desliz)/.test(source)) return 'Corredera';
    if (/proyectante/.test(source)) return 'Proyectante';
    if (/abatible/.test(source)) return 'Ventana abatible interior';
    return 'Ventana fija';
  }

  export function profileSeries(line) {
    const explicit = String((line && line.seriePerfiles) || '').trim();
    if (explicit) return explicit;
    const source = [line && line.modelo].join(' ').toLowerCase();
    if (/jumbo/.test(source)) return 'Línea Jumbo';
    if (/prime\s*90/.test(source)) return 'Línea Prime 90';
    if (/prime\s*74/.test(source)) return 'Línea Prime 74';
    if (/advance/.test(source)) return 'Línea Advance';
    if (/efficient/.test(source)) return 'Línea Efficient';
    if (/prime/.test(source)) return 'Línea Prime';
    return 'Línea no especificada';
  }

  // HETMO declara el vidrio con dos tipos de elemento distintos segun el
  // modelo: 40000 (despiece con medidas reales por pano, p.ej. la puerta P6 de
  // Vista Monsenor) y 200 (solo la composicion, sin medidas: confirmado en
  // Casa A PV02 / HETMO 10581, donde el unico portador de "5/12/5 INC" es una
  // fila tipo 200). Mirar solo 40000 dejaba sin composicion de vidrio a todas
  // las lineas del segundo tipo.
  export const glassElementTypes = [40000, 200];
  export function renderGlassRows(line) {
    const rows = geometryItemsOf(line).filter(item => glassElementTypes.indexOf(number(item && item.tipo_elemento)) >= 0);
    const unique = new Map();
    rows.forEach(item => {
      const key = [String((item && item.codigo_componente) || ''), number(item && item.numero_ventana), number(item && item.pertenece_hueco), firstPositive(item.ancho, item.ancho_mm), firstPositive(item.alto, item.alto_mm)].join('|');
      if (!unique.has(key)) unique.set(key, item);
    });
    return [...unique.values()];
  }

  // Una línea es "sin marco" solo si su receta declara explícitamente al
  // menos un material de vidrio (termopanel, DVH, monolítico…) Y ningún
  // material es perfilería de PVC o aluminio.
  //
  // Contexto clave: en HETMO la perfilería suele ir asociada al presupuesto
  // completo (linea_hetmo: 0) y no a cada línea individual. Eso significa que
  // la receta de una línea típica solo trae el cristal aunque la ventana
  // tenga marco. Por eso el criterio NO puede ser "toda la receta es vidrio"
  // (rows.every → true para casi todas), sino la PRESENCIA POSITIVA de
  // perfilería en la línea. Si la línea declara explícitamente un perfil de
  // PVC/aluminio → tiene marco. Si no hay perfiles Y hay al menos un cristal
  // → es una venta de puro vidrio (sin marco).
  export function isFrameless(line) {
    const rows = Array.isArray(line && line.materiales) ? line.materiales : [];
    // Sin materiales de ningún tipo: no sabemos nada → dibujar con marco.
    if (!rows.length) return false;

    let hasGlass = false;
    let hasFrame = false;

    for (const item of rows) {
      const familia = String((item && item.familia) || '').trim();
      const texto   = String((item && (item.descripcionArticulo ?? item.descripcion)) || '');

      // Detectar perfilería de PVC o aluminio por familia o descripción.
      if (
        /perfiler[ií]a|perfil\b|pvc\b|alumin/i.test(familia) ||
        /perfil[^a-z]|perfiler[ií]a/i.test(texto)
      ) {
        hasFrame = true;
        break; // Basta con encontrar uno para confirmar que hay marco.
      }

      // Detectar vidrio / cristal por familia o descripción.
      if (
        /vidrio|cristal/i.test(familia) ||
        /\b(vidrio|cristal|termopanel|dvh|laminado|monol[ií]tico)\b/i.test(texto) ||
        /\d+\s*\/\s*\d+\s*\/\s*\d+/.test(texto) // p.ej. "4/12/4"
      ) {
        hasGlass = true;
      }
    }

    // Sin marco solo si encontramos vidrio explícito y ninguna perfilería.
    return hasGlass && !hasFrame;
  }

  export function isWithoutGlass(line) {
    const codes = renderGlassRows(line).map(item => String((item && item.codigo_componente) || '').trim()).filter(Boolean);
    if (!codes.length) {
      const fallback = String((line && (line.dibujoVidrio != null ? line.dibujoVidrio : line.vidrioCodigo)) || '').trim();
      return /^SIN(?:\s|\d|$)/i.test(fallback);
    }
    return codes.every(code => /^SIN(?:\s|\d|$)/i.test(code));
  }

  export function specialOutline(line) {
    const raw = geometryItemsOf(line);
    const base = raw.find(item => number(item && item.tipo_elemento) === 1);
    const width = firstPositive(base && base.ancho, line && line.dibujoAncho, line && line.ancho);
    const height = firstPositive(base && base.alto, line && line.dibujoAlto, line && line.alto);
    // Un radio puede pertenecer a una sola pieza curva de una ventana
    // compuesta. Sólo se trata el modelo completo como redondo cuando HETMO
    // informa una circunferencia de 360 grados y su diámetro coincide con el
    // ancho y alto generales de la línea.
    const curved = raw.find(item => {
      const radius = number(item && item.radio_curvatura);
      if (!(radius > 0) || number(item && item.angulo_curvatura) < 359 || !width || !height) return false;
      const diameter = radius * 2;
      const tolerance = Math.max(8, diameter * 0.03);
      return Math.abs(width - height) <= tolerance
        && Math.abs(width - diameter) <= tolerance
        && Math.abs(height - diameter) <= tolerance;
    });
    if (curved) return { kind: 'circle', width, height };
    const modifiers = raw.filter(item => number(item && item.tipo_elemento) === 10001 && number(item.forma_codigo) >= 0 && number(item.forma_codigo) <= 4);
    if (!width || !height || !modifiers.length) return null;
    const points = [[0, 0], [width, 0], [width, height], [0, height]];
    modifiers.forEach(item => {
      const code = number(item.forma_codigo);
      const pointIndex = code === 4 ? 0 : code;
      if (points[pointIndex]) {
        points[pointIndex][0] += Number(item.modificador_x) || 0;
        points[pointIndex][1] += Number(item.modificador_y) || 0;
      }
    });
    return { kind: 'polygon', points, width, height };
  }

  // Barrotillos (rejilla decorativa dentro del vidrio). Devuelve líneas en el
  // espacio propio del paño (0..width, 0..height): cada renderizador las
  // escala a su propio lienzo.
  export function muntinLines(line, width, height) {
    const glass = renderGlassRows(line).find(item => number(item && item.barrotillos_horizontales) > 0 || number(item && item.barrotillos_verticales) > 0);
    if (!glass) return [];
    const horizontal = number(glass.barrotillos_horizontales), vertical = number(glass.barrotillos_verticales), lines = [];
    for (let index = 1; index <= vertical; index += 1) {
      const x = width * index / (vertical + 1);
      lines.push({ x1: x, y1: 0, x2: x, y2: height, axis: 'vertical' });
    }
    for (let index = 1; index <= horizontal; index += 1) {
      const y = height * index / (horizontal + 1);
      lines.push({ x1: 0, y1: y, x2: width, y2: y, axis: 'horizontal' });
    }
    return lines;
  }

  // Travesaños reales de un paño (HETMO bh_*): sólo existen en paños
  // compuestos, que son los que traen esta geometría detallada por HETMO.
  // Devuelve líneas en el espacio propio del paño (0..panel.width,
  // 0..panel.height); cada renderizador las escala a su propio lienzo.
  export function panelTraverseLines(panel) {
    const raw = geometryItemsOf(panel);
    const seen = new Set();
    const lines = [];
    raw.filter(item => number(item && item.bh_numero_travesano) > 0).forEach(item => {
      const x0 = Number(item.bh_x_inicio) || 0, y0 = Number(item.bh_y_inicio) || 0;
      const x1 = Number(item.bh_x_fin) || 0, y1 = Number(item.bh_y_fin) || 0;
      if (x1 === 0 && y1 === 0) return;
      const key = [x0, y0, x1, y1].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      lines.push({ x1: x0, y1: y0, x2: x1, y2: y1 });
    });
    if (lines.length) return lines;
    // Travesaño declarado como fila tipo_elemento 6 ("corte") con una cota
    // simple, sin coordenadas bh_x/y de inicio/fin -- confirmado con
    // Franklin Sánchez V01/V02 (HETMO 10200/10201): cada paño trae una fila
    // tipo 6 con cota=700 y ningún bh_*. La cota se mide desde arriba del
    // paño; el espacio de esta función tiene y=0 en la base (ver el mapeo
    // 1 - item.y1/panel.height en windowGeometryBuilder.ts), así que se
    // invierte acá. Se traza como línea horizontal a todo el ancho del paño.
    const panelWidth = firstPositive(panel && panel.width);
    const panelHeight = firstPositive(panel && panel.height);
    if (panelWidth > 0 && panelHeight > 0) {
      raw.filter(item => number(item && item.tipo_elemento) === 6).forEach(item => {
        const cota = firstPositive(item.cota, item.cota_fija);
        if (!(cota > 0) || cota >= panelHeight) return;
        const y = panelHeight - cota;
        const key = `corte|${y}`;
        if (seen.has(key)) return;
        seen.add(key);
        lines.push({ x1: 0, y1: y, x2: panelWidth, y2: y });
      });
    }
    return lines;
  }

  // Divisiones internas de un mismo paño que HETMO NO declara como travesaño.
  // Confirmado con la puerta P6 de Vista Monseñor (linea 10332, 900x2600,
  // apertura 18): ninguna de sus 25 filas trae bh_numero_travesano y sin
  // embargo la puerta lleva su barra horizontal. HETMO la modela partiendo el
  // vidrio en DOS piezas dentro de la MISMA hoja -- 670x1438 y 670x878, sobre
  // una hoja (40001) de 842x2542. El perfil que las separa es el travesaño, y
  // por eso panelTraverseLines nunca encontraba nada que dibujar.
  //
  // Se agrupa por (numero_ventana, numero_hoja): las hojas distintas de una
  // corredera o de una puerta de dos hojas ya tienen su propio divisor y no
  // deben volver a partirse. Dentro de un grupo, vidrios de igual ancho y
  // distinto alto son cortes horizontales; de igual alto y distinto ancho,
  // verticales. Si difieren en los dos ejes no se dibuja nada: la partición
  // no es una rejilla simple y cualquier trazo sería inventado.
  //
  // El orden es el que entrega HETMO, de arriba hacia abajo: en P6 llega
  // primero el vidrio de 1438 y después el de 878, lo que deja el travesaño a
  // ~1020mm del suelo -- exactamente la ALTURA_MANILLA que declara esa misma
  // puerta. `at` es una fracción 0..1 del alto (o del ancho) del paño, medida
  // desde arriba (o desde la izquierda).
  //
  // Limitación conocida: las filas de HETMO se repiten por unidad de la línea
  // (una corredera de 8 unidades trae 16 filas 40001), así que hay que
  // deduplicar; eso hace que una partición perfectamente simétrica -- dos
  // vidrios idénticos en la misma hoja -- quede indistinguible de la
  // repetición y no se dibuje. Se prefiere no dibujar antes que partir en dos
  // una hoja que no lo está.
  export function panelGlassSplits(source) {
    const raw = geometryItemsOf(source);
    const groups = new Map();
    const seen = new Set();
    raw.forEach(item => {
      if (number(item && item.tipo_elemento) !== 40000) return;
      const paneWidth = firstPositive(item.ancho, item.ancho_mm);
      const paneHeight = firstPositive(item.alto, item.alto_mm);
      if (!(paneWidth > 0) || !(paneHeight > 0)) return;
      const key = [number(item.numero_ventana), number(item.numero_hoja)].join('|');
      const fingerprint = [key, String(item.codigo_componente || ''), number(item.pertenece_hueco), paneWidth, paneHeight].join('|');
      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ width: paneWidth, height: paneHeight });
    });
    const splits = [];
    groups.forEach(panes => {
      if (panes.length < 2) return;
      const sameWidth = panes.every(pane => Math.abs(pane.width - panes[0].width) <= Math.max(3, panes[0].width * .02));
      const sameHeight = panes.every(pane => Math.abs(pane.height - panes[0].height) <= Math.max(3, panes[0].height * .02));
      // Iguales en los dos ejes (repetición) o distintos en los dos (no es una
      // partición en una sola dirección): no hay travesaño deducible.
      if (sameWidth === sameHeight) return;
      const axis = sameWidth ? 'horizontal' : 'vertical';
      const sizes = panes.map(pane => sameWidth ? pane.height : pane.width);
      const total = sizes.reduce((sum, value) => sum + value, 0);
      if (!(total > 0)) return;
      let cursor = 0;
      sizes.slice(0, -1).forEach(size => {
        cursor += size;
        splits.push({ axis, at: cursor / total });
      });
    });
    return splits;
  }

  // Hojas exactas dentro de un paño compuesto (mismo criterio que
  // exactLeavesFor, pero acotado a la geometría propia de ese paño).
  export function exactPanelLeaves(panel, layoutLength) {
    return exactLeavesFor(panel && panel.raw, layoutLength);
  }





