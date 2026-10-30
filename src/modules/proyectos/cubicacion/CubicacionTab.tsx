import React, { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, Factory, FastForward, FileSpreadsheet, Layers, Loader2, RefreshCw, Ruler, Settings2, Undo2, Upload, X } from 'lucide-react';
import { crearCubicacionUnica, descargarPlantillaCubicacion, getCubicacion, getFabricacionesProyecto, getPropuestaCubicacionFabricacion, importarPlanillaCubicacion, quitarCubicacionUnica, sincronizarCubicacion } from '../../../api/client';
import { SubTabs } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { Proyecto, ProyectoVersion, ReporteAplicacionPropuesta, ReporteAvanceVentanas, ReporteImportacionCubicacion, ReporteSincronizacionCubicacion, ResumenCubicacion } from '../../../types';
import { ConfigCubicacionModal } from './ConfigCubicacionModal';
import { EstructuraVisual } from './EstructuraVisual';
import { TiposCubicacion } from './TiposCubicacion';
import { VentanasCubicacion, type FiltroVentanas } from './VentanasCubicacion';
import { descargarBlob, formatoMonto, lineaReporteSincronizacion, lineasReporteImportacion } from './utils';
import { IconButton } from '../../../components/ui/IconButton';
import { InputArchivo } from '../../../components/ui/InputArchivo';
import { useMigas } from '../../../lib/migas';
import { usePermisos } from '../../../lib/permisos';
import { PropuestaFabricacionModal } from './PropuestaFabricacionModal';
import { AvanzarEstadoModal } from './AvanzarEstadoModal';

interface Props {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
}

const aviso = (e: unknown) => {
  const { mensaje, detalle } = extraerErrorParaToast(e);
  mostrarToast(mensaje, { detalle });
};

const Dato: React.FC<{ titulo: string; valor: React.ReactNode; detalle?: React.ReactNode }> = ({ titulo, valor, detalle }) => (
  <div className="rounded-xl bg-white border border-slate-200 px-3 py-2.5 min-w-0">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{titulo}</p>
    <p className="text-sm font-black text-slate-900 mt-0.5 truncate">{valor}</p>
    {detalle && <p className="text-[11px] text-slate-500 truncate">{detalle}</p>}
  </div>
);

// Legacy: las medidas vienen finales de los documentos de fabricación, no hay rectificación ni contrato que mostrar.
const ResumenLegacy: React.FC<{ r: ResumenCubicacion; documentos: number | undefined }> = ({ r, documentos }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid="resumen-cubicacion">
    <Dato titulo="Ventanas con nomenclatura" valor={`${r.posicionadas} de ${r.ventanas}`} detalle={r.sinPosicion > 0 ? `${r.sinPosicion} sin ubicar ni nombre` : 'todas tienen su nombre'} />
    <Dato titulo="Documentos de fabricación" valor={documentos ?? '—'} detalle="vinculados en Fases y documentos" />
    <Dato titulo="Superficie" valor={`${r.m2.toLocaleString('es-CL', { maximumFractionDigits: 1 })} m²`} detalle="según las medidas de fabricación" />
    <Dato titulo="Tipos de ventana" valor={r.tipos} detalle="armados desde los documentos" />
  </div>
);

const Resumen: React.FC<{ r: ResumenCubicacion }> = ({ r }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid="resumen-cubicacion">
    <Dato titulo="Ventanas con nomenclatura" valor={`${r.posicionadas} de ${r.ventanas}`} detalle={r.sinPosicion > 0 ? `${r.sinPosicion} sin ubicar ni nombre` : 'todas tienen su nombre'} />
    <Dato titulo="Rectificadas" valor={r.rectificadas} detalle={r.ventanas ? `${Math.round((r.rectificadas / r.ventanas) * 100)} % de las ventanas` : '—'} />
    <Dato titulo="Superficie" valor={`${r.m2.toLocaleString('es-CL', { maximumFractionDigits: 1 })} m²`} detalle="fabricación si ya se rectificó; si no, plano" />
    <Dato titulo="Contratado" valor={formatoMonto(r.precio.contratado, r.moneda ?? 'UF')} detalle={`Saldo por posicionar ${formatoMonto(r.precio.saldo, r.moneda ?? 'UF')}`} />
  </div>
);

type ResultadoPanel = { titulo: string; lineas: string[]; advertencias: string[] };

