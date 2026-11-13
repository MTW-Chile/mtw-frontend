import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { crearDespacho, getVentanasParaDespacho } from '../../../api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { CamposDireccion, aValorDireccion } from '../../../components/ui/CamposDireccion';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Aviso } from '../../../components/ui/Aviso';
import { Buscador } from '../../../components/ui/Buscador';
import { Casilla, SelectCompacto, Textarea } from '../../../components/ui/Campos';
import { Cargando, ErrorCarga, EstadoVacio } from '../../../components/ui/Estados';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { ParteVentana, Proyecto, VentanaObra } from '../../../types';
import { ETIQUETA_ESTADO_VENTANA, VARIANTE_ESTADO_VENTANA, hoyIso, nivelEstado, nombreVentana, parteDe, textoMedida } from '../obra/estadoVentana';

interface Props {
  proyecto: Proyecto;
  faseInicial?: string | null;
  onClose: () => void;
  onCreado: (despachoId: string) => void;
}

type Seleccion = Record<string, ParteVentana>; // ventanaId -> parte elegida

/**
 * Arma un despacho (borrador) eligiendo las ventanas fabricadas de una fase.
 * Una ventana con hojas puede ir separada: marco u hoja. Lo que ya está en
 * otro despacho vigente no se ofrece. Se emite (con su guía) desde el detalle.
 */
