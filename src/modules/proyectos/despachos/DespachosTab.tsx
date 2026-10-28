import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, FileText, Plus, Truck } from 'lucide-react';
import { getDespachosProyecto } from '../../../api/client';
import { Seccion } from '../../../components/ui/Seccion';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Lista, FilaLista } from '../../../components/ui/Lista';
import { Cargando, EstadoVacio, ErrorCarga } from '../../../components/ui/Estados';
import { Segmentado } from '../../../components/ui/Segmentado';
import { usePermisos } from '../../../lib/permisos';
import { useMigas } from '../../../lib/migas';
import { fecha } from '../../../lib/formato';
import type { EstadoDespacho, Proyecto } from '../../../types';
import { ETIQUETA_ESTADO_DESPACHO, ETIQUETA_TIPO_GUIA, VARIANTE_ESTADO_DESPACHO } from '../obra/estadoVentana';
import { NuevoDespachoModal } from './NuevoDespachoModal';
import { DespachoDetalleModal } from './DespachoDetalleModal';

type Filtro = 'ABIERTOS' | 'TODOS';
const ABIERTOS: EstadoDespacho[] = ['BORRADOR', 'EMITIDO', 'RECIBIDO_PARCIAL'];

/**
 * Despachos > obra: las ventanas fabricadas que salen a obra. Cada despacho
 * emitido genera la recepción pendiente en Instalación. Lo monta
 * modules/despachos/DespachosPage (sección propia del menú).
 */
export const DespachosTab: React.FC<{ proyecto: Proyecto }> = ({ proyecto }) => {
  const { tiene } = usePermisos();
  const [filtro, setFiltro] = useState<Filtro>('ABIERTOS');
  const [creando, setCreando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  useMigas(2, [abierto ? { label: 'Despacho' } : null]);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['despachos', proyecto.id], queryFn: () => getDespachosProyecto(proyecto.id) });
  const despachos = (data ?? []).filter((d) => filtro === 'TODOS' || ABIERTOS.includes(d.estado));
  const porRecibir = (data ?? []).filter((d) => d.estado === 'EMITIDO' || d.estado === 'RECIBIDO_PARCIAL').length;

  return (
    <div className="space-y-4">
      <Seccion
        icono={Truck}
        titulo="Despachos a obra"
        descripcion={`Ventanas fabricadas que salen a la obra con su guía de despacho.${porRecibir ? ` ${porRecibir} por recibir en obra.` : ''}`}
        sinRelleno
        acciones={
          <>
            <Segmentado
              etiqueta="Filtrar despachos"
              tamano="xs"
              valor={filtro}
              onChange={setFiltro}
              opciones={[
                { value: 'ABIERTOS', label: 'Abiertos', contador: (data ?? []).filter((d) => ABIERTOS.includes(d.estado)).length },
                { value: 'TODOS', label: 'Todos', contador: data?.length },
              ]}
            />
            {tiene('obras.despachar') && (
              <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreando(true)}>
                Nuevo despacho
              </Button>
            )}
          </>
        }
      >
        {isLoading ? (
          <div className="p-5">
            <Cargando />
          </div>
        ) : isError ? (
          <div className="p-5">
            <ErrorCarga que="los despachos" onReintentar={refetch} />
          </div>
        ) : despachos.length === 0 ? (
          <EstadoVacio
            enTarjeta={false}
            icono={Truck}
            titulo={filtro === 'ABIERTOS' ? 'No hay despachos abiertos' : 'Todavía no hay despachos'}
            descripcion="Cuando una fase está fabricada, arma el despacho con sus ventanas y emítelo: la obra lo verá como recepción pendiente."
            accion={tiene('obras.despachar') && <Button size="sm" variant="outline" onClick={() => setCreando(true)}>Nuevo despacho</Button>}
          />
        ) : (
          <Lista>
            {despachos.map((d) => (
              <FilaLista
                key={d.id}
                titulo={<span className="font-mono">{d.codigo}</span>}
                insignias={
                  <>
                    <Badge size="sm" variant={VARIANTE_ESTADO_DESPACHO[d.estado]}>
                      {ETIQUETA_ESTADO_DESPACHO[d.estado]}
                    </Badge>
                    {d.fase && (
                      <Badge size="sm" variant="brand">
                        Fase {d.fase.numeroFase}
                      </Badge>
                    )}
                    {d.estado !== 'BORRADOR' && d.tipoGuia === 'BSALE' && !d.bsaleDocumentoId && !d.bsaleDespachoId && (
                      <Badge size="sm" variant="danger">
                        Guía no emitida
                      </Badge>
                    )}
                  </>
                }
                atenuada={d.estado === 'ANULADO'}
                acciones={
                  <>
                    {d.bsaleUrlPdf && (
                      <Button size="sm" variant="ghost" leftIcon={<FileText className="w-3.5 h-3.5" />} onClick={() => window.open(d.bsaleUrlPdf!, '_blank', 'noopener')}>
                        Guía
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" rightIcon={<ChevronRight className="w-3.5 h-3.5" />} onClick={() => setAbierto(d.id)}>
                      Ver
                    </Button>
                  </>
                }
              >
                <p>
                  {d._count.items} ítem(s) · {d.fechaDespacho ? fecha(d.fechaDespacho) : 'sin fecha'} · {ETIQUETA_TIPO_GUIA[d.tipoGuia]}
                  {d.numeroGuia ? ` N° ${d.numeroGuia}` : ''}
                  {d.transportista ? ` · ${d.transportista}` : ''}
                </p>
              </FilaLista>
            ))}
          </Lista>
        )}
      </Seccion>

      {creando && (
        <NuevoDespachoModal
          proyecto={proyecto}
          onClose={() => setCreando(false)}
          onCreado={(id) => {
            setCreando(false);
            setAbierto(id);
          }}
        />
      )}
      {abierto && <DespachoDetalleModal despachoId={abierto} proyectoId={proyecto.id} onClose={() => setAbierto(null)} />}
    </div>
  );
};
