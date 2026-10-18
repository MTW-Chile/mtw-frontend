import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileDown, Loader2, Package, PenLine, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  actualizarPreciosAdicional,
  addAdicionalItem,
  cambiarEstadoAdicional,
  deleteAdicionalItem,
  getAdicional,
  getAnalitica,
  getConfiguracionEmpresa,
  getPartidas,
  getPlantillasOferta,
  renderPdf,
  updateAdicional,
  updateAdicionalItem,
  getVersion,
} from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { TABLE_CLASS, TABLE_WRAPPER_CLASS } from '../../../lib/designSystem';
import { usePermisos } from '../../../lib/permisos';
import { loadImageDataUrl } from '../../cotizaciones/lib/pdfTheme';
import { MaterialPicker } from '../../cotizaciones/steps/Step2Lineas/MaterialPicker';
import { avisarError } from '../../configuracion/catalogo/comun';
import type { Adicional, EstadoAdicional, Material, Proyecto } from '../../../types';
import { ETIQUETA_ESTADO_ADICIONAL, ETIQUETA_FORMA_COBRO } from '../../../types';
import { buildAdicionalHtml } from './adicionalPdf';
import { VentanasAdicional } from './VentanasAdicional';
import { buildDocumentoHtml, buildHeaderFooterTemplates, rasterizarDibujos } from '../../cotizaciones/steps/Step5Consolidacion/presupuestoPdf';
import { VARIANTE_ESTADO, clp, codigoAdicional, uf, useTasasVigentes } from './comun';

const campo = 'text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-600 bg-white disabled:bg-slate-50 disabled:text-slate-500';

// Numero editable que guarda al salir del campo (no en cada tecla).
const NumeroEditable: React.FC<{ valor: number; disabled: boolean; onGuardar: (v: number) => void; className?: string }> = ({ valor, disabled, onGuardar, className }) => {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);
  return (
    <input
      type="number"
      step="any"
      min={0}
      disabled={disabled}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        const n = Number(texto);
        if (Number.isFinite(n) && n !== valor) onGuardar(n);
        else setTexto(String(valor));
      }}
      className={`${campo} text-right ${className ?? 'w-24'}`}
    />
  );
};

/**
 * Un adicional: ítems (material del catálogo con su precio vigente, o ítem
 * libre con su partida), divisas y margen, textos, flujo de estados (con
 * aprobación si la configuración la exige) y su PDF. Solo un borrador se
 * edita; la partida de un ítem libre se puede reclasificar siempre.
 */
