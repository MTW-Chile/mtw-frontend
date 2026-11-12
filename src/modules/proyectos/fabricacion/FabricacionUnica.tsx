import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Factory, Loader2, Ruler } from 'lucide-react';
import { crearFaseUnica, prepararFabricacionUnica, type FabricacionUnica as DatosFabricacionUnica } from '../../../api/client';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import { Aviso } from '../../../components/ui/Aviso';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Seccion } from '../../../components/ui/Seccion';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { usePermisos } from '../../../lib/permisos';
import type { Proyecto, ProyectoVersion } from '../../../types';
import { FasesTab } from '../FasesTab';
import { RectificarMedidas } from './RectificarMedidas';

/**
 * Fabricación de una obra sin cubicación (retail): se fabrica de una vez, en
 * una fase única con todas las ventanas.
 *  - Antes de producción: se rectifican las medidas y se «pasa a producción»
 *    (POST /proyectos/:id/fase-unica), que crea la fase única en el ERP y en
 *    HETMO, con la medida rectificada de cada ventana. Las que no se rectificaron
 *    pueden pasar igual, con la medida del presupuesto (a veces ya vienen rectificadas).
 *  - Después: la fase con sus materiales (pedido), y, cuando HETMO crea el
 *    documento de fabricación de esa fase, su conciliación.
 * Una obra cuyo documento se hizo en HETMO directo desde el presupuesto también
 * aparece aquí: la API arma la fase única desde el documento (POST
 * /proyectos/:id/fabricacion-unica, al abrir).
 */
