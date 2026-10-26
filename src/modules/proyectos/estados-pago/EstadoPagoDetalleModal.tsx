import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Receipt } from 'lucide-react';
import { cambiarEstadoEstadoPago, getEstadoPago } from '../../../api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Aviso } from '../../../components/ui/Aviso';
import { Input } from '../../../components/ui/Input';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { Cargando, ErrorCarga } from '../../../components/ui/Estados';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { usePermisos } from '../../../lib/permisos';
import { clp, fecha, fechaHora, porcentaje, uf } from '../../../lib/formato';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { EstadoEstadoPago, EstadoPagoDetalle, Proyecto } from '../../../types';
import { ETIQUETA_ESTADO_PAGO, ETIQUETA_PARTE_CORTA, VARIANTE_ESTADO_PAGO, hoyIso } from '../obra/estadoVentana';
import { NuevoEstadoPagoModal } from './NuevoEstadoPagoModal';

interface Props {
  proyecto: Proyecto;
  estadoPagoId: string;
  onClose: () => void;
}

/**
 * Detalle y ciclo de un estado de pago: BORRADOR → PRESENTADO → APROBADO →
 * FACTURADO → PAGADO (o RECHAZADO / ANULADO). Cada transición pide el permiso
 * que corresponde (editar, aprobar, cobrar); la API lo valida igual.
 */
