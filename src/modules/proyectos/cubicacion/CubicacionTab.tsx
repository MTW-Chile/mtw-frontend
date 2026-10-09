import React, { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, FileSpreadsheet, Loader2, RefreshCw, Ruler, Settings2, Upload, X } from 'lucide-react';
import {
  crearCubicacion,
  descargarInformeCubicacion,
  descargarPlantillaCubicacion,
  getCubicacion,
  importarPlanillaCubicacion,
  sincronizarCubicacion,
} from '../../../api/client';
import { SubTabs } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { Proyecto, ReporteImportacionCubicacion, ReporteSincronizacionCubicacion, ResumenCubicacion } from '../../../types';
import { ConfigCubicacionModal } from './ConfigCubicacionModal';
import { TiposCubicacion } from './TiposCubicacion';
import { VentanasCubicacion, type FiltroVentanas } from './VentanasCubicacion';
import { descargarBlob, formatoMonto, lineaReporteSincronizacion, lineasReporteImportacion } from './utils';

interface Props {
  proyecto: Proyecto;
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

const Resumen: React.FC<{ r: ResumenCubicacion }> = ({ r }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid="resumen-cubicacion">
    <Dato titulo="Ventanas con posición" valor={`${r.posicionadas} de ${r.ventanas}`} detalle={r.sinPosicion > 0 ? `${r.sinPosicion} sin piso ni depto` : 'todas tienen su lugar'} />
    <Dato titulo="Rectificadas" valor={r.rectificadas} detalle={r.ventanas ? `${Math.round((r.rectificadas / r.ventanas) * 100)} % de las ventanas` : '—'} />
    <Dato titulo="Superficie" valor={`${r.m2.toLocaleString('es-CL', { maximumFractionDigits: 1 })} m²`} detalle="fabricación si ya se rectificó; si no, plano" />
    <Dato titulo="Contratado" valor={formatoMonto(r.precio.contratado, r.moneda)} detalle={`Saldo por posicionar ${formatoMonto(r.precio.saldo, r.moneda)}`} />
  </div>
);

type ResultadoPanel = { titulo: string; lineas: string[]; advertencias: string[] };

const panelDeImportacion = (r: ReporteImportacionCubicacion): ResultadoPanel => ({
  titulo: r.formato === 'plantilla' ? 'Planilla completada subida' : 'Planilla importada',
  lineas: lineasReporteImportacion(r),
  advertencias: r.advertencias,
});
const panelDeSincronizacion = (r: ReporteSincronizacionCubicacion, titulo: string): ResultadoPanel => ({ titulo, lineas: [lineaReporteSincronizacion(r)], advertencias: r.avisos });

// Cubicacion de la obra: paso previo y OPCIONAL de las fases. TODO lo que ya sabemos (el presupuesto de HETMO: codigo,
// sistema, medidas, cantidades y precios) se lee solo; la persona completa lo que falta -- donde va cada ventana y su
// rasgo medido en obra -- en pantalla o en una planilla Excel que descarga, llena y vuelve a subir. Sin cubicacion, las
// fases se crean con el modal de siempre.
export const CubicacionTab: React.FC<Props> = ({ proyecto }) => {
  const queryClient = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<'ventanas' | 'tipos'>('ventanas');
  const [config, setConfig] = useState(false);
  const [filtro, setFiltro] = useState<FiltroVentanas>({ piso: '', torre: '' });
  const [panel, setPanel] = useState<ResultadoPanel | null>(null);

  const { data, isLoading, isError } = useQuery({ queryKey: ['cubicacion', proyecto.id], queryFn: () => getCubicacion(proyecto.id) });
  const cubicacion = data?.cubicacion ?? null;
  const resumen = data?.resumen ?? null;
  const presupuesto = data?.presupuesto ?? null;

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['cubicacion', proyecto.id] });
    queryClient.invalidateQueries({ queryKey: ['cubicacionUnidades', proyecto.id] });
    queryClient.invalidateQueries({ queryKey: ['cubicacionUbicaciones', proyecto.id] });
  };

  const crear = useMutation({
    mutationFn: (desdePresupuesto: boolean) => crearCubicacion(proyecto.id, { desdePresupuesto }),
    onSuccess: (r) => {
      if (r.reporte) setPanel(panelDeSincronizacion(r.reporte, 'Cubicación creada desde el presupuesto'));
      refrescar();
    },
    onError: aviso,
  });
  const sincronizar = useMutation({
    mutationFn: () => sincronizarCubicacion(proyecto.id),
    onSuccess: (r) => {
      setPanel(panelDeSincronizacion(r.reporte, 'Presupuesto leído de nuevo'));
      refrescar();
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
  const informe = useMutation({
    mutationFn: (soloRectificadas: boolean) => descargarInformeCubicacion(proyecto.id, { piso: filtro.piso, torre: filtro.torre, soloRectificadas }),
    onSuccess: (blob) => descargarBlob(blob, `Cubicación ${proyecto.obra}.xlsx`),
    onError: aviso,
  });

  const elegirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (!/\.xlsx$/i.test(archivo.name)) {
      mostrarToast('La planilla debe ser un archivo Excel (.xlsx).', { tipo: 'info' });
      return;
    }
    subir.mutate(archivo);
  };

  const entradaArchivo = (
    <input ref={entrada} type="file" accept=".xlsx" className="hidden" onChange={elegirArchivo} aria-label="Elegir planilla de cubicación" data-testid="planilla-cubicacion" />
  );

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (isError) {
    return <div className="p-8 text-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">No se pudo cargar la cubicación. Intenta de nuevo en unos minutos.</div>;
  }

  return (
    <div className="space-y-4">
      {entradaArchivo}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">Cubicación</h2>
          <p className="text-xs text-slate-500 max-w-2xl">
            Paso previo y opcional de las fases. Lo que ya sabemos del presupuesto de HETMO (tipos, descripción, medidas, cantidades y precios) se lee solo: aquí solo se completa dónde va
            cada ventana y su rasgo medido en obra. Sin cubicación, las fases se crean con el modal de siempre.
          </p>
        </div>
        {cubicacion && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />} isLoading={plantilla.isPending} onClick={() => plantilla.mutate()} title="Excel con una fila por ventana y lo que el sistema ya sabe, para completar piso, depto y rasgo">
              Descargar planilla para completar
            </Button>
            <Button variant="outline" size="sm" leftIcon={<Upload className="w-3.5 h-3.5" />} isLoading={subir.isPending} onClick={() => entrada.current?.click()}>
              Subir planilla completada
            </Button>
          </div>
        )}
      </div>

      {panel && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-1" role="status" data-testid="reporte-importacion">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold">{panel.titulo}</p>
            <button type="button" onClick={() => setPanel(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer" aria-label="Cerrar el resultado">
              <X className="w-3.5 h-3.5" />
            </button>
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

      {!cubicacion || !resumen ? (
        <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs space-y-3">
          <Ruler className="w-6 h-6 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700">Esta obra aún no tiene cubicación.</p>
          {presupuesto ? (
            <>
              <p className="max-w-xl mx-auto" data-testid="presupuesto-disponible">
                El presupuesto de HETMO (versión {presupuesto.versionNumero}) ya trae <b>{presupuesto.lineas} líneas</b>: {presupuesto.ventanas} ventana(s) y {presupuesto.areasComunes} ítem(s) sin medidas
                (áreas comunes){presupuesto.moneda ? `, en ${presupuesto.moneda}` : ''}. Se leen solas: después solo falta indicar dónde va cada ventana y medir el rasgo.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="primary" size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} isLoading={crear.isPending} onClick={() => crear.mutate(true)}>
                  Crear cubicación desde el presupuesto
                </Button>
              </div>
              <p className="text-[11px] text-slate-400">
                ¿Ya tienes una planilla de cubicación (la de siempre)?{' '}
                <button type="button" className="text-brand-700 hover:underline cursor-pointer" onClick={() => entrada.current?.click()}>
                  Súbela
                </button>{' '}
                o{' '}
                <button type="button" className="text-brand-700 hover:underline cursor-pointer" onClick={() => crear.mutate(false)}>
                  crea la cubicación vacía
                </button>
                .
              </p>
            </>
          ) : (
            <>
              <p className="max-w-lg mx-auto">
                Esta obra no tiene líneas de ventana en un presupuesto de HETMO, así que no hay nada que leer solo. Crea la cubicación vacía y agrega las ventanas, o sube una planilla de cubicación.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" size="sm" leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />} isLoading={subir.isPending} onClick={() => entrada.current?.click()}>
                  Subir planilla (.xlsx)
                </Button>
                <Button variant="outline" size="sm" isLoading={crear.isPending} onClick={() => crear.mutate(false)}>
                  Crear cubicación vacía
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <Resumen r={resumen} />
          {resumen.sinPosicion > 0 && (
            <p className="text-xs text-slate-600 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2" data-testid="siguiente-paso">
              <b>Siguiente paso:</b> faltan {resumen.sinPosicion} ventana(s) por ubicar. Descarga la planilla, completa torre, piso y depto de cada una (y el rasgo si ya lo midieron) y súbela; o
              edítalas aquí una por una.
            </p>
          )}
          <SubTabs
            tabs={[
              { id: 'ventanas', label: `Ventanas (${resumen.ventanas})` },
              { id: 'tipos', label: `Tipos (${resumen.tipos})` },
            ]}
            active={vista}
            onChange={setVista}
          />
          {vista === 'ventanas' ? (
            <VentanasCubicacion proyectoId={proyecto.id} cubicacion={cubicacion} tipos={resumen.porTipo} filtro={filtro} onFiltro={setFiltro} />
          ) : (
            <TiposCubicacion proyectoId={proyecto.id} moneda={cubicacion.moneda} tipos={resumen.porTipo} />
          )}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
            <span className="mr-2">
              Holgura: <b>{cubicacion.holguraMm} mm</b> · Nomenclatura: <b className="font-mono">{cubicacion.formatoNomenclatura}</b>
            </span>
            {presupuesto && (
              <Button variant="ghost" size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} isLoading={sincronizar.isPending} onClick={() => sincronizar.mutate()} title="Vuelve a leer el presupuesto de HETMO (no pisa lo ya cargado)">
                Actualizar desde el presupuesto
              </Button>
            )}
            <Button variant="ghost" size="sm" leftIcon={<Settings2 className="w-3.5 h-3.5" />} onClick={() => setConfig(true)}>
              Configuración
            </Button>
            <Button variant="ghost" size="sm" leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />} isLoading={informe.isPending} onClick={() => informe.mutate(false)} title="Excel con las ventanas ya posicionadas (filtro actual), para crear la fase en HETMO">
              Informe para HETMO
            </Button>
            <button type="button" onClick={() => informe.mutate(true)} className="text-brand-700 hover:underline cursor-pointer">
              solo las rectificadas
            </button>
          </div>
        </>
      )}

      {config && cubicacion && <ConfigCubicacionModal proyectoId={proyecto.id} cubicacion={cubicacion} onClose={() => setConfig(false)} />}
    </div>
  );
};