const panelDeImportacion = (r: ReporteImportacionCubicacion): ResultadoPanel => ({
  titulo: r.formato === 'plantilla' ? 'Planilla completada subida' : 'Planilla importada',
  lineas: lineasReporteImportacion(r),
  advertencias: r.advertencias,
});
const panelDeSincronizacion = (r: ReporteSincronizacionCubicacion, titulo: string): ResultadoPanel => ({ titulo, lineas: [lineaReporteSincronizacion(r)], advertencias: r.avisos });
const panelDePropuesta = (r: ReporteAplicacionPropuesta): ResultadoPanel => ({
  titulo: 'Cubicación creada desde los documentos de fabricación',
  lineas: [
    `${r.ventanas.creadas} ventana(s) cubicada(s): ${r.ventanas.conPosicion} con posición${r.ventanas.sinPosicion ? ` y ${r.ventanas.sinPosicion} sin posición (ubícalas en el cubicador visual)` : ''}.`,
    `${r.tipos.nuevos} tipo(s) nuevo(s)${r.tipos.existentes ? `, ${r.tipos.existentes} ya existía(n)` : ''}; estructura nueva: ${r.estructura.torres} torre(s)/casa(s), ${r.estructura.pisos} piso(s), ${r.estructura.unidades} unidad(es).`,
    'Cada ventana quedó vinculada a su documento, con la medida con que se fabricó.',
  ],
  advertencias: r.avisos,
});
const panelDeAvance = (r: ReporteAvanceVentanas): ResultadoPanel => ({
  titulo: 'Estado de las ventanas avanzado',
  lineas: [
    `${r.ventanas} ventana(s) avanzada(s): ${r.despachadas} despachada(s), ${r.recibidas} recibida(s), ${r.instaladas} instalada(s)${r.yaEstaban ? `; ${r.yaEstaban} ya estaban en ese estado o más adelante` : ''}.`,
    r.despachoId ? 'Se generó un despacho de regularización sin guía (ver Despachos).' : 'No hizo falta generar un despacho nuevo.',
  ],
  advertencias: r.omitidas.map((o) => `${o.nombre}: ${o.motivo}.`),
});

