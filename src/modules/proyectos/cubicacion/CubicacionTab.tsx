import React, { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, FileSpreadsheet, Loader2, Ruler, Settings2, X } from 'lucide-react';
import { crearCubicacion, descargarInformeCubicacion, getCubicacion, importarPlanillaCubicacion } from '../../../api/client';
import { SubTabs } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { Proyecto, ReporteImportacionCubicacion, ResumenCubicacion } from '../../../types';
import { ConfigCubicacionModal } from './ConfigCubicacionModal';
import { TiposCubicacion } from './TiposCubicacion';
import { VentanasCubicacion, type FiltroVentanas } from './VentanasCubicacion';
import { descargarBlob, formatoMonto } from './utils';

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

const Resumen: React.FC<{ r: ResumenCubicacion }> = ({ r }) => {
  const contratadas = r.porTipo.filter((t) => !t.esAreaComun).reduce((s, t) => s + t.cantidadContratada, 0);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid="resumen-cubicacion">
      <Dato titulo="Ventanas cubicadas" valor={`${r.ventanas} de ${contratadas}`} detalle={`${r.posicionadas} con posición`} />
      <Dato titulo="Rectificadas" valor={r.rectificadas} detalle={r.ventanas ? `${Math.round((r.rectificadas / r.ventanas) * 100)} % de las cubicadas` : '—'} />
      <Dato titulo="Superficie" valor={`${r.m2.toLocaleString('es-CL', { maximumFractionDigits: 1 })} m²`} detalle="fabricación si ya se rectificó; si no, plano" />
      <Dato titulo="Contratado" valor={formatoMonto(r.precio.contratado, r.moneda)} detalle={`Saldo por cubicar ${formatoMonto(r.precio.saldo, r.moneda)}`} />
    </div>
  );
};

// Cubicacion de la obra: paso previo y OPCIONAL de las fases. Reparte las ventanas por torre / piso /
// departamento, registra la rectificacion (rasgo medido en obra) y fija la nomenclatura final. Sin
// cubicacion, las fases se crean con el modal de siempre.
export const CubicacionTab: React.FC<Props> = ({ proyecto }) => {
  const queryClient = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<'ventanas' | 'tipos'>('ventanas');
  const [config, setConfig] = useState(false);
  const [filtro, setFiltro] = useState<FiltroVentanas>({ piso: '', torre: '' });
  const [reporte, setReporte] = useState<ReporteImportacionCubicacion | null>(null);

  const { data, isLoading, isError } = useQuery({ queryKey: ['cubicacion', proyecto.id], queryFn: () => getCubicacion(proyecto.id) });
  const cubicacion = data?.cubicacion ?? null;
  const resumen = data?.resumen ?? null;

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['cubicacion', proyecto.id] });
    queryClient.invalidateQueries({ queryKey: ['cubicacionUnidades', proyecto.id] });
    queryClient.invalidateQueries({ queryKey: ['cubicacionUbicaciones', proyecto.id] });
  };

  const crear = useMutation({ mutationFn: () => crearCubicacion(proyecto.id), onSuccess: refrescar, onError: aviso });
  const importar = useMutation({
    mutationFn: (archivo: File) => importarPlanillaCubicacion(proyecto.id, archivo),
    onSuccess: (r) => {
      setReporte(r.reporte);
      refrescar();
    },
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
    importar.mutate(archivo);
  };

  const botonImportar = (
    <>
      <input ref={entrada} type="file" accept=".xlsx" className="hidden" onChange={elegirArchivo} aria-label="Elegir planilla de cubicación" data-testid="planilla-cubicacion" />
      <Button variant={cubicacion ? 'outline' : 'primary'} size="sm" leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />} isLoading={importar.isPending} onClick={() => entrada.current?.click()}>
        Importar planilla (.xlsx)
      </Button>
    </>
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">Cubicación</h2>
          <p className="text-xs text-slate-500 max-w-2xl">
            Paso previo y opcional de las fases: reparte las ventanas por torre, piso y departamento, registra lo medido en obra (rectificación) y fija la nomenclatura. Sin cubicación, las
            fases se crean con el modal de siempre.
          </p>
        </div>
        {cubicacion && (
          <div className="flex flex-wrap items-center gap-2">
            {botonImportar}
            <Button variant="outline" size="sm" leftIcon={<Settings2 className="w-3.5 h-3.5" />} onClick={() => setConfig(true)}>
              Configuración
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />} isLoading={informe.isPending} onClick={() => informe.mutate(false)} title="Excel con las ventanas del filtro actual, para crear la fase en HETMO">
              Informe Excel
            </Button>
          </div>
        )}
      </div>

      {reporte && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-1" role="status" data-testid="reporte-importacion">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold">Planilla importada</p>
            <button type="button" onClick={() => setReporte(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer" aria-label="Cerrar el resultado">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p>
            Tipos: {reporte.tipos.nuevos} nuevos, {reporte.tipos.actualizados} actualizados · Ventanas: {reporte.unidades.nuevas} nuevas, {reporte.unidades.existentes} ya existían
            {reporte.unidades.rectificadasAhora > 0 && `, ${reporte.unidades.rectificadasAhora} con rasgo cargado`} · Áreas comunes: {reporte.unidades.areasComunes}
          </p>
          {reporte.advertencias.length > 0 && (
            <details className="text-amber-900">
              <summary className="flex items-center gap-1 cursor-pointer font-bold">
                <AlertTriangle className="w-3.5 h-3.5" /> {reporte.advertencias.length} advertencia(s)
              </summary>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {reporte.advertencias.slice(0, 30).map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {!cubicacion || !resumen ? (
        <div className="p-10 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs space-y-3">
          <Ruler className="w-6 h-6 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700">Esta obra aún no tiene cubicación.</p>
          <p className="max-w-lg mx-auto">
            Importa la planilla de cubicación (hoja BASE con los tipos y una hoja por piso) o crea una vacía y agrega las ventanas a mano. Es opcional: puedes crear las fases sin cubicar.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {botonImportar}
            <Button variant="outline" size="sm" isLoading={crear.isPending} onClick={() => crear.mutate()}>
              Crear cubicación vacía
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Resumen r={resumen} />
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
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span>
              Holgura: <b>{cubicacion.holguraMm} mm</b> · Nomenclatura: <b className="font-mono">{cubicacion.formatoNomenclatura}</b>
            </span>
            <button type="button" onClick={() => informe.mutate(true)} className="text-brand-700 hover:underline cursor-pointer">
              Descargar solo las rectificadas
            </button>
          </div>
        </>
      )}

      {config && cubicacion && <ConfigCubicacionModal proyectoId={proyecto.id} cubicacion={cubicacion} onClose={() => setConfig(false)} />}
    </div>
  );
};
