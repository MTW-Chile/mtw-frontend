import React, { useState } from 'react';
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
import { usePermisos } from '../../../lib/permisos';
import { cargarLogoDocumentos } from '../../cotizaciones/lib/pdfTheme';
import { MaterialPicker } from '../../cotizaciones/steps/Step2Lineas/MaterialPicker';
import { avisarError } from '../../configuracion/catalogo/comun';
import type { Adicional, EstadoAdicional, Material, Proyecto } from '../../../types';
import { ETIQUETA_ESTADO_ADICIONAL, ETIQUETA_FORMA_COBRO } from '../../../types';
import { buildAdicionalHtml } from './adicionalPdf';
import { VentanasAdicional } from './VentanasAdicional';
import { buildDocumentoHtml, buildHeaderFooterTemplates, rasterizarDibujos } from '../../cotizaciones/steps/Step5Consolidacion/presupuestoPdf';
import { VARIANTE_ESTADO, clp, codigoAdicional, uf, useTasasVigentes } from './comun';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { Campo, InputCompacto, NumeroInput, SelectCompacto, Textarea } from '../../../components/ui/Campos';
import { IconButton } from '../../../components/ui/IconButton';
import { useMigas } from '../../../lib/migas';

// Número editable que guarda al salir del campo (no en cada tecla).
const NumeroEditable: React.FC<{ valor: number; disabled: boolean; onGuardar: (v: number) => void; className?: string }> = ({ valor, disabled, onGuardar, className }) => (
  <NumeroInput valor={valor} disabled={disabled} min={0} onGuardar={(v) => v !== null && onGuardar(v)} className={className ?? 'w-24'} aria-label="Valor" />
);

/**
 * Un adicional: ítems (material del catálogo con su precio vigente, o ítem
 * libre con su partida), divisas y margen, textos, flujo de estados (con
 * aprobación si la configuración la exige) y su PDF. Solo un borrador se
 * edita; la partida de un ítem libre se puede reclasificar siempre.
 */
