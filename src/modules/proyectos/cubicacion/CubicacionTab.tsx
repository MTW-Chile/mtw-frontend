import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, FastForward, Layers, Loader2, RefreshCw, Ruler, Settings2, Undo2, Upload, X } from 'lucide-react';
import { crearCubicacionUnica, descargarPlantillaCubicacion, getCubicacion, getFabricacionesProyecto, importarPlanillaCubicacion, quitarCubicacionUnica, sincronizarCubicacion } from '../../../api/client';
import { SubTabs } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { CubicacionAlAbrir, Proyecto, ProyectoVersion, ReporteAvancePlanilla, ReporteImportacionCubicacion, ReporteSincronizacionCubicacion, ResumenCubicacion } from '../../../types';
import { ConfigCubicacionModal } from './ConfigCubicacionModal';
import { EstructuraVisual } from './EstructuraVisual';
import { TiposCubicacion } from './TiposCubicacion';
import { VentanasCubicacion, type FiltroVentanas } from './VentanasCubicacion';
import { ConciliacionCubicacion } from './ConciliacionCubicacion';
import { descargarBlob, formatoMonto, lineaReporteSincronizacion, lineasAvancePlanilla, lineasReporteImportacion, seccionesDiferenciasControl } from './utils';
import { IconButton } from '../../../components/ui/IconButton';
import { InputArchivo } from '../../../components/ui/InputArchivo';
import { useMigas } from '../../../lib/migas';
import { usePermisos } from '../../../lib/permisos';
import { AvancePlanillaModal } from './AvancePlanillaModal';

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
    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{titulo}</p>
    <p className="text-sm font-black text-slate-900 mt-0.5 truncate">{valor}</p>
    {detalle && <p className="text-[11px] text-slate-500 truncate">{detalle}</p>}
  </div>
);