export const FabricacionUnica: React.FC<{ proyecto: Proyecto; activeVersion: ProyectoVersion }> = ({ proyecto, activeVersion }) => {
  const queryClient = useQueryClient();
  const { tiene } = usePermisos();
  const [rectificando, setRectificando] = useState(false);
  const { confirmar } = useConfirmar();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['fabricacionUnica', proyecto.id], queryFn: () => prepararFabricacionUnica(proyecto.id) });

  const pasar = useMutation({
    mutationFn: (sinRectificar: boolean) => crearFaseUnica(proyecto.id, { sinRectificar }),
    onSuccess: (r) => {
      if (r.avisoHetmo) mostrarToast('Pasó a producción en el ERP, pero falta confirmarla en HETMO.', { detalle: r.avisoHetmo, duracionMs: 0 });
      else mostrarToast(`Pasó a producción${r.hetmoNumeroFase ? `: fase ${r.hetmoNumeroFase} en HETMO` : ''}.`, { tipo: 'info' });
      for (const key of ['fabricacionUnica', 'proyectoDetail', 'cubicacion', 'cubicacionEstructura']) queryClient.invalidateQueries({ queryKey: [key, proyecto.id] });
    },
    onError: async (e: any) => {
      const sinRectificar: string[] | undefined = e?.response?.data?.sinRectificar;
      if (sinRectificar?.length) {
        const n = sinRectificar.length;
        const ok = await confirmar({
          titulo: n === 1 ? '¿Pasar a producción con 1 ventana sin rectificar?' : `¿Pasar a producción con ${n} ventanas sin rectificar?`,
          mensaje: (
            <>
              <p>
                {n === 1 ? 'Esta ventana no tiene' : 'Estas ventanas no tienen'} la medida rectificada y {n === 1 ? 'se fabricará' : 'se fabricarán'} con la medida
                del presupuesto: <span className="font-mono">{sinRectificar.slice(0, 12).join(', ')}{n > 12 ? '…' : ''}</span>.
              </p>
              <p className="mt-2">Después no se pueden cambiar desde el ERP.</p>
            </>
          ),
          confirmar: 'Pasar a producción',
        });
        if (ok) pasar.mutate(true);
        return;
      }
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  // La fase pudo haberse creado recién: la ficha de la obra la necesita para mostrarla.
  const faseId = data?.estado === 'OK' ? data.faseId : null;
  const faseVisible = !!faseId && (activeVersion.fases ?? []).some((f) => f.id === faseId);
  useEffect(() => {
    if (faseId && !faseVisible) queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
  }, [faseId, faseVisible, proyecto.id, queryClient]);

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center gap-2 text-slate-500 text-xs">
        <Loader2 className="w-5 h-5 animate-spin" />
        Conciliando con el documento de fabricación…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Aviso tono="peligro" accion={<Button size="sm" variant="outline" onClick={() => refetch()}>Reintentar</Button>}>
        No se pudo preparar la fabricación de la obra.
      </Aviso>
    );
  }

  const botonRectificar = tiene('obras.cubicacion.editar') && !rectificando && (
    <Button size="sm" variant="outline" leftIcon={<Ruler className="w-3.5 h-3.5" />} onClick={() => setRectificando(true)}>
      Rectificar medidas
    </Button>
  );

  // Antes de producción: rectificar y pasar a producción.
  if (data.estado === 'SIN_DOCUMENTO') {
    const aceptada = activeVersion.estadoAprobacion === 'ACEPTADO_CLIENTE';
    const puedePasar = aceptada && tiene('obras.fases.editar');
    return (
      <div className="space-y-4">
        {activeVersion.hetmoAceptacionError && (
          <Aviso tono="advertencia" titulo="El presupuesto no quedó aceptado en HETMO">
            {activeVersion.hetmoAceptacionError} Se vuelve a intentar al pasar a producción.
          </Aviso>
        )}
        <Aviso
          tono="info"
          titulo="Rectifica las medidas y pasa la obra a producción"
          accion={
            puedePasar ? (
              <Button size="sm" leftIcon={<Factory className="w-3.5 h-3.5" />} isLoading={pasar.isPending} onClick={() => pasar.mutate(false)}>
                Pasar a producción
              </Button>
            ) : undefined
          }
        >
          {aceptada
            ? 'Al pasar a producción se crea la fase única con todas las ventanas, aquí y en HETMO, cada una con su medida rectificada. Si alguna no está rectificada, se te preguntará si pasa con la medida del presupuesto.'
            : 'El presupuesto todavía no está aceptado por el cliente: puedes rectificar, pero no pasar a producción.'}
        </Aviso>
        {pasar.isPending && <p className="text-[11px] text-slate-500">Creando la fase única en el ERP y en HETMO. Puede tardar un par de minutos.</p>}
        <RectificarMedidas proyectoId={proyecto.id} onCerrar={() => undefined} fija />
      </div>
    );
  }

  // Ya en producción, esperando que HETMO cree el documento de fabricación de la fase.
  if (data.documentos.length === 0) {
    return (
      <div className="space-y-5">
        {data.avisos.map((a) => (
          <Aviso key={a} tono="advertencia">{a}</Aviso>
        ))}
        <Aviso tono="info" titulo="En producción: esperando el documento de fabricación">
          La fase única ya está en HETMO. Cuando allí se acepte a producción y se cree su documento de fabricación, aparecerá aquí solo y se
          vinculará con las ventanas. Mientras tanto ya puedes pedir sus materiales.
        </Aviso>
        {faseVisible ? (
          <FasesTab proyecto={proyecto} activeVersion={activeVersion} sinCubicacion />
        ) : (
          <div className="p-6 flex justify-center text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {data.avisos.map((a) => (
        <Aviso key={a} tono="advertencia">{a}</Aviso>
      ))}
      <Conciliacion datos={data} />
      {rectificando && <RectificarMedidas proyectoId={proyecto.id} onCerrar={() => setRectificando(false)} />}
      {faseVisible ? (
        <FasesTab proyecto={proyecto} activeVersion={activeVersion} sinCubicacion />
      ) : faseId ? (
        <div className="p-6 flex justify-center text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : null}
      {botonRectificar && <div className="flex justify-end">{botonRectificar}</div>}
    </div>
  );
};

// Ventanas del ERP (presupuesto) contra las del documento de fabricación, por línea.
const Conciliacion: React.FC<{ datos: Extract<DatosFabricacionUnica, { estado: 'OK' }> }> = ({ datos }) => {
  const diferencias = datos.lineas.filter((l) => l.erp !== l.documento).length + datos.fueraDelPresupuesto.length;
  return (
    <Seccion
      icono={CheckCircle2}
      titulo="Conciliación con el documento de fabricación"
      descripcion={`${datos.documentos.map((d) => `${d.nombre}${d.estadoGlosa ? ` (${d.estadoGlosa})` : ''}`).join(' · ')}${
        diferencias ? ` · ${diferencias} diferencia(s)` : ' · todas las ventanas calzan'
      }`}
      sinRelleno
    >
      <Tabla>
        <Thead>
          <Tr>
            <Th>Línea</Th>
            <Th>Ventana</Th>
            <Th alinear="derecha" title="Unidades de la línea en el presupuesto del ERP">ERP</Th>
            <Th alinear="derecha" title="Unidades de la línea en el documento de fabricación">Documento</Th>
            <Th alinear="centro">Estado</Th>
          </Tr>
        </Thead>
        <Tbody>
          {datos.lineas.map((l) => (
            <Tr key={l.lineaHetmo}>
              <Td className="text-slate-500 tabular-nums">{l.lineaHetmo}</Td>
              <Td>
                <span className="font-semibold text-slate-800">{l.modelo}</span>
                {l.descripcion && <span className="text-slate-500"> · {l.descripcion}</span>}
              </Td>
              <Td numero>{l.erp}</Td>
              <Td numero>{l.documento}</Td>
              <Td alinear="centro">
                {l.erp === l.documento ? (
                  <Badge size="sm" variant="success">Calza</Badge>
                ) : l.documento === 0 ? (
                  <Badge size="sm" variant="warning">No está en el documento</Badge>
                ) : (
                  <Badge size="sm" variant="warning">{l.documento > l.erp ? `Documento trae ${l.documento - l.erp} más` : `Faltan ${l.erp - l.documento} en el documento`}</Badge>
                )}
              </Td>
            </Tr>
          ))}
          {datos.fueraDelPresupuesto.map((f, i) => (
            <Tr key={`fuera-${i}`}>
              <Td className="text-slate-500 tabular-nums">{f.lineaHetmo}</Td>
              <Td className="font-semibold text-slate-800">{f.modelo}</Td>
              <Td numero>—</Td>
              <Td numero>{f.unidades}</Td>
              <Td alinear="centro">
                <Badge size="sm" variant="warning">No está en el presupuesto</Badge>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Tabla>
    </Seccion>
  );
};