export const EstadoPagoDetalleModal: React.FC<Props> = ({ proyecto, estadoPagoId, onClose }) => {
  const queryClient = useQueryClient();
  const { tiene } = usePermisos();
  const { confirmar, pedirTexto } = useConfirmar();
  const [editando, setEditando] = useState(false);
  const [facturando, setFacturando] = useState(false);
  const [numeroFactura, setNumeroFactura] = useState('');
  const [valorUf, setValorUf] = useState('');
  const [fechaFactura, setFechaFactura] = useState(hoyIso());

  const { data: e, isLoading, isError, refetch } = useQuery({ queryKey: ['estadoPago', estadoPagoId], queryFn: () => getEstadoPago(estadoPagoId) });

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['estadoPago', estadoPagoId] });
    queryClient.invalidateQueries({ queryKey: ['estadosPago', proyecto.id] });
    queryClient.invalidateQueries({ queryKey: ['estadosPagoDisponibles', proyecto.id] });
  };
  const transicion = useMutation({
    mutationFn: (p: { estado: EstadoEstadoPago; comentario?: string | null; numeroFactura?: string | null; valorUf?: number | null; fecha?: string | null }) => cambiarEstadoEstadoPago(estadoPagoId, p),
    onSuccess: () => {
      refrescar();
      setFacturando(false);
    },
    onError: (err) => {
      const { mensaje, detalle } = extraerErrorParaToast(err);
      mostrarToast(mensaje, { detalle });
    },
  });

  const conMotivo = async (estado: EstadoEstadoPago, titulo: string, peligro = false) => {
    const motivo = await pedirTexto({ titulo, etiqueta: 'Motivo', requerido: true, peligro });
    if (motivo) transicion.mutate({ estado, comentario: motivo });
  };
  const simple = async (estado: EstadoEstadoPago, titulo: string, mensaje: string) => {
    if (await confirmar({ titulo, mensaje, confirmar: titulo })) transicion.mutate({ estado });
  };

  const acciones = (d: EstadoPagoDetalle): React.ReactNode[] => {
    const lista: React.ReactNode[] = [];
    const puedeEditar = tiene('estados_pago.editar');
    const puedeAprobar = tiene('estados_pago.aprobar');
    const puedeCobrar = tiene('estados_pago.cobrar');
    if (d.estado === 'BORRADOR' && puedeEditar) {
      lista.push(
        <Button key="editar" size="sm" variant="outline" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditando(true)}>
          Editar
        </Button>,
        <Button key="presentar" size="sm" variant="primary" onClick={() => simple('PRESENTADO', 'Presentar al cliente', 'El estado de pago queda presentado; sus ítems ya no se editan.')}>
          Presentar
        </Button>
      );
    }
    if (d.estado === 'PRESENTADO' && puedeAprobar) {
      lista.push(
        <Button key="rechazar" size="sm" variant="outline" onClick={() => conMotivo('RECHAZADO', 'Registrar rechazo del cliente')}>
          Rechazado
        </Button>,
        <Button key="aprobar" size="sm" variant="primary" onClick={() => simple('APROBADO', 'Aprobar', 'El cliente aprobó este estado de pago.')}>
          Aprobado por el cliente
        </Button>
      );
    }
    if (d.estado === 'RECHAZADO' && puedeEditar) {
      lista.push(
        <Button key="borrador" size="sm" variant="primary" onClick={() => simple('BORRADOR', 'Volver a borrador', 'Podrás corregirlo y presentarlo de nuevo.')}>
          Corregir (volver a borrador)
        </Button>
      );
    }
    if (d.estado === 'APROBADO' && puedeCobrar) {
      lista.push(
        <Button key="facturar" size="sm" variant="primary" onClick={() => setFacturando(true)}>
          Registrar factura
        </Button>
      );
    }
    if (d.estado === 'FACTURADO' && puedeCobrar) {
      lista.push(
        <Button key="pagar" size="sm" variant="primary" onClick={() => simple('PAGADO', 'Registrar pago', 'Marca el estado de pago como pagado por el cliente.')}>
          Pagado
        </Button>
      );
    }
    const puedeAnular = (['BORRADOR', 'RECHAZADO'].includes(d.estado) && puedeEditar) || (['PRESENTADO', 'APROBADO'].includes(d.estado) && puedeAprobar);
    if (puedeAnular) {
      lista.unshift(
        <Button key="anular" size="sm" variant="danger" onClick={() => conMotivo('ANULADO', 'Anular estado de pago', true)}>
          Anular
        </Button>
      );
    }
    return lista;
  };

  return (
    <>
      <Modal
        icono={Receipt}
        titulo={e ? `${e.codigo} · ${e.titulo}` : 'Estado de pago'}
        subtitulo={proyecto.obra}
        ancho="xl"
        onClose={onClose}
        cerrable={!transicion.isPending}
        pie={
          e && (
            <Modal.Pie inicio={<span>Neto <b className="text-slate-800 tabular-nums">{uf(e.totales.montoNetoUF)}</b>{e.montoCLP != null ? ` · ${clp(e.montoCLP)}` : ''}</span>}>
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cerrar
              </Button>
              {acciones(e)}
            </Modal.Pie>
          )
        }
      >
        {isLoading ? (
          <Cargando />
        ) : isError || !e ? (
          <ErrorCarga que="el estado de pago" onReintentar={refetch} />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <Badge variant={VARIANTE_ESTADO_PAGO[e.estado]}>{ETIQUETA_ESTADO_PAGO[e.estado]}</Badge>
              {e.periodoDesde || e.periodoHasta ? <span>Período {fecha(e.periodoDesde)} – {fecha(e.periodoHasta)}</span> : null}
              {e.creadoPor && <span>· creado por {e.creadoPor.nombre}</span>}
              {e.fechaPresentacion && <span>· presentado {fecha(e.fechaPresentacion)}</span>}
              {e.fechaAprobacion && <span>· aprobado {fecha(e.fechaAprobacion)}{e.aprobadoPor ? ` (${e.aprobadoPor.nombre})` : ''}</span>}
              {e.fechaFactura && <span>· factura {e.numeroFactura ? `N° ${e.numeroFactura} ` : ''}{fecha(e.fechaFactura)}</span>}
              {e.fechaPago && <span>· pagado {fecha(e.fechaPago)}</span>}
            </div>
            {e.estado === 'RECHAZADO' && e.motivoRechazo && <Aviso tono="peligro" titulo="Rechazado por el cliente">{e.motivoRechazo}</Aviso>}

            {facturando && (
              <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-800">Registrar factura</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Input label="N° de factura" value={numeroFactura} onChange={(ev) => setNumeroFactura(ev.target.value)} maxLength={40} />
                  <Input label="Valor UF del día" type="number" step="any" min={0} value={valorUf} onChange={(ev) => setValorUf(ev.target.value)} className="text-right tabular-nums" helperText={valorUf ? `Neto ${clp(Number(e.totales.montoNetoUF) * Number(valorUf))}` : 'Fija el monto en pesos.'} />
                  <Input label="Fecha" type="date" value={fechaFactura} onChange={(ev) => setFechaFactura(ev.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setFacturando(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" variant="primary" isLoading={transicion.isPending} disabled={!Number(valorUf)} onClick={() => transicion.mutate({ estado: 'FACTURADO', numeroFactura: numeroFactura.trim() || null, valorUf: Number(valorUf), fecha: fechaFactura || null })}>
                    Guardar factura
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <Tabla>
                <Thead>
                  <Tr>
                    <Th>Ítem</Th>
                    <Th alinear="derecha">Cant.</Th>
                    <Th alinear="derecha">%</Th>
                    <Th alinear="derecha">Precio UF</Th>
                    <Th alinear="derecha">Monto UF</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {e.items.map((i) => (
                    <Tr key={i.id}>
                      <Td>
                        <span className="text-xs text-slate-800">{i.descripcion}</span>
                        <span className="block text-[10px] text-slate-400">
                          {i.fase ? `Fase ${i.fase.numeroFase}` : i.adicional ? `Adicional A${i.adicional.numero}` : i.ventanaIndividualizada ? 'Ventana' : 'Ítem libre'}
                          {i.parte !== 'COMPLETA' ? ` · ${ETIQUETA_PARTE_CORTA[i.parte]}` : ''}
                        </span>
                      </Td>
                      <Td alinear="derecha" numero>{Number(i.cantidad).toLocaleString('es-CL')}</Td>
                      <Td alinear="derecha" numero>{porcentaje(i.porcentaje, 0)}</Td>
                      <Td alinear="derecha" numero mono>{uf(i.precioUnitarioUF)}</Td>
                      <Td alinear="derecha" numero mono fuerte>{uf(i.montoUF)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Tabla>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              {[
                ['Bruto', uf(e.totales.montoBrutoUF)],
                [`Retención ${porcentaje(e.retencionPct, 1)}`, `- ${uf(e.totales.retencionUF)}`],
                [`Anticipo ${porcentaje(e.anticipoPct, 1)}`, `- ${uf(e.totales.anticipoUF)}`],
                ['Descuentos', `- ${uf(e.totales.descuentoUF)}`],
                ['Neto', uf(e.totales.montoNetoUF)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{k}</dt>
                  <dd className="font-mono tabular-nums text-slate-800 font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            {e.observaciones && <p className="text-xs text-slate-600 whitespace-pre-wrap">{e.observaciones}</p>}

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Historial</p>
              <ul className="space-y-1 text-[11px] text-slate-600">
                {e.eventos.map((ev) => (
                  <li key={ev.id}>
                    <span className="font-mono text-slate-400">{fechaHora(ev.creadoEn)}</span> · {ETIQUETA_ESTADO_PAGO[ev.estadoNuevo]}
                    {ev.usuario ? ` · ${ev.usuario.nombre}` : ''}
                    {ev.comentario ? ` — ${ev.comentario}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
      {editando && e && (
        <NuevoEstadoPagoModal
          proyecto={proyecto}
          existente={e}
          onClose={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            refrescar();
          }}
        />
      )}
    </>
  );
};
