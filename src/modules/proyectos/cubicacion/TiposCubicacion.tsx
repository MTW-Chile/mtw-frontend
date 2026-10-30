import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { eliminarTipoCubicacion } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { TipoCubicacion } from '../../../types';
import { formatoMm } from '../fabricacion/utils';
import { TipoModal } from './TipoModal';
import { estadoSaldo, formatoMonto } from './utils';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { IconButton } from '../../../components/ui/IconButton';

interface Props {
  proyectoId: string;
  moneda: string;
  tipos: TipoCubicacion[];
  /** Obra legacy: medidas de fabricación, sin precio ni contrato. */
  legacy?: boolean;
}

// Tipos de ventana de la cubicacion (la hoja BASE): contratadas vs cubicadas. La cubicacion puede quedar
// incompleta: el saldo es lo que falta cubicar.
export const TiposCubicacion: React.FC<Props> = ({ proyectoId, moneda, tipos, legacy }) => {
  const { confirmar } = useConfirmar();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<{ tipo?: TipoCubicacion } | null>(null);

  const eliminar = useMutation({
    mutationFn: (id: string) => eliminarTipoCubicacion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cubicacion', proyectoId] }),
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {legacy
            ? <>Tipos de ventana de la obra, armados desde sus documentos de fabricación con la medida con que se fabricaron. <b>Fabricadas</b> es lo que traen los documentos; <b>cubicadas</b>, las que ya tienen piso y departamento.</>
            : <>Tipos de ventana de la obra. Los marcados <b>HETMO</b> salen de una línea del presupuesto. <b>Contratadas</b> es lo vendido; <b>cubicadas</b>, las ventanas que ya tienen piso y departamento.</>}
        </p>
        <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setModal({})}>
          Nuevo tipo
        </Button>
      </div>

      {tipos.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs">Aún no hay tipos. Importa la planilla o crea uno.</div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <Tabla>
            <Thead>
              <Tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                <Th className="font-bold">Código</Th>
                <Th className="font-bold">Apertura</Th>
                <Th className="font-bold">{legacy ? 'Medida (mm)' : 'Plano (mm)'}</Th>
                <Th alinear="derecha" className="font-bold">Cuadros</Th>
                {!legacy && <Th alinear="derecha" className="font-bold">Precio unit.</Th>}
                <Th alinear="derecha" className="font-bold">{legacy ? 'Fabricadas' : 'Contratadas'}</Th>
                <Th alinear="derecha" className="font-bold">Cubicadas</Th>
                <Th alinear="derecha" className="font-bold">Saldo</Th>
                <Th className="font-bold w-20"></Th>
              </Tr>
            </Thead>
            <Tbody>
              {tipos.map((t) => {
                const estado = estadoSaldo(t.saldo);
                return (
                  <Tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <Td className="font-mono font-bold text-slate-800 whitespace-nowrap">
                      {t.codigo}
                      {t.esAreaComun && (
                        <Badge size="sm" variant="outline" className="ml-1.5">
                          área común
                        </Badge>
                      )}
                      {t.ventanaId !== null && (
                        <Badge
                          size="sm"
                          variant="brand"
                          className="ml-1.5"
                          title={t.lineaHetmo !== null ? `Línea ${t.lineaHetmo} del presupuesto de HETMO` : 'Vinculado al presupuesto de HETMO'}
                        >
                          HETMO
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-slate-600 max-w-[16rem] truncate" title={t.sistema}>
                      {t.sistema}
                    </Td>
                    <Td className="font-mono text-slate-500 whitespace-nowrap">{t.anchoPlanoMm != null ? `${formatoMm(t.anchoPlanoMm)} × ${formatoMm(t.altoPlanoMm)}` : '—'}</Td>
                    <Td alinear="derecha" className="font-mono text-slate-500">{t.cuadros ?? '—'}</Td>
                    {!legacy && <Td alinear="derecha" className="font-mono text-slate-600 whitespace-nowrap">{formatoMonto(t.precioUnitario, moneda)}</Td>}
                    <Td alinear="derecha" className="font-mono text-slate-700">{t.cantidadContratada}</Td>
                    <Td alinear="derecha" className="font-mono text-slate-700">{t.cubicadas}</Td>
                    <Td alinear="derecha">
                      <Badge size="sm" variant={estado === 'completo' ? 'success' : estado === 'excedido' ? 'danger' : 'warning'}>
                        {estado === 'completo' ? 'Completo' : t.saldo}
                      </Badge>
                    </Td>
                    <Td alinear="derecha" className="whitespace-nowrap">
                      <IconButton icono={Pencil} etiqueta={`Editar tipo ${t.codigo}`} tono="marca" onClick={() => setModal({ tipo: t })} />
                      <IconButton
                        icono={Trash2}
                        tono="peligro"
                        disabled={!t.esAreaComun && t.cubicadas > 0}
                        etiqueta={!t.esAreaComun && t.cubicadas > 0 ? 'Tiene ventanas con posición: elimínalas primero' : `Eliminar tipo ${t.codigo}`}
                        onClick={async () => {
                          if (await confirmar({ titulo: `¿Eliminar el tipo ${t.codigo}?`, confirmar: 'Eliminar', peligro: true })) eliminar.mutate(t.id);
                        }}
                      />
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Tabla>
        </div>
      )}
      {modal && <TipoModal proyectoId={proyectoId} moneda={moneda} tipo={modal.tipo} legacy={legacy} onClose={() => setModal(null)} />}
    </div>
  );
};