// Legacy: no hay tipos, solo ventanas; las medidas vienen finales de los documentos de fabricación, no hay
// rectificación ni contrato que mostrar.
const ResumenLegacy: React.FC<{ r: ResumenCubicacion; documentos: number | undefined }> = ({ r, documentos }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid="resumen-cubicacion">
    <Dato titulo="Ventanas ubicadas" valor={`${r.posicionadas} de ${r.ventanas}`} detalle={r.sinPosicion > 0 ? `${r.sinPosicion} por ubicar` : 'todas tienen su lugar'} />
    {/* Conciliación con la planilla de control: lo que la obra espera y nadie ha fabricado, y lo fabricado más de una vez. */}
    <Dato titulo="Sin fabricar" valor={r.sinFabricar} detalle={r.sinFabricar > 0 ? 'lugares esperando su documento' : r.reposiciones > 0 ? `${r.reposiciones} con reposición` : 'todo lo esperado está fabricado'} />
    <Dato titulo="Documentos de fabricación" valor={documentos ?? '—'} detalle={r.reposiciones > 0 && r.sinFabricar > 0 ? `${r.reposiciones} ventana(s) con reposición` : 'vinculados en Fases y documentos'} />
    <Dato titulo="Superficie" valor={`${r.m2.toLocaleString('es-CL', { maximumFractionDigits: 1 })} m²`} detalle="según las medidas de fabricación" />
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

type ResultadoPanel = { titulo: string; lineas: string[]; advertencias: string[]; secciones?: { titulo: string; items: string[] }[] };

const panelDeImportacion = (r: ReporteImportacionCubicacion): ResultadoPanel =>
  r.formato === 'plantilla'
    ? { titulo: 'Planilla completada subida', lineas: lineasReporteImportacion(r), advertencias: r.advertencias }
    : { titulo: 'Planilla de control aplicada', lineas: lineasReporteImportacion(r), advertencias: [], secciones: seccionesDiferenciasControl(r) };
const panelDeSincronizacion = (r: ReporteSincronizacionCubicacion, titulo: string): ResultadoPanel => ({ titulo, lineas: [lineaReporteSincronizacion(r)], advertencias: r.avisos });
const panelAlAbrir = (r: CubicacionAlAbrir): ResultadoPanel => ({
  titulo: 'Ventanas traídas de los documentos de fabricación',
  lineas: [
    `${r.creadas} ventana(s) nueva(s), por ubicar${r.vinculadas ? `; ${r.vinculadas} llenaron un lugar que la planilla tenía «sin fabricar»` : ''}.`,
    'Cada una quedó con la medida con que se fabricó. Su lugar lo da la planilla de control de la obra (o arrastrándola en el cubicador visual).',
  ],
  advertencias: [],
});
const panelDeAvance = (r: ReporteAvancePlanilla): ResultadoPanel => ({
  titulo: r.avanzan.total > 0 ? 'Estado de las ventanas avanzado con la planilla de control' : 'La planilla no trae avance nuevo',
  lineas: lineasAvancePlanilla(r),
  advertencias: r.avisos,
  secciones: [
    ...(r.faltaDocumento.length ? [{ titulo: 'Falta su documento de fabricación: búscalo, vincúlalo y vuelve a subir la planilla', items: r.faltaDocumento }] : []),
    ...(r.sinVentana.length ? [{ titulo: 'Filas con avance sin ventana en la cubicación', items: r.sinVentana }] : []),
  ],
});

// Cubicacion de la obra: paso previo de las fases (toda fase se arma desde aqui, asi cada ventana tiene
// nomenclatura y medida rectificada). Toda obra tiene cubicador implicito (no hay paso de "crear"). TODO lo que
// ya sabemos (el presupuesto de HETMO: codigo, sistema, medidas, cantidades y precios) se lee solo; la persona
// completa lo que falta -- donde va cada ventana y su rasgo medido en obra -- en pantalla o en una planilla Excel
// que descarga, llena y vuelve a subir. Una obra que no se reparte por torre/piso/depto usa la "cubicacion unica".
export const CubicacionTab: React.FC<Props> = ({ proyecto, activeVersion }) => {
  const queryClient = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<'estructura' | 'ventanas' | 'tipos' | 'conciliacion'>('estructura');
  useMigas(2, [{ label: { estructura: 'Cubicador visual', ventanas: 'Ventanas', tipos: 'Tipos', conciliacion: 'Conciliación' }[vista] }]);
  const [config, setConfig] = useState(false);
  const [filtro, setFiltro] = useState<FiltroVentanas>({ pisoId: '', torreId: '' });
  const [panel, setPanel] = useState<ResultadoPanel | null>(null);
  const [avanzando, setAvanzando] = useState(false);
  const { tiene } = usePermisos();
  // Obra legacy (manual, nunca cotizada): sus ventanas llegan solas de los documentos de fabricación, con las
  // medidas finales que traen, y la cubicación completa sale de su planilla de control. Sin rectificación ni holgura.
  const legacy = proyecto.origen === 'MANUAL_OBRA';

  const { data, isLoading, isError } = useQuery({ queryKey: ['cubicacion', proyecto.id], queryFn: () => getCubicacion(proyecto.id) });
  const cubicacion = data?.cubicacion;
  const resumen = data?.resumen;
  const presupuesto = data?.presupuesto ?? null;
  // Al abrir, la obra legacy trajo solas las ventanas nuevas de sus documentos: se cuenta una vez.
  const alAbrir = data?.alAbrir;
  useEffect(() => {
    if (alAbrir && (alAbrir.creadas > 0 || alAbrir.vinculadas > 0)) {
      setPanel(panelAlAbrir(alAbrir));
      queryClient.invalidateQueries({ queryKey: ['cubicacionEstructura', proyecto.id] });
    }
  }, [alAbrir, proyecto.id, queryClient]);
  const documentos = useQuery({ queryKey: ['fabricaciones', proyecto.id], queryFn: () => getFabricacionesProyecto(proyecto.id), enabled: legacy });
  const puedeEditar = tiene('obras.cubicacion.editar');

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['cubicacion', proyecto.id] });
    queryClient.invalidateQueries({ queryKey: ['cubicacionUnidades', proyecto.id] });
    queryClient.invalidateQueries({ queryKey: ['cubicacionUbicaciones', proyecto.id] });
    queryClient.invalidateQueries({ queryKey: ['cubicacionConciliacion', proyecto.id] });
  };
  const alAvanzar = (r: ReporteAvancePlanilla) => {
    setAvanzando(false);
    setPanel(panelDeAvance(r));
    refrescar();
  };
  const sincronizar = useMutation({
    mutationFn: () => sincronizarCubicacion(proyecto.id),
    onSuccess: (r) => {
      setPanel(panelDeSincronizacion(r.reporte, 'Cubicación completada desde el presupuesto'));
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
          legacy ? 'Ya puedes verlas en la pestaña Ventanas.' : 'Ya puedes rectificar sus medidas en la pestaña Ventanas y armar fases con ellas.',
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
      queryClient.invalidateQueries({ queryKey: ['cubicacionEstructura', proyecto.id] });
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
    <InputArchivo ref={entrada} accept=".xlsx" onArchivos={elegirArchivo} etiqueta={legacy ? 'Elegir planilla de control' : 'Elegir planilla de cubicación'} data-testid="planilla-cubicacion" />
  );
  // Obra legacy: su planilla de control (una fila por ventana + hoja BASE) arma la cubicación completa y avisa las diferencias.
  const botonPlanillaControl = (variant: 'primary' | 'outline') =>
    legacy && puedeEditar ? (
      <Button
        variant={variant}
        size="sm"
        leftIcon={<Upload className="w-3.5 h-3.5" />}
        isLoading={subir.isPending}
        onClick={() => entrada.current?.click()}
        title="La planilla de control de la obra: ubica en su torre, piso, depto y ubicación las ventanas fabricadas que también están en ella, e informa lo que sobra, lo que falta y las repetidas"
      >
        Subir planilla de control
      </Button>
    ) : null;

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center text-slate-500">
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
              ? 'Obra en ejecución que no se cotizó: las ventanas de sus documentos de fabricación aparecen solas, por ubicar, con la medida con que se fabricaron (son las medidas finales). La planilla de control de la obra las ubica y deja en su lugar, «sin fabricar», lo que todavía no trae ningún documento; lo que la planilla no pide se ubica arrastrando. El detalle queda en Conciliación.'
              : 'Paso previo de las fases: cada ventana necesita su nomenclatura y su medida rectificada. Lo que ya sabemos del presupuesto de HETMO (tipos, descripción, medidas, cantidades y precios) ya está cargado: aquí solo se completa dónde va cada ventana y su rasgo medido en obra, en pantalla o con la planilla para completar. Si la obra no se reparte por torres y pisos, usa la cubicación única.'}
          </p>
        </div>
        {(legacy ? resumen.ventanas > 0 : resumen.tipos > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {botonPlanillaControl('outline')}
            {legacy && tiene('obras.regularizar') && resumen.posicionadas > 0 && (
              <Button variant="outline" size="sm" leftIcon={<FastForward className="w-3.5 h-3.5" />} onClick={() => setAvanzando(true)} title="Obra que ya estaba en ejecución: deja despachado, recibido e instalado lo que su planilla de control ya anota, por marco y hoja">
                Avanzar estado con la planilla
              </Button>
            )}
            {!legacy && (
              <>
                <Button variant="primary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />} isLoading={plantilla.isPending} onClick={() => plantilla.mutate()} title="Excel con una fila por ventana y lo que el sistema ya sabe, para completar torre, piso, depto y las medidas rectificadas">
                  Descargar planilla para completar
                </Button>
                <Button variant="outline" size="sm" leftIcon={<Upload className="w-3.5 h-3.5" />} isLoading={subir.isPending} onClick={() => entrada.current?.click()}>
                  Subir planilla completada
                </Button>
              </>
            )}
            {!legacy && resumen.sinPosicion > 0 && (
              <Button variant="outline" size="sm" leftIcon={<Layers className="w-3.5 h-3.5" />} isLoading={cubicarUnica.isPending} onClick={() => cubicarUnica.mutate()} title="Nombra las ventanas sin repartirlas por torre, piso y departamento: V01, o V01-1, V01-2 si hay más de una.">
                Crear cubicación única
              </Button>
            )}
            {!legacy && resumen.cubicacionUnica > 0 && (
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
          {panel.secciones?.map((sec) => (
            <details key={sec.titulo} className="text-amber-900">
              <summary className="flex items-center gap-1 cursor-pointer font-bold">
                <AlertTriangle className="w-3.5 h-3.5" /> {sec.titulo} ({sec.items.length})
              </summary>
              <ul className="list-disc pl-5 mt-1 space-y-0.5 max-h-64 overflow-y-auto">
                {sec.items.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </details>
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

      {(legacy ? resumen.ventanas === 0 : resumen.tipos === 0) ? (
        <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs space-y-3">
          <Ruler className="w-6 h-6 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700">{legacy ? 'Esta obra aún no tiene ventanas.' : 'Esta obra aún no tiene tipos de ventana cargados.'}</p>
          {presupuesto ? (
            <>
              <p className="max-w-xl mx-auto" data-testid="presupuesto-disponible">
                No se pudo leer el presupuesto de HETMO (versión {presupuesto.versionNumero}, {presupuesto.lineas} líneas). Vuelve a intentarlo.
              </p>
              <Button variant="primary" size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} isLoading={sincronizar.isPending} onClick={() => sincronizar.mutate()}>
                Leer el presupuesto
              </Button>
            </>
          ) : (
            <>
              <p className="max-w-lg mx-auto" data-testid="sin-presupuesto">
                {legacy
                  ? 'Vincula sus documentos de fabricación (pestaña Fases › Vincular documentos): sus ventanas aparecen aquí solas, por ubicar. Para ubicarlas, sube la planilla de control de la obra.'
                  : 'Esta obra no tiene líneas de ventana en un presupuesto de HETMO. Agrega un tipo a mano en la pestaña Tipos.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {botonPlanillaControl('primary')}
                {!legacy && (
                  <Button variant="outline" size="sm" onClick={() => setVista('tipos')}>
                    Ir a Tipos
                  </Button>
                )}
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
                ? 'Sube la planilla de control de la obra, o arrastra cada ventana a su lugar en el cubicador visual (filtra por documento de fabricación).'
                : 'Arma el edificio (o las casas) en el cubicador visual y arrastra cada ventana a su lugar, descarga la planilla, complétala (torre, piso, depto y rasgo) y súbela, o usa «Crear cubicación única» si la obra no se reparte.'}
            </p>
          )}
          <SubTabs
            tabs={[
              { id: 'estructura', label: 'Cubicador visual' },
              { id: 'ventanas', label: `Ventanas (${resumen.ventanas})` },
              // Obra legacy: no hay tipos, solo ventanas (cada una con su nombre y descripción del documento), y la
              // conciliación con la planilla de control (sin fabricar, fuera de planilla, reposiciones).
              ...(legacy ? [{ id: 'conciliacion' as const, label: 'Conciliación' }] : [{ id: 'tipos' as const, label: `Tipos (${resumen.tipos})` }]),
            ]}
            active={vista}
            onChange={setVista}
          />
          {vista === 'estructura' ? (
            <EstructuraVisual proyectoId={proyecto.id} cubicacion={cubicacion} tipos={resumen.porTipo} versionId={activeVersion?.id} legacy={legacy} />
          ) : vista === 'conciliacion' ? (
            <ConciliacionCubicacion proyectoId={proyecto.id} />
          ) : vista === 'ventanas' ? (
            <VentanasCubicacion proyectoId={proyecto.id} cubicacion={cubicacion} moneda={resumen.moneda} tipos={resumen.porTipo} filtro={filtro} onFiltro={setFiltro} legacy={legacy} />
          ) : (
            <TiposCubicacion proyectoId={proyecto.id} moneda={resumen.moneda ?? 'UF'} tipos={resumen.porTipo} legacy={legacy} />
          )}
          {/* Obra legacy: sin holgura ni nomenclatura que configurar (cada ventana conserva el nombre de su documento). */}
          {!legacy && <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
            <span className="mr-2">
              Holgura: <b>{cubicacion.holguraMm} mm</b> · Nomenclatura: <b className="font-mono">{cubicacion.formatoNomenclatura}</b>
            </span>
            {/* Sin "Actualizar desde el presupuesto": la obra ya tiene su presupuesto aceptado y congelado; se lee una sola vez al activar. */}
            <Button variant="ghost" size="sm" leftIcon={<Settings2 className="w-3.5 h-3.5" />} onClick={() => setConfig(true)}>
              Configuración
            </Button>
          </div>}
        </>
      )}

      {config && <ConfigCubicacionModal proyectoId={proyecto.id} cubicacion={cubicacion} legacy={legacy} onClose={() => setConfig(false)} />}
      {avanzando && <AvancePlanillaModal proyectoId={proyecto.id} onClose={() => setAvanzando(false)} onAvanzado={alAvanzar} />}
    </div>
  );
};
