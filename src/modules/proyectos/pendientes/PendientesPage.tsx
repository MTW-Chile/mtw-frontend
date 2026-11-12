import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HardHat } from 'lucide-react';
import { getPendiente } from '../../../api/client';
import { HeaderSeccion } from '../../../components/layout/HeaderSeccion';
import { Cargando, ErrorCarga, EstadoVacio } from '../../../components/ui/Estados';
import { PAGE_CONTAINER_CLASS } from '../../../lib/designSystem';
import { useMigas } from '../../../lib/migas';
import { actualizarParams, useUrlParam } from '../../../lib/navigation';
import type { ObraConPendientes } from '../../../types';
import { ObrasPendientesArea, useObrasPendientes } from './ObrasPendientesArea';
import { PendientesTab } from './PendientesTab';
import type { AreaPendiente } from './utils';

/** Los pendientes del área en la obra elegida, con la obra en las migas (volver lleva a la lista de obras). */
const PendientesDeObra: React.FC<{ area: AreaPendiente; obra: ObraConPendientes }> = ({ area, obra }) => {
  useMigas(1, [{ label: obra.obra, codigo: obra.codigoInterno ?? undefined }]);
  return <PendientesTab key={`${area}-${obra.id}`} area={area} obraFija={obra} />;
};

/**
 * Visor de un área (Taller o Abastecimiento): primero la lista de obras (las que tienen pendientes, arriba) y, al
 * elegir una, sus pendientes. La obra va en la URL (?obra=), igual que el pendiente abierto (?pendiente=): es el
 * enlace que llega por correo. Un enlace antiguo, solo con el pendiente, se completa con su obra.
 */
const VisorDeArea: React.FC<{ area: AreaPendiente }> = ({ area }) => {
  const [obraId, setObraId] = useUrlParam('obra');
  const [pendienteId] = useUrlParam('pendiente');
  const { data: obras, isLoading, isError, refetch } = useObrasPendientes(area);
  const { data: suelto } = useQuery({ queryKey: ['pendiente', pendienteId], queryFn: () => getPendiente(pendienteId!), enabled: !!pendienteId && !obraId });
  useEffect(() => {
    if (suelto && !obraId) actualizarParams({ obra: suelto.proyectoId }, { replace: true });
  }, [suelto, obraId]);

  if (!obraId) return pendienteId ? <Cargando texto="Abriendo el pendiente…" /> : <ObrasPendientesArea area={area} onElegir={(o) => setObraId(o.id)} />;
  const obra = obras?.find((o) => o.id === obraId);
  if (obra) return <PendientesDeObra area={area} obra={obra} />;
  if (isLoading) return <Cargando texto="Leyendo la obra…" />;
  if (isError) return <ErrorCarga que="la obra" onReintentar={refetch} />;
  return <EstadoVacio icono={HardHat} titulo="Esta obra no está en curso" descripcion="Vuelve a la lista y elige otra." />;
};

/**
 * Pendientes de las obras, en tres secciones del menú. Comercial ve todos los de todas las obras en una sola lista.
 * Taller (`area="FABRICA"`: marcos, hojas y ventanas) y Abastecimiento (`area="COMPRAS"`: vidrios y materiales)
 * parten eligiendo la obra; en su visor, abrir un pendiente lo deja «Recibido». Se ingresan desde Instaladores › Pendientes.
 */
export const PendientesPage: React.FC<{ area?: AreaPendiente }> = ({ area }) => (
  <div className={PAGE_CONTAINER_CLASS}>
    <HeaderSeccion titulo={area === 'FABRICA' ? 'Pendientes de fábrica' : area === 'COMPRAS' ? 'Pendientes de compras' : 'Pendientes'} />
    {area ? <VisorDeArea key={area} area={area} /> : <PendientesTab key="todos" />}
  </div>
);