// Cubicacion de la obra: paso previo de las fases (toda fase se arma desde aqui, asi cada ventana tiene
// nomenclatura y medida rectificada). Toda obra tiene cubicador implicito (no hay paso de "crear"). TODO lo que
// ya sabemos (el presupuesto de HETMO: codigo, sistema, medidas, cantidades y precios) se lee solo; la persona
// completa lo que falta -- donde va cada ventana y su rasgo medido en obra -- en pantalla o en una planilla Excel
// que descarga, llena y vuelve a subir. Una obra que no se reparte por torre/piso/depto usa la "cubicacion unica".
export const CubicacionTab: React.FC<Props> = ({ proyecto, activeVersion }) => {
  const queryClient = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<'estructura' | 'ventanas' | 'tipos'>('estructura');
  useMigas(2, [{ label: { estructura: 'Cubicador visual', ventanas: 'Ventanas', tipos: 'Tipos' }[vista] }]);
  const [config, setConfig] = useState(false);
  const [filtro, setFiltro] = useState<FiltroVentanas>({ pisoId: '', torreId: '' });
  const [panel, setPanel] = useState<ResultadoPanel | null>(null);
  const [proponiendo, setProponiendo] = useState(false);
  const [avanzando, setAvanzando] = useState(false);
  const { tiene } = usePermisos();
  // Obra legacy (manual, nunca cotizada): se cubica desde sus documentos de fabricación, con las medidas finales
  // que traen; sin rectificación, holgura ni planillas. Nada de esto aplica a una obra cotizada.
  const legacy = proyecto.origen === 'MANUAL_OBRA';

  const { data, isLoading, isError } = useQuery({ queryKey: ['cubicacion', proyecto.id], queryFn: () => getCubicacion(proyecto.id) });
  const cubicacion = data?.cubicacion;
  const resumen = data?.resumen;
  const presupuesto = data?.presupuesto ?? null;
  // Obra legacy (sin presupuesto, o con documentos de fabricación de más): ventanas fabricadas que aún no están en la cubicación.
  const propuesta = useQuery({ queryKey: ['propuestaFabricacion', proyecto.id], queryFn: () => getPropuestaCubicacionFabricacion(proyecto.id), enabled: legacy });
  const porCubicarDeFabricacion = legacy ? (propuesta.data?.resumen.ventanas ?? 0) : 0;
  const documentos = useQuery({ queryKey: ['fabricaciones', proyecto.id], queryFn: () => getFabricacionesProyecto(proyecto.id), enabled: legacy });
  const puedeEditar = tiene('obras.cubicacion.editar');

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['cubicacion', proyecto.id] });
    queryClient.invalidateQueries({ queryKey: ['cubicacionUnidades', proyecto.id] });
    queryClient.invalidateQueries({ queryKey: ['cubicacionUbicaciones', proyecto.id] });
  };
  const alAplicarPropuesta = (r: ReporteAplicacionPropuesta) => {
    setProponiendo(false);
    setPanel(panelDePropuesta(r));
    refrescar();
    queryClient.invalidateQueries({ queryKey: ['cubicacionEstructura', proyecto.id] });
    queryClient.invalidateQueries({ queryKey: ['fabricaciones', proyecto.id] });
    queryClient.invalidateQueries({ queryKey: ['resumenObra', proyecto.id] });
    setVista('estructura');
  };
  const alAvanzar = (r: ReporteAvanceVentanas) => {
    setAvanzando(false);
    setPanel(panelDeAvance(r));
    refrescar();
  };
  const botonPropuesta = (variant: 'primary' | 'outline') =>
    puedeEditar && porCubicarDeFabricacion > 0 ? (
      <Button variant={variant} size="sm" leftIcon={<Factory className="w-3.5 h-3.5" />} onClick={() => setProponiendo(true)} title="Propone tipo, torre, piso y departamento de cada ventana leyendo el modelo del lote y el nombre del documento">
        Cubicar desde fabricación ({porCubicarDeFabricacion})
      </Button>
    ) : null;

  const sincronizar = useMutation({
    mutationFn: () => sincronizarCubicacion(proyecto.id),
    onSuccess: (r) => {
      setPanel(panelDeSincronizacion(r.reporte, resumen && resumen.tipos > 0 ? 'Presupuesto leído de nuevo' : 'Cubicación completada desde el presupuesto'));
      refrescar();
    },
    onError: aviso,
  });
  // Cubicación única: sin torres ni pisos, todas las ventanas reciben su nomenclatura (V01, o V01-1, V01-2...).
  const cubicarUnica = useMutation({
    mutationFn: () => crearCubicacionUnica(proyecto.id),
    onSuccess: (r) => {
      setPanel({
        titulo: 'Cubicación única creada',
        lineas: [
          `${r.reporte.nombradas} ventana(s) con nomenclatura nueva${r.reporte.yaTenian ? `; ${r.reporte.yaTenian} ya tenían la suya` : ''}.`,
          legacy ? 'Ya puedes verlas en la pestaña Ventanas y avanzar su estado.' : 'Ya puedes rectificar sus medidas en la pestaña Ventanas y armar fases con ellas.',
        ],
        advertencias: [],
      });
      refrescar();
      queryClient.invalidateQueries({ queryKey: ['cubicacionEstructura', proyecto.id] });
      setVista('ventanas');
    },
    onError: aviso,
  });
  const quitarUnica = useMutation({
    mutationFn: () => quitarCubicacionUnica(proyecto.id),
    onSuccess: (r) => {
      setPanel({
        titulo: 'Cubicación única deshecha',
        lineas: [`${r.reporte.quitadas} ventana(s) vuelven a quedar sin nomenclatura. Las que ya están en una fase se dejaron como estaban.`],
        advertencias: [],
      });
      refrescar();
      queryClient.invalidateQueries({ queryKey: ['cubicacionEstructura', proyecto.id] });
    },
    onError: aviso,
  });
  const subir = useMutation({
    mutationFn: (archivo: File) => importarPlanillaCubicacion(proyecto.id, archivo),
    onSuccess: (r) => {
      setPanel(panelDeImportacion(r.reporte));
      refrescar();
    },
    onError: aviso,
  });
  const plantilla = useMutation({
    mutationFn: () => descargarPlantillaCubicacion(proyecto.id),
    onSuccess: (blob) => descargarBlob(blob, `Planilla de cubicación ${proyecto.obra}.xlsx`),
    onError: aviso,
  });
  const elegirArchivo = ([archivo]: File[]) => {
    if (!archivo) return;
    if (!/\.xlsx$/i.test(archivo.name)) {
      mostrarToast('La planilla debe ser un archivo Excel (.xlsx).', { tipo: 'info' });
      return;
    }
    subir.mutate(archivo);
  };

  const entradaArchivo = (
    <InputArchivo ref={entrada} accept=".xlsx" onArchivos={elegirArchivo} etiqueta="Elegir planilla de cubicación" data-testid="planilla-cubicacion" />
  );

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (isError || !cubicacion || !resumen) {
    return <div className="p-8 text-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">No se pudo cargar la cubicación. Intenta de nuevo en unos minutos.</div>;
  }

  return (
    <div className="space-y-4">
      {entradaArchivo}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">Cubicación</h2>
          <p className="text-xs text-slate-500 max-w-2xl">
            {legacy
              ? 'Obra en ejecución que no se cotizó: sus ventanas vienen de los documentos de fabricación, con la medida con que se fabricaron (son las medidas finales). Aquí solo se ubica cada ventana en su torre, piso y departamento.'
              : 'Paso previo de las fases: cada ventana necesita su nomenclatura y su medida rectificada. Lo que ya sabemos del presupuesto de HETMO (tipos, descripción, medidas, cantidades y precios) se lee solo: aquí solo se completa dónde va cada ventana y su rasgo medido en obra. Si la obra no se reparte por torres y pisos, usa la cubicación única.'}
          </p>
        </div>
        {resumen.tipos > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {botonPropuesta('outline')}
            {legacy && tiene('obras.regularizar') && resumen.posicionadas > 0 && (
              <Button variant="outline" size="sm" leftIcon={<FastForward className="w-3.5 h-3.5" />} onClick={() => setAvanzando(true)} title="Obra que ya estaba en ejecución: deja despachadas, recibidas o instaladas las ventanas de una torre, un piso o un departamento de una vez">
                Avanzar estado…
              </Button>
            )}
            {!legacy && (
              <>
                <Button variant="primary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />} isLoading={plantilla.isPending} onClick={() => plantilla.mutate()} title="Excel con una fila por ventana y lo que el sistema ya sabe, para completar piso, depto y rasgo">
                  Descargar planilla para completar
                </Button>
                <Button variant="outline" size="sm" leftIcon={<Upload className="w-3.5 h-3.5" />} isLoading={subir.isPending} onClick={() => entrada.current?.click()}>
                  Subir planilla completada
                </Button>
              </>
            )}
            {resumen.sinPosicion > 0 && (
              <Button variant="outline" size="sm" leftIcon={<Layers className="w-3.5 h-3.5" />} isLoading={cubicarUnica.isPending} onClick={() => cubicarUnica.mutate()} title="Nombra las ventanas sin repartirlas por torre, piso y departamento: V01, o V01-1, V01-2 si hay más de una.">
                Crear cubicación única
              </Button>
            )}
            {resumen.cubicacionUnica > 0 && (
              <Button variant="ghost" size="sm" leftIcon={<Undo2 className="w-3.5 h-3.5" />} isLoading={quitarUnica.isPending} onClick={() => quitarUnica.mutate()} title="Quita el nombre a las ventanas que no tienen torre, piso ni departamento (las que ya están en una fase se respetan).">
                Deshacer cubicación única
              </Button>
            )}
          </div>
        )}
      </div>

      {panel && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-1" role="status" data-testid="reporte-importacion">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold">{panel.titulo}</p>
            <IconButton icono={X} etiqueta="Cerrar el resultado" onClick={() => setPanel(null)} />
          </div>
          {panel.lineas.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
          {panel.advertencias.length > 0 && (
            <details className="text-amber-900">
              <summary className="flex items-center gap-1 cursor-pointer font-bold">
                <AlertTriangle className="w-3.5 h-3.5" /> {panel.advertencias.length} advertencia(s)
              </summary>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {panel.advertencias.slice(0, 30).map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {resumen.tipos === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs space-y-3">
          <Ruler className="w-6 h-6 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700">Esta obra aún no tiene tipos de ventana cargados.</p>
          {presupuesto ? (
            <>
              <p className="max-w-xl mx-auto" data-testid="presupuesto-disponible">
                El presupuesto de HETMO (versión {presupuesto.versionNumero}) ya trae <b>{presupuesto.lineas} líneas</b>: {presupuesto.ventanas} ventana(s) y {presupuesto.areasComunes} ítem(s) sin medidas
                (áreas comunes){presupuesto.moneda ? `, en ${presupuesto.moneda}` : ''}. Se leen solas: después solo falta indicar dónde va cada ventana y medir el rasgo.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="primary" size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} isLoading={sincronizar.isPending} onClick={() => sincronizar.mutate()}>
                  Completar desde el presupuesto
                </Button>
                <Button variant="outline" size="sm" leftIcon={<Layers className="w-3.5 h-3.5" />} isLoading={cubicarUnica.isPending} onClick={() => cubicarUnica.mutate()} title="Lee el presupuesto y nombra todas las ventanas sin repartirlas por torre, piso y departamento.">
                  Crear cubicación única
                </Button>
              </div>
              <p className="text-[11px] text-slate-400">
                ¿Ya tienes una planilla de cubicación (la de siempre)?{' '}
                <Button variant="link" size="sm" onClick={() => entrada.current?.click()}>Súbela</Button>
                .
              </p>
            </>
          ) : (
            <>
              <p className="max-w-lg mx-auto" data-testid="sin-presupuesto">
                Esta obra no tiene líneas de ventana en un presupuesto de HETMO.{' '}
                {porCubicarDeFabricacion > 0
                  ? `Sus documentos de fabricación traen ${porCubicarDeFabricacion} ventana(s): el sistema puede proponer la cubicación leyendo el modelo de cada una y el nombre del documento.`
                  : legacy
                    ? 'Vincula sus documentos de fabricación (Fases y documentos › Vincular documentos) y el sistema propone la cubicación desde ahí, o agrega un tipo a mano en la pestaña Tipos.'
                    : 'Sube una planilla de cubicación o agrega un tipo a mano en la pestaña Tipos.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {botonPropuesta('primary')}
                {!legacy && (
                  <Button variant="outline" size="sm" leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />} isLoading={subir.isPending} onClick={() => entrada.current?.click()}>
                    Subir planilla (.xlsx)
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setVista('tipos')}>
                  Ir a Tipos
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {legacy ? <ResumenLegacy r={resumen} documentos={documentos.data?.length} /> : <Resumen r={resumen} />}
          {resumen.sinPosicion > 0 && (
            <p className="text-xs text-slate-600 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2" data-testid="siguiente-paso">
              <b>Siguiente paso:</b> faltan {resumen.sinPosicion} ventana(s) por ubicar.{' '}
              {legacy
                ? 'Arma el edificio en el cubicador visual y arrastra cada ventana a su lugar, o usa «Crear cubicación única» si la obra no se reparte.'
                : 'Arma el edificio (o las casas) en el cubicador visual y arrastra cada ventana a su lugar, descarga la planilla, complétala (torre, piso, depto y rasgo) y súbela, o usa «Crear cubicación única» si la obra no se reparte.'}
            </p>
          )}
          <SubTabs
            tabs={[
              { id: 'estructura', label: 'Cubicador visual' },
              { id: 'ventanas', label: `Ventanas (${resumen.ventanas})` },
              { id: 'tipos', label: `Tipos (${resumen.tipos})` },
            ]}
            active={vista}
            onChange={setVista}
          />
          {vista === 'estructura' ? (
            <EstructuraVisual proyectoId={proyecto.id} cubicacion={cubicacion} tipos={resumen.porTipo} versionId={activeVersion?.id} legacy={legacy} />
          ) : vista === 'ventanas' ? (
            <VentanasCubicacion proyectoId={proyecto.id} cubicacion={cubicacion} moneda={resumen.moneda} tipos={resumen.porTipo} filtro={filtro} onFiltro={setFiltro} legacy={legacy} />
          ) : (
            <TiposCubicacion proyectoId={proyecto.id} moneda={resumen.moneda ?? 'UF'} tipos={resumen.porTipo} legacy={legacy} />
          )}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
            <span className="mr-2">
              {!legacy && <>Holgura: <b>{cubicacion.holguraMm} mm</b> · </>}Nomenclatura: <b className="font-mono">{cubicacion.formatoNomenclatura}</b>
            </span>
            {/* Sin "Actualizar desde el presupuesto": la obra ya tiene su presupuesto aceptado y congelado; se lee una sola vez al activar. */}
            <Button variant="ghost" size="sm" leftIcon={<Settings2 className="w-3.5 h-3.5" />} onClick={() => setConfig(true)}>
              Configuración
            </Button>
          </div>
        </>
      )}

      {config && <ConfigCubicacionModal proyectoId={proyecto.id} cubicacion={cubicacion} legacy={legacy} onClose={() => setConfig(false)} />}
      {proponiendo && <PropuestaFabricacionModal proyectoId={proyecto.id} onClose={() => setProponiendo(false)} onAplicada={alAplicarPropuesta} />}
      {avanzando && <AvanzarEstadoModal proyectoId={proyecto.id} onClose={() => setAvanzando(false)} onAvanzado={alAvanzar} />}
    </div>
  );
};