export const NuevoDespachoModal: React.FC<Props> = ({ proyecto, faseInicial, onClose, onCreado }) => {
  const queryClient = useQueryClient();
  const [faseId, setFaseIdEstado] = useState(faseInicial ?? '');
  const [filtro, setFiltro] = useState('');
  const [soloFabricadas, setSoloFabricadas] = useState(true);
  const [seleccion, setSeleccion] = useState<Seleccion>({});
  const [forzar, setForzar] = useState(false);
  const [datos, setDatos] = useState({
    fechaDespacho: hoyIso(),
    // La entrega es en la obra: su dirección (paso 1 de la cotización) y, si no se indicó, la del cliente.
    direccionEntrega: proyecto.obraDireccion ?? proyecto.clienteDireccionRaw ?? '',
    comunaEntrega: proyecto.obraDireccion ? (proyecto.obraComuna ?? '') : '',
    ciudadEntrega: proyecto.obraDireccion ? (proyecto.obraCiudad ?? '') : (proyecto.clienteLocalidadRaw ?? ''),
    destinatario: '',
    transportista: '',
    patente: '',
    notas: '',
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['despachosDisponibles', proyecto.id, faseId],
    queryFn: () => getVentanasParaDespacho(proyecto.id, faseId || null),
  });

  // Al cambiar de fase se limpia la selección (las ventanas son otras).
  const setFaseId = (id: string) => {
    setFaseIdEstado(id);
    setSeleccion({});
  };

  const ventanas = useMemo(() => {
    const todas = data?.ventanas ?? [];
    const f = filtro.trim().toLowerCase();
    return todas.filter((v) => {
      const despachable = v.disponible.COMPLETA || v.disponible.MARCO || v.disponible.HOJA;
      if (!despachable) return false;
      if (soloFabricadas && nivelEstado(v.estado) < nivelEstado('FABRICADA') && !v.separada) return false;
      if (f && !`${nombreVentana(v)} ${v.sistema} ${v.ubicacion ?? ''} ${v.nombreUnidad ?? ''}`.toLowerCase().includes(f)) return false;
      return true;
    });
  }, [data, filtro, soloFabricadas]);

  const parteDefecto = (v: VentanaObra): ParteVentana => (v.disponible.COMPLETA ? 'COMPLETA' : v.disponible.MARCO ? 'MARCO' : 'HOJA');
  const alternar = (v: VentanaObra) =>
    setSeleccion((s) => {
      const copia = { ...s };
      if (copia[v.id]) delete copia[v.id];
      else copia[v.id] = parteDefecto(v);
      return copia;
    });
  const seleccionarTodas = () => setSeleccion(Object.fromEntries(ventanas.map((v) => [v.id, seleccion[v.id] ?? parteDefecto(v)])));
  const total = Object.keys(seleccion).length;
  const hayNoFabricadas = ventanas.some((v) => seleccion[v.id] && nivelEstado(v.estado) < nivelEstado('FABRICADA'));

  const crear = useMutation({
    mutationFn: () =>
      crearDespacho(proyecto.id, {
        ...datos,
        faseId: faseId || null,
        fechaDespacho: datos.fechaDespacho || null,
        forzar,
        items: Object.entries(seleccion).map(([ventanaIndividualizadaId, parte]) => ({ ventanaIndividualizadaId, parte })),
      }),
    onSuccess: ({ despacho, avisos }) => {
      queryClient.invalidateQueries({ queryKey: ['despachos', proyecto.id] });
      queryClient.invalidateQueries({ queryKey: ['despachosDisponibles', proyecto.id] });
      for (const a of avisos) mostrarToast(a, { tipo: 'info' });
      onCreado(despacho.id);
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  const set = (k: keyof typeof datos, v: string) => setDatos((d) => ({ ...d, [k]: v }));
  // La región solo ordena las comunas del formulario: la guía lleva dirección, comuna y ciudad.
  const [regionEntrega, setRegionEntrega] = useState(proyecto.obraDireccion ? (proyecto.obraRegion ?? '') : '');

  return (
    <Modal
      icono={Truck}
      titulo="Nuevo despacho a obra"
      subtitulo={proyecto.obra}
      ancho="xl"
      onClose={onClose}
      cerrable={!crear.isPending}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={total === 0} isLoading={crear.isPending} onClick={() => crear.mutate()}>
            Crear despacho ({total})
          </Button>
        </Modal.Pie>
      }
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Select label="Fase" value={faseId} onChange={(e) => setFaseId(e.target.value)} helperText="Normalmente se despacha una fase completa.">
            <option value="">Toda la obra</option>
            {(data?.fases ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                Fase {f.numeroFase} · {f.nombre} ({f._count.ventanasIndividualizadas} ventanas)
              </option>
            ))}
          </Select>
          <Input label="Fecha de despacho" type="date" value={datos.fechaDespacho} onChange={(e) => set('fechaDespacho', e.target.value)} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex-1">Ventanas que salen</p>
            <Casilla checked={soloFabricadas} onChange={setSoloFabricadas} label="Solo fabricadas (HETMO)" />
            <Button type="button" size="sm" variant="ghost" onClick={seleccionarTodas} disabled={ventanas.length === 0}>
              Marcar todas ({ventanas.length})
            </Button>
          </div>
          <Buscador compacto valor={filtro} onChange={setFiltro} placeholder="Buscar por ventana, recinto o depto…" etiqueta="Buscar ventanas" />
          {isLoading ? (
            <Cargando texto="Leyendo la cubicación…" />
          ) : isError ? (
            <ErrorCarga que="las ventanas por despachar" onReintentar={() => refetch()} />
          ) : ventanas.length === 0 ? (
            <EstadoVacio enTarjeta={false} titulo="Nada por despachar" descripcion={soloFabricadas ? 'No hay ventanas fabricadas disponibles en esta selección. Quita el filtro para ver las demás.' : 'Todas las ventanas de esta selección ya están en un despacho.'} />
          ) : (
            <ul className="max-h-[40dvh] overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {ventanas.map((v) => {
                const marcada = !!seleccion[v.id];
                const partes = (['COMPLETA', 'MARCO', 'HOJA'] as ParteVentana[]).filter((p) => v.disponible[p]);
                return (
                  <li key={v.id} className={`flex items-center gap-3 px-3 py-2 ${marcada ? 'bg-brand-50/40' : ''}`}>
                    <Casilla checked={marcada} onChange={() => alternar(v)} aria-label={`Despachar ${nombreVentana(v)}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 font-mono">{nombreVentana(v)}</span>
                        <Badge size="sm" variant={VARIANTE_ESTADO_VENTANA[v.estado]}>
                          {ETIQUETA_ESTADO_VENTANA[v.estado]}
                        </Badge>
                        {v.pendientesAbiertos > 0 && (
                          <Badge size="sm" variant="warning">
                            {v.pendientesAbiertos} pendiente(s)
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {v.sistema} · {textoMedida(v.anchoFabricacionMm ?? v.anchoPlanoMm, v.altoFabricacionMm ?? v.altoPlanoMm)}
                        {v.nombreUnidad ? ` · ${v.torre ? `${v.torre} ` : ''}${v.nombreUnidad}` : ''}
                        {v.ubicacion ? ` · ${v.ubicacion}` : ''}
                      </p>
                    </div>
                    {marcada && v.admiteSeparacion && partes.length > 1 && (
                      <SelectCompacto aria-label={`Parte de ${nombreVentana(v)}`} value={seleccion[v.id]} onChange={(e) => setSeleccion((s) => ({ ...s, [v.id]: e.target.value as ParteVentana }))} className="w-28">
                        {partes.map((p) => (
                          <option key={p} value={p}>
                            {p === 'COMPLETA' ? 'Completa' : `Solo ${parteDe(v, p)}`}
                          </option>
                        ))}
                      </SelectCompacto>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {hayNoFabricadas && (
            <Aviso tono="advertencia" titulo="Hay ventanas que HETMO aún no marca como fabricadas">
              <Casilla checked={forzar} onChange={setForzar} label="Despachar igual (ya están listas en fábrica)" />
            </Aviso>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <CamposDireccion
              etiquetaDireccion="Dirección de entrega"
              ayudaDireccion="Va en la guía de despacho."
              valor={aValorDireccion({ direccion: datos.direccionEntrega, region: regionEntrega, comuna: datos.comunaEntrega, ciudad: datos.ciudadEntrega })}
              onChange={(v) => {
                setRegionEntrega(v.region);
                setDatos((d) => ({ ...d, direccionEntrega: v.direccion, comunaEntrega: v.comuna, ciudadEntrega: v.ciudad }));
              }}
            />
          </div>
          <Input label="Destinatario (recibe en obra)" value={datos.destinatario} onChange={(e) => set('destinatario', e.target.value)} maxLength={200} />
          <Input label="Transportista" value={datos.transportista} onChange={(e) => set('transportista', e.target.value)} maxLength={200} />
          <Input label="Patente" value={datos.patente} onChange={(e) => set('patente', e.target.value)} maxLength={20} />
        </div>
        <Textarea label="Notas" value={datos.notas} onChange={(e) => set('notas', e.target.value)} rows={2} maxLength={1000} />
      </div>
    </Modal>
  );
};
