import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Ruler } from 'lucide-react';
import { prepararFabricacionUnica, type FabricacionUnica as DatosFabricacionUnica } from '../../../api/client';
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
 * Fabricación de una obra sin cubicación (retail): se fabrica de una vez, así
 * que su documento de fabricación ES la fase. Al abrir, la API (POST
 * /proyectos/:id/fabricacion-unica) arma la fase única con todas las ventanas y
 * las concilia con las del documento por línea del presupuesto. Sin documento
 * detectado se avisa y se ofrece rectificar medidas (lo que se hace antes de
 * fabricar).
 */
export const FabricacionUnica: React.FC<{ proyecto: Proyecto; activeVersion: ProyectoVersion }> = ({ proyecto, activeVersion }) => {
  const queryClient = useQueryClient();
  const { tiene } = usePermisos();
  const [rectificando, setRectificando] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['fabricacionUnica', proyecto.id], queryFn: () => prepararFabricacionUnica(proyecto.id) });

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

  if (data.estado === 'SIN_DOCUMENTO') {
    return (
      <div className="space-y-4">
        <Aviso tono="advertencia" titulo="No se ha detectado documento de fabricación" accion={botonRectificar || undefined}>
          Cuando el presupuesto se convierta en documento de fabricación en HETMO, aparecerá aquí solo como la fase única de la obra, con todas sus
          ventanas. Mientras tanto puedes rectificar las medidas.
        </Aviso>
        {rectificando && <RectificarMedidas proyectoId={proyecto.id} onCerrar={() => setRectificando(false)} />}
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