export const AdicionalDetalle: React.FC<{ proyecto: Proyecto; adicionalId: string; onVolver: () => void }> = ({ proyecto, adicionalId, onVolver }) => {
  const { confirmar, pedirTexto } = useConfirmar();
  const queryClient = useQueryClient();
  const { tiene } = usePermisos();
  const puedeEditar = tiene('adicionales.editar');
  const puedeAprobar = tiene('adicionales.aprobar');
  const { tasas: tasasDelDia } = useTasasVigentes();
  // Cuelga del detalle del proyecto: lo que guardan la Analítica y la Hoja de
  // su versión (que invalidan ese detalle) refresca también sus totales.
  const claveAdicional = ['proyectoDetail', proyecto.id, 'adicional', adicionalId];
  const { data: a, isLoading } = useQuery({ queryKey: claveAdicional, queryFn: () => getAdicional(adicionalId) });
  useMigas(2, [a && { label: `${codigoAdicional(a)} · ${a.titulo}` }]);
  const { data: partidas = [] } = useQuery({ queryKey: ['partidas'], queryFn: getPartidas });
  const { data: plantillas = [] } = useQuery({ queryKey: ['plantillasOferta', 'ADICIONAL'], queryFn: () => getPlantillasOferta('ADICIONAL') });
  const [agregando, setAgregando] = useState<'material' | 'libre' | null>(null);
  const [exportando, setExportando] = useState(false);

  const aplicar = (actualizado: Adicional) => {
    queryClient.setQueryData(claveAdicional, actualizado);
    queryClient.invalidateQueries({ queryKey: ['adicionales', proyecto.id] });
  };
  const useMutacion = <T,>(fn: (v: T) => Promise<Adicional>) => useMutation({ mutationFn: fn, onSuccess: aplicar, onError: avisarError });
  const editar = useMutacion((p: Parameters<typeof updateAdicional>[1]) => updateAdicional(adicionalId, p));
  const editarItem = useMutacion((v: { itemId: string; payload: Parameters<typeof updateAdicionalItem>[2] }) => updateAdicionalItem(adicionalId, v.itemId, v.payload));
  const quitarItem = useMutacion((itemId: string) => deleteAdicionalItem(adicionalId, itemId));
  const agregar = useMutacion((p: Parameters<typeof addAdicionalItem>[1]) => addAdicionalItem(adicionalId, p));
  const actualizarPrecios = useMutacion(() => actualizarPreciosAdicional(adicionalId, tasasDelDia ?? undefined));
  const estado = useMutacion((v: { estado: EstadoAdicional; motivo?: string }) => cambiarEstadoAdicional(adicionalId, v.estado, v.motivo));

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
        logo = await cargarLogoDocumentos();
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
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={onVolver}>
        Adicionales de la obra
      </Button>

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
              <InputCompacto aria-label="Título del adicional" defaultValue={a.titulo} onBlur={(e) => e.target.value.trim() && e.target.value !== a.titulo && editar.mutate({ titulo: e.target.value.trim() })} className="w-full text-sm! font-bold" />
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
                  onClick={async () => {
                    if (x.motivo) {
                      const motivo = await pedirTexto({ titulo: 'Rechazar el adicional', etiqueta: 'Motivo del rechazo', requerido: true, confirmar: 'Rechazar', peligro: true });
                      if (motivo?.trim()) estado.mutate({ estado: x.hacia, motivo: motivo.trim() });
                      return;
                    }
                    if (x.hacia === 'ANULADO' && !(await confirmar({ titulo: '¿Anular este adicional?', mensaje: 'No se puede deshacer.', confirmar: 'Anular', peligro: true }))) return;
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
        <Tabla>
          <Thead>
            <Tr>
              <Th>Descripción</Th>
              <Th>Partida</Th>
              <Th alinear="derecha">Cantidad</Th>
              <Th alinear="derecha">Costo unit.</Th>
              <Th alinear="derecha">Precio unit.</Th>
              <Th alinear="derecha">Total</Th>
              {borrador && <Th />}
            </Tr>
          </Thead>
          <Tbody>
            {a.items.map((i) => (
              <Tr key={i.id} className={i.porClasificar ? 'bg-amber-50/50' : ''}>
                <Td>
                  <div className="font-semibold text-slate-800">{i.descripcion}</div>
                  <div className="text-[10px] text-slate-400">{i.materialId ? 'Catálogo · precio vigente' : 'Ítem libre'}</div>
                </Td>
                <Td>
                  {!i.materialId && puedeEditar ? (
                    <SelectCompacto
                      aria-label={`Partida de ${i.descripcion}`}
                      value={i.partidaId}
                      onChange={(e) => editarItem.mutate({ itemId: i.id, payload: { partidaId: e.target.value } })}
                      tono={i.porClasificar ? 'advertencia' : undefined}
                      title={i.porClasificar ? 'Por clasificar: no se contabiliza hasta asignarle partida' : undefined}
                    >
                      {partidas
                        .filter((p) => p.activa || p.id === i.partidaId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.porDefecto ? `⚠ ${p.nombre}` : p.nombre}
                          </option>
                        ))}
                    </SelectCompacto>
                  ) : (
                    <span className="text-[11px]">{i.partida.nombre}</span>
                  )}
                </Td>
                <Td alinear="derecha" className="whitespace-nowrap">
                  {borrador ? (
                    <NumeroEditable valor={Number(i.cantidad)} disabled={false} onGuardar={(v) => v > 0 && editarItem.mutate({ itemId: i.id, payload: { cantidad: v } })} className="w-20" />
                  ) : (
                    Number(i.cantidad).toLocaleString('es-CL')
                  )}{' '}
                  <span className="text-slate-400">{i.unidad}</span>
                </Td>
                <Td alinear="derecha" className="font-mono">
                  {borrador && !i.materialId ? (
                    <NumeroEditable valor={Number(i.costoUnitario)} disabled={false} onGuardar={(v) => editarItem.mutate({ itemId: i.id, payload: { costoUnitario: v } })} />
                  ) : (
                    clp(Number(i.costoUnitario))
                  )}
                </Td>
                <Td alinear="derecha" className="font-mono">{clp(i.precioUnitario)}</Td>
                <Td alinear="derecha" className="font-mono font-bold">{clp(i.precioTotal)}</Td>
                {borrador && (
                  <Td alinear="derecha">
                    <IconButton icono={Trash2} tono="peligro" etiqueta={`Quitar ${i.descripcion}`} onClick={() => quitarItem.mutate(i.id)} />
                  </Td>
                )}
              </Tr>
            ))}
            {a.items.length === 0 && (
              <Tr>
                <Td colSpan={7} alinear="centro" className="py-8 text-slate-400">
                  Sin ítems todavía.
                </Td>
              </Tr>
            )}
          </Tbody>
        </Tabla>
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
            <SelectCompacto
              aria-label="Plantilla de textos"
              value={a.plantillaOfertaId ?? ''}
              onChange={async (e) => {
                const id = e.target.value;
                if (await confirmar({ titulo: '¿Reemplazar los textos por los de esta plantilla?', confirmar: 'Reemplazar' })) editar.mutate({ plantillaOfertaId: id });
              }}
            >
              {plantillas
                .filter((p) => p.activa)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
            </SelectCompacto>
          )}
        </div>
        <Textarea
          aria-label="Texto de presentación"
          key={`t-${a.plantillaOfertaId}`}
          defaultValue={a.textoPresentacion}
          disabled={!borrador}
          rows={2}
          onBlur={(e) => e.target.value !== a.textoPresentacion && editar.mutate({ textoPresentacion: e.target.value })}
        />
        <Textarea
          aria-label="Condiciones comerciales"
          key={`c-${a.plantillaOfertaId}`}
          defaultValue={a.condicionesComerciales}
          disabled={!borrador}
          rows={5}
          onBlur={(e) => e.target.value !== a.condicionesComerciales && editar.mutate({ condicionesComerciales: e.target.value })}
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
            <Button variant="link" size="sm" onClick={() => setMaterial(null)}>
              Cambiar
            </Button>
          </div>
          <Campo label="Cantidad" className="shrink-0">
            <InputCompacto aria-label="Cantidad" type="number" min={0} step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-24 text-right" />
          </Campo>
          {pieza && (
            <>
              <Campo label="Ancho (mm)" className="shrink-0">
                <InputCompacto aria-label="Ancho (mm)" type="number" min={1} value={ancho} onChange={(e) => setAncho(e.target.value)} className="w-24 text-right" />
              </Campo>
              <Campo label="Alto (mm)" className="shrink-0">
                <InputCompacto aria-label="Alto (mm)" type="number" min={1} value={alto} onChange={(e) => setAlto(e.target.value)} className="w-24 text-right" />
              </Campo>
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
      <Button variant="ghost" size="sm" onClick={onCancelar}>
        Cancelar
      </Button>
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
        <Campo label="Descripción" className="flex-1 min-w-[200px]">
          <InputCompacto aria-label="Descripción" value={d.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} className="w-full" />
        </Campo>
        <Campo label="Unidad" className="shrink-0">
          <InputCompacto aria-label="Unidad" value={d.unidad} onChange={(e) => setD({ ...d, unidad: e.target.value })} className="w-20" />
        </Campo>
        <Campo label="Cantidad" className="shrink-0">
          <InputCompacto aria-label="Cantidad" type="number" min={0} step="any" value={d.cantidad} onChange={(e) => setD({ ...d, cantidad: e.target.value })} className="w-20 text-right" />
        </Campo>
        <Campo label="Costo unit. (CLP)" className="shrink-0">
          <InputCompacto aria-label="Costo unit. (CLP)" type="number" min={0} step="any" value={d.costo} onChange={(e) => setD({ ...d, costo: e.target.value })} className="w-28 text-right" />
        </Campo>
        <Campo label="Partida" className="shrink-0">
          <SelectCompacto aria-label="Partida"
            value={d.partidaId}
            onChange={(e) => setD({ ...d, partidaId: e.target.value })}
            className={`${d.partidaId === sinAsignar ? 'border-amber-300 bg-amber-50 text-amber-800' : ''}`}>
            {partidas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.porDefecto ? `⚠ ${p.nombre}` : p.nombre}
              </option>
            ))}
          </SelectCompacto>
        </Campo>
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
      <Button variant="ghost" size="sm" onClick={onCancelar}>
        Cancelar
      </Button>
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
