import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleDashed, FileQuestionMark, Repeat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getConciliacionCubicacion } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Buscador } from '../../../components/ui/Buscador';
import { Cargando, ErrorCarga } from '../../../components/ui/Estados';
import { Seccion } from '../../../components/ui/Seccion';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { formatoFechaHora } from '../fabricacion/utils';

const Lista: React.FC<{ icono: LucideIcon; titulo: string; descripcion: string; cantidad: number; vacio: string; columnas: string[]; children: React.ReactNode }> = ({ icono, titulo, descripcion, cantidad, vacio, columnas, children }) => (
  <Seccion
    icono={icono}
    titulo={titulo}
    descripcion={descripcion}
    acciones={<Badge size="sm" variant={cantidad > 0 ? 'warning' : 'success'}>{cantidad}</Badge>}
    sinRelleno
  >
    {cantidad === 0 ? (
      <p className="px-5 py-4 text-xs text-slate-500">{vacio}</p>
    ) : (
      <div className="max-h-[22rem] overflow-y-auto">
        <Tabla>
          <Thead>
            <Tr>
              {columnas.map((c) => (
                <Th key={c}>{c}</Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>{children}</Tbody>
        </Tabla>
      </div>
    )}
  </Seccion>
);

/**
 * Conciliación de una obra en ejecución con su planilla de control. Lo que quedó pendiente después de cruzar la
 * planilla (lo que la obra espera) con los documentos de fabricación (lo que se fabricó):
 *  - sin fabricar: la planilla lo pide y ningún documento lo ha fabricado; su lugar ya está en el cubicador y se
 *    llena solo cuando se vincula el documento;
 *  - fuera de planilla: fabricado que ninguna fila pide (sigue por ubicar);
 *  - reposiciones: la misma ventana fabricada más de una vez; vale la más nueva y la anterior queda registrada.
 * Se lee de la base: está siempre disponible, no solo en el aviso que aparece al subir la planilla.
 */
export const ConciliacionCubicacion: React.FC<{ proyectoId: string }> = ({ proyectoId }) => {
  const [buscar, setBuscar] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['cubicacionConciliacion', proyectoId],
    queryFn: () => getConciliacionCubicacion(proyectoId),
    // Se abre después de mover ventanas o vincular documentos en otras pestañas: siempre se vuelve a leer.
    refetchOnMount: 'always',
  });
  if (isLoading) return <Cargando />;
  if (isError || !data) return <ErrorCarga que="la conciliación" onReintentar={refetch} />;

  const q = buscar.trim().toLowerCase();
  const calza = (...textos: (string | null | undefined)[]) => !q || textos.some((t) => (t ?? '').toLowerCase().includes(q));
  const sinFabricar = data.sinFabricar.filter((v) => calza(v.nombre, v.lugar, v.ubicacion));
  const fuera = data.fueraDePlanilla.filter((v) => calza(v.nombre, v.documento, v.lugar));
  const reposiciones = data.reposiciones.filter((v) => calza(v.nombre, v.lugar, v.vigente, ...v.anteriores.map((a) => a.documento)));

  return (
    <div className="space-y-4" data-testid="conciliacion-cubicacion">
      <Buscador valor={buscar} onChange={setBuscar} placeholder="Buscar ventana, depto o documento…" etiqueta="Buscar en la conciliación" />
      <Lista
        icono={CircleDashed}
        titulo="Sin fabricar"
        descripcion="La planilla las pide y ningún documento de fabricación las trae. Su lugar ya está en el cubicador; se llenan solas cuando se vincula su documento."
        cantidad={sinFabricar.length}
        vacio={q ? 'Nada coincide con la búsqueda.' : 'Todo lo que pide la planilla está fabricado.'}
        columnas={['Ventana', 'Lugar', 'Recinto']}
      >
        {sinFabricar.map((v) => (
          <Tr key={v.id}>
            <Td mono fuerte>{v.nombre}</Td>
            <Td>{v.lugar}</Td>
            <Td className="text-slate-500">{v.ubicacion ?? '—'}</Td>
          </Tr>
        ))}
      </Lista>
      <Lista
        icono={FileQuestionMark}
        titulo="Fabricadas que la planilla no pide"
        descripcion="Vienen en un documento de fabricación y ninguna fila de la planilla las reconoce. Se ubican corrigiendo la planilla o arrastrándolas en el cubicador visual."
        cantidad={fuera.length}
        vacio={q ? 'Nada coincide con la búsqueda.' : 'Todo lo fabricado está en la planilla.'}
        columnas={['Ventana', 'Documento', 'Dónde está']}
      >
        {fuera.map((v) => (
          <Tr key={v.id}>
            <Td mono fuerte>{v.nombre}</Td>
            <Td>{v.documento}</Td>
            <Td className="text-slate-500">{v.lugar}</Td>
          </Tr>
        ))}
      </Lista>
      <Lista
        icono={Repeat}
        titulo="Reposiciones"
        descripcion="La misma ventana fabricada más de una vez. Vale la del documento más nuevo (es la que se despacha e instala); las anteriores quedan registradas como reemplazadas."
        cantidad={reposiciones.length}
        vacio={q ? 'Nada coincide con la búsqueda.' : 'Ninguna ventana se ha fabricado más de una vez.'}
        columnas={['Ventana', 'Lugar', 'Vigente', 'Reemplazó a']}
      >
        {reposiciones.map((v) => (
          <Tr key={v.id}>
            <Td mono fuerte>{v.nombre}</Td>
            <Td>{v.lugar}</Td>
            <Td>{v.vigente}</Td>
            <Td className="text-slate-500">{v.anteriores.map((a) => `${a.documento}${a.reemplazadaEn ? ` (registrada el ${formatoFechaHora(a.reemplazadaEn)})` : ''}`).join(' · ')}</Td>
          </Tr>
        ))}
      </Lista>
    </div>
  );
};