export const AdicionalDetalle: React.FC<{ proyecto: Proyecto; adicionalId: string; onVolver: () => void }> = ({ proyecto, adicionalId, onVolver }) => {
  const queryClient = useQueryClient();
  const { tiene } = usePermisos();
  const puedeEditar = tiene('adicionales.editar');
  const puedeAprobar = tiene('adicionales.aprobar');
  const { tasas: tasasDelDia } = useTasasVigentes();
  // Cuelga del detalle del proyecto: lo que guardan la Analítica y la Hoja de
  // su versión (que invalidan ese detalle) refresca también sus totales.
  const claveAdicional = ['proyectoDetail', proyecto.id, 'adicional', adicionalId];
  const { data: a, isLoading } = useQuery({ queryKey: claveAdicional, queryFn: () => getAdicional(adicionalId) });
  const { data: partidas = [] } = useQuery({ queryKey: ['partidas'], queryFn: getPartidas });
  const { data: plantillas = [] } = useQuery({ queryKey: ['plantillasOferta', 'ADICIONAL'], queryFn: () => getPlantillasOferta('ADICIONAL') });
  const [agregando, setAgregando] = useState<'material' | 'libre' | null>(null);
  const [exportando, setExportando] = useState(false);

  const aplicar = (actualizado: Adicional) => {
    queryClient.setQueryData(claveAdicional, actualizado);
    queryClient.invalidateQueries({ queryKey: ['adicionales', proyecto.id] });
  };
  const mutacion = <T,>(fn: (v: T) => Promise<Adicional>) => useMutation({ mutationFn: fn, onSuccess: aplicar, onError: avisarError });
  const editar = mutacion((p: Parameters<typeof updateAdicional>[1]) => updateAdicional(adicionalId, p));
  const editarItem = mutacion((v: { itemId: string; payload: Parameters<typeof updateAdicionalItem>[2] }) => updateAdicionalItem(adicionalId, v.itemId, v.payload));
  const quitarItem = mutacion((itemId: string) => deleteAdicionalItem(adicionalId, itemId));
  const agregar = mutacion((p: Parameters<typeof addAdicionalItem>[1]) => addAdicionalItem(adicionalId, p));
  const actualizarPrecios = mutacion(() => actualizarPreciosAdicional(adicionalId, tasasDelDia ?? undefined));
  const estado = mutacion((v: { estado: EstadoAdicional; motivo?: string }) => cambiarEstadoAdicional(adicionalId, v.estado, v.motivo));

  if (isLoading || !a) {
    return (
      <div className="p-12 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const borrador = a.estado === 'BORRADOR' && puedeEditar;
  const partidasActivas = partidas.filter((p) => p.activa);

  const exportarPdf = async () => {
    setExportando(true);
    try {
      let logo: string | null = null;
      try {
        logo = await loadImageDataUrl('/mtw-logo.png');
      } catch {
        // decorativo
      }
      const nombre = `adicional-${(a.proyecto.codigoInterno ?? a.proyecto.obra).replace(/\s+/g, '-')}-A${a.numero}.pdf`;
      const blob = a.versionId ? await pdfVentanas(a, logo, nombre) : await renderPdf(buildAdicionalHtml({ adicional: a, logoDataUrl: logo }), nombre);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nombre;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      avisarError(err);
    } finally {
      setExportando(false);
    }
  };

  // Acciones de estado disponibles para quien mira.
  const acciones: { label: string; hacia: EstadoAdicional; variante?: 'primary' | 'outline'; visible: boolean; motivo?: boolean }[] = [
    { label: 'Solicitar aprobación', hacia: 'ESPERANDO_APROBACION', visible: a.estado === 'BORRADOR' && a.requiereAprobacion && puedeEditar },
    { label: 'Marcar como enviado', hacia: 'ENVIADO', visible: ((a.estado === 'BORRADOR' && !a.requiereAprobacion) || a.estado === 'APROBADO') && puedeEditar },
    { label: 'Aprobar', hacia: 'APROBADO', visible: a.estado === 'ESPERANDO_APROBACION' && puedeAprobar },
    { label: 'Aceptado', hacia: 'ACEPTADO', visible: a.estado === 'ENVIADO' && puedeEditar },
    { label: 'Rechazado', hacia: 'RECHAZADO', variante: 'outline', visible: a.estado === 'ENVIADO' && puedeEditar, motivo: true },
    { label: 'Volver a borrador', hacia: 'BORRADOR', variante: 'outline', visible: ['ESPERANDO_APROBACION', 'APROBADO', 'ENVIADO', 'RECHAZADO'].includes(a.estado) && puedeEditar },
    { label: 'Anular', hacia: 'ANULADO', variante: 'outline', visible: !['ACEPTADO', 'ANULADO'].includes(a.estado) && puedeEditar },
  ];

  return (
    <div className="space-y-4">
      <button onClick={onVolver} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" /> Adicionales de la obra
      </button>

      {/* Encabezado */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-slate-500">{codigoAdicional(a)}</span>
              <Badge size="sm" variant={VARIANTE_ESTADO[a.estado]}>
                {ETIQUETA_ESTADO_ADICIONAL[a.estado]}
              </Badge>
              {a.estado === 'BORRADOR' && a.requiereAprobacion && <Badge size="sm" variant="warning">Requiere aprobación</Badge>}
            </div>
            {borrador ? (
              <input defaultValue={a.titulo} onBlur={(e) => e.target.value.trim() && e.target.value !== a.titulo && editar.mutate({ titulo: e.target.value.trim() })} className={`${campo} w-full text-sm font-bold`} />
            ) : (
              <h2 className="text-base font-extrabold text-slate-900">{a.titulo}</h2>
            )}
            <p className="text-xs text-slate-500">
              {a.cargoA === 'CLIENTE'
                ? `A cargo del cliente${a.proyecto.cliente ? `: ${a.proyecto.cliente.nombre}` : ' (la obra aún no tiene cliente vinculado)'}`
                : `A cargo del instalador ${a.instalador?.nombre ?? ''} · ${a.formaCobroInstalador ? ETIQUETA_FORMA_COBRO[a.formaCobroInstalador] : ''}`}
              {a.obraPendiente && ` · Pendiente ${a.obraPendiente.numero}`}
            </p>
            {a.motivoRechazo && <p className="text-xs text-rose-700">Rechazado: {a.motivoRechazo}</p>}
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end shrink-0">
            {acciones
              .filter((x) => x.visible)
              .map((x) => (
                <Button
                  key={x.hacia}
                  size="sm"
                  variant={x.variante ?? 'primary'}
                  disabled={estado.isPending}
                  onClick={() => {
                    if (x.motivo) {
                      const motivo = window.prompt('Motivo del rechazo');
                      if (motivo?.trim()) estado.mutate({ estado: x.hacia, motivo: motivo.trim() });
                      return;
                    }
                    if (x.hacia === 'ANULADO' && !window.confirm('¿Anular este adicional? No se puede deshacer.')) return;
                    estado.mutate({ estado: x.hacia });
                  }}
                >
                  {x.label}
                </Button>
              ))}
            <Button
              size="sm"
              variant="outline"
              leftIcon={<FileDown className="w-3.5 h-3.5" />}
              onClick={exportarPdf}
              isLoading={exportando}
              disabled={a.versionId ? !a.version?.ventanas.length : a.items.length === 0}
            >
              PDF
            </Button>
          </div>
        </div>
      </section>

      {/* Divisas, margen y totales */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-2 text-xs">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Precios y divisas vigentes</h3>
          <p className="text-slate-600">
            Al {new Date(a.preciosAl).toLocaleDateString('es-CL')}: dólar {Number(a.tasaDolar).toLocaleString('es-CL')} · euro {Number(a.tasaEuro).toLocaleString('es-CL')} · UF{' '}
            {Number(a.tasaUf).toLocaleString('es-CL')}
          </p>
          {borrador && (
            <Button size="sm" variant="outline" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} isLoading={actualizarPrecios.isPending} onClick={() => actualizarPrecios.mutate(undefined)}>
              Actualizar precios y divisas a hoy
            </Button>
          )}
          {a.origen === 'ITEMS' ? (
            <label className="flex items-center gap-2 pt-2">
              <span className="text-slate-600">Margen de venta</span>
              <NumeroEditable valor={Number(a.margenPct)} disabled={!borrador} onGuardar={(v) => editar.mutate({ margenPct: Math.min(99, v) })} className="w-20" />
              <span className="text-slate-400">%</span>
            </label>
          ) : (
            <p className="pt-2 text-slate-500">El margen y los costos de flete e instalación se fijan en la Hoja de fijación de abajo.</p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs self-start">
          <dt className="text-slate-500">Costo</dt>
          <dd className="text-right font-mono">{clp(a.totales.costo)}</dd>
          <dt className="text-slate-500">Venta neto</dt>
          <dd className="text-right font-mono font-bold text-slate-900">
            {clp(a.totales.venta)} <span className="text-slate-400 font-normal">({uf(a.totales.ventaUf)})</span>
          </dd>
          <dt className="text-slate-500">IVA ({a.totales.ivaPct}%)</dt>
          <dd className="text-right font-mono">{clp(a.totales.iva)}</dd>
          <dt className="text-slate-500">Total</dt>
          <dd className="text-right font-mono font-bold">{clp(a.totales.totalConIva)}</dd>
        </dl>
      </section>

      {a.origen === 'ITEMS' ? (
        <>
      {/* Items */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Ítems</h3>
          {borrador && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" leftIcon={<Package className="w-3.5 h-3.5" />} onClick={() => setAgregando('material')}>
                Material del catálogo
              </Button>
              <Button size="sm" variant="outline" leftIcon={<PenLine className="w-3.5 h-3.5" />} onClick={() => setAgregando('libre')}>
                Ítem libre
              </Button>
            </div>
          )}
        </div>
        {agregando === 'material' && (
          <AgregarMaterial onCancelar={() => setAgregando(null)} onAgregar={(p) => agregar.mutate(p, { onSuccess: () => setAgregando(null) })} pendiente={agregar.isPending} />
        )}
        {agregando === 'libre' && (
          <AgregarLibre
            partidas={partidasActivas}
            onCancelar={() => setAgregando(null)}
            onAgregar={(p) => agregar.mutate(p, { onSuccess: () => setAgregando(null) })}
            pendiente={agregar.isPending}
          />
        )}
        <div className={TABLE_WRAPPER_CLASS}>
          <table className={`${TABLE_CLASS} text-left text-slate-700`}>
            <thead className="bg-slate-50/80 border-b border-slate-200 uppercase">
              <tr>
                <th className="py-2.5">Descripción</th>
                <th className="py-2.5">Partida</th>
                <th className="py-2.5 text-right">Cantidad</th>
                <th className="py-2.5 text-right">Costo unit.</th>
                <th className="py-2.5 text-right">Precio unit.</th>
                <th className="py-2.5 text-right">Total</th>
                {borrador && <th className="py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {a.items.map((i) => (
                <tr key={i.id} className={i.porClasificar ? 'bg-amber-50/50' : ''}>
                  <td className="py-2">
                    <div className="font-semibold text-slate-800">{i.descripcion}</div>
                    <div className="text-[10px] text-slate-400">{i.materialId ? 'Catálogo · precio vigente' : 'Ítem libre'}</div>
                  </td>
                  <td className="py-2">
                    {!i.materialId && puedeEditar ? (
                      <select
                        value={i.partidaId}
                        onChange={(e) => editarItem.mutate({ itemId: i.id, payload: { partidaId: e.target.value } })}
                        className={`${campo} ${i.porClasificar ? 'border-amber-300 bg-amber-50 text-amber-800' : ''}`}
                        title={i.porClasificar ? 'Por clasificar: no se contabiliza hasta asignarle partida' : undefined}
                      >
                        {partidas
                          .filter((p) => p.activa || p.id === i.partidaId)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.porDefecto ? `⚠ ${p.nombre}` : p.nombre}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <span className="text-[11px]">{i.partida.nombre}</span>
                    )}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {borrador ? (
                      <NumeroEditable valor={Number(i.cantidad)} disabled={false} onGuardar={(v) => v > 0 && editarItem.mutate({ itemId: i.id, payload: { cantidad: v } })} className="w-20" />
                    ) : (
                      Number(i.cantidad).toLocaleString('es-CL')
                    )}{' '}
                    <span className="text-slate-400">{i.unidad}</span>
                  </td>
                  <td className="py-2 text-right font-mono">
                    {borrador && !i.materialId ? (
                      <NumeroEditable valor={Number(i.costoUnitario)} disabled={false} onGuardar={(v) => editarItem.mutate({ itemId: i.id, payload: { costoUnitario: v } })} />
                    ) : (
                      clp(Number(i.costoUnitario))
                    )}
                  </td>
                  <td className="py-2 text-right font-mono">{clp(i.precioUnitario)}</td>
                  <td className="py-2 text-right font-mono font-bold">{clp(i.precioTotal)}</td>
                  {borrador && (
                    <td className="py-2 text-right">
                      <button onClick={() => quitarItem.mutate(i.id)} className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer" aria-label={`Quitar ${i.descripcion}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {a.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Sin ítems todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

        </>
      ) : (
        <VentanasAdicional proyecto={proyecto} adicional={a} editable={borrador} onCambio={aplicar} />
      )}

      {/* Textos */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Textos del documento</h3>
          {borrador && plantillas.length > 1 && (
            <select
              value={a.plantillaOfertaId ?? ''}
              onChange={(e) => window.confirm('¿Reemplazar los textos por los de esta plantilla?') && editar.mutate({ plantillaOfertaId: e.target.value })}
              className={campo}
            >
              {plantillas
                .filter((p) => p.activa)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
            </select>
          )}
        </div>
        <textarea
          key={`t-${a.plantillaOfertaId}`}
          defaultValue={a.textoPresentacion}
          disabled={!borrador}
          rows={2}
          onBlur={(e) => e.target.value !== a.textoPresentacion && editar.mutate({ textoPresentacion: e.target.value })}
          className={`${campo} w-full`}
        />
        <textarea
          key={`c-${a.plantillaOfertaId}`}
          defaultValue={a.condicionesComerciales}
          disabled={!borrador}
          rows={5}
          onBlur={(e) => e.target.value !== a.condicionesComerciales && editar.mutate({ condicionesComerciales: e.target.value })}
          className={`${campo} w-full`}
        />
      </section>

      {a.ordenesCompra.length > 0 && (
        <p className="text-[11px] text-slate-500">Compras de este adicional: {a.ordenesCompra.map((oc) => `${oc.numero} (${oc.estado})`).join(', ')}</p>
      )}
    </div>
  );
};

const AgregarMaterial: React.FC<{ onAgregar: (p: Parameters<typeof addAdicionalItem>[1]) => void; onCancelar: () => void; pendiente: boolean }> = ({
  onAgregar,
  onCancelar,
  pendiente,
}) => {
  const [material, setMaterial] = useState<Material | null>(null);
  const [cantidad, setCantidad] = useState('1');
  const [ancho, setAncho] = useState('');
  const [alto, setAlto] = useState('');
  // Pieza a medida (ej. vidrio): se cotiza por su área, con sus medidas.
  const pieza = !!material?.tipoProducto?.compraPorPieza;
  return (
    <div className="p-4 border-b border-slate-100 bg-brand-50/30 space-y-3">
      {!material ? (
        <MaterialPicker onSelect={setMaterial} placeholder="Buscar material en el maestro…" />
      ) : (
        <div className="flex flex-wrap items-end gap-3 text-xs">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-800">
              {material.skuInterno} · {material.descripcion}
            </div>
            <button onClick={() => setMaterial(null)} className="text-[11px] text-brand-600 hover:underline cursor-pointer">
              Cambiar
            </button>
          </div>
          <label className="space-y-1">
            <span className="block text-[11px] text-slate-500">Cantidad</span>
            <input type="number" min={0} step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={`${campo} w-24 text-right`} />
          </label>
          {pieza && (
            <>
              <label className="space-y-1">
                <span className="block text-[11px] text-slate-500">Ancho (mm)</span>
                <input type="number" min={1} value={ancho} onChange={(e) => setAncho(e.target.value)} className={`${campo} w-24 text-right`} />
              </label>
              <label className="space-y-1">
                <span className="block text-[11px] text-slate-500">Alto (mm)</span>
                <input type="number" min={1} value={alto} onChange={(e) => setAlto(e.target.value)} className={`${campo} w-24 text-right`} />
              </label>
            </>
          )}
          <Button
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            isLoading={pendiente}
            disabled={!(Number(cantidad) > 0)}
            onClick={() =>
              onAgregar({
                materialId: material.id,
                cantidad: Number(cantidad),
                ...(pieza && Number(ancho) > 0 && Number(alto) > 0 ? { anchoMm: Math.round(Number(ancho)), altoMm: Math.round(Number(alto)) } : {}),
              })
            }
          >
            Agregar
          </Button>
        </div>
      )}
      <button onClick={onCancelar} className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer">
        Cancelar
      </button>
    </div>
  );
};

const AgregarLibre: React.FC<{
  partidas: { id: string; nombre: string; porDefecto: boolean }[];
  onAgregar: (p: Parameters<typeof addAdicionalItem>[1]) => void;
  onCancelar: () => void;
  pendiente: boolean;
}> = ({ partidas, onAgregar, onCancelar, pendiente }) => {
  const sinAsignar = partidas.find((p) => p.porDefecto)?.id ?? '';
  const [d, setD] = useState({ descripcion: '', unidad: 'UN', cantidad: '1', costo: '', partidaId: sinAsignar });
  const completo = d.descripcion.trim() && d.unidad.trim() && Number(d.cantidad) > 0 && d.costo !== '' && Number(d.costo) >= 0;
  return (
    <div className="p-4 border-b border-slate-100 bg-brand-50/30 space-y-2">
      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label className="space-y-1 flex-1 min-w-[200px]">
          <span className="block text-[11px] text-slate-500">Descripción</span>
          <input value={d.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} className={`${campo} w-full`} />
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] text-slate-500">Unidad</span>
          <input value={d.unidad} onChange={(e) => setD({ ...d, unidad: e.target.value })} className={`${campo} w-20`} />
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] text-slate-500">Cantidad</span>
          <input type="number" min={0} step="any" value={d.cantidad} onChange={(e) => setD({ ...d, cantidad: e.target.value })} className={`${campo} w-20 text-right`} />
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] text-slate-500">Costo unit. (CLP)</span>
          <input type="number" min={0} step="any" value={d.costo} onChange={(e) => setD({ ...d, costo: e.target.value })} className={`${campo} w-28 text-right`} />
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] text-slate-500">Partida</span>
          <select
            value={d.partidaId}
            onChange={(e) => setD({ ...d, partidaId: e.target.value })}
            className={`${campo} ${d.partidaId === sinAsignar ? 'border-amber-300 bg-amber-50 text-amber-800' : ''}`}
          >
            {partidas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.porDefecto ? `⚠ ${p.nombre}` : p.nombre}
              </option>
            ))}
          </select>
        </label>
        <Button
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          isLoading={pendiente}
          disabled={!completo}
          onClick={() =>
            onAgregar({ descripcion: d.descripcion.trim(), unidad: d.unidad.trim(), cantidad: Number(d.cantidad), costoUnitario: Number(d.costo), partidaId: d.partidaId || undefined })
          }
        >
          Agregar
        </Button>
      </div>
      {d.partidaId === sinAsignar && (
        <p className="text-[11px] text-amber-700">Sin partida queda “por clasificar”: cuenta en el adicional, pero no se contabiliza hasta asignársela.</p>
      )}
      <button onClick={onCancelar} className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer">
        Cancelar
      </button>
    </div>
  );
};

/**
 * PDF de un adicional de ventanas: el mismo formato de la oferta (tarjetas con
 * dibujo y precio por línea), con los textos del adicional. Precio por línea
 * y venta salen de la Analítica de su versión.
 */
async function pdfVentanas(a: Adicional, logo: string | null, nombre: string): Promise<Blob> {
  const tasas = { dolar: Number(a.tasaDolar), euro: Number(a.tasaEuro), uf: Number(a.tasaUf) };
  const [version, analitica, empresa] = await Promise.all([getVersion(a.versionId!), getAnalitica(a.versionId!, tasas), getConfiguracionEmpresa()]);
  const ventanas = version.ventanas ?? [];
  const pngPorVentana = await rasterizarDibujos(ventanas);
  const proyecto = { obra: a.proyecto.obra, codigoInterno: a.proyecto.codigoInterno, numeroPresupuesto: 0, cliente: a.proyecto.cliente } as unknown as Proyecto;
  const codigoLabel = `Adicional A${a.numero} · ${a.proyecto.codigoInterno ?? a.proyecto.obra}`;
  const html = buildDocumentoHtml({
    proyecto,
    ventanas,
    texto: a.textoPresentacion,
    condiciones: a.condicionesComerciales,
    venta: a.totales.venta,
    iva: a.totales.iva,
    totalConIva: a.totales.totalConIva,
    ivaPct: a.totales.ivaPct,
    tasaUf: tasas.uf,
    logoDataUrl: logo,
    logoMuchtekDataUrl: null,
    preciosVenta: new Map(analitica.preciosVenta.map(({ ventanaId, ...p }) => [ventanaId, p])),
    pngPorVentana,
    titulo: 'Cotización de adicional',
    codigoLabel,
  });
  const e = empresa.configuracionEmpresa;
  const { headerTemplate, footerTemplate } = buildHeaderFooterTemplates({
    proyecto,
    logoDataUrl: logo,
    codigoLabel,
    footerWebUrl: e?.footerWebUrl,
    footerWebLabel: e?.footerWebLabel,
    footerInstagramUrl: e?.footerInstagramUrl,
    footerInstagramHandle: e?.footerInstagramHandle,
  });
  return renderPdf(html, nombre, { headerTemplate, footerTemplate });
}
