import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, X } from 'lucide-react';
import { createTipoProyecto, getTiposProyecto, updateTipoProyecto } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import type { ModoCubicacion, RaizComercialOneDrive, TipoProyecto } from '../../../types';
import { IconButton } from '../../../components/ui/IconButton';
import { Seccion } from '../../../components/ui/Seccion';
import { InputCompacto, Interruptor, SelectCompacto } from '../../../components/ui/Campos';
import { Cargando, ErrorCarga } from '../../../components/ui/Estados';
import { avisarError } from '../catalogo/comun';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';

/**
 * Tipos de proyecto (Edificio, Condominio, Retail): definen la plantilla de textos por
 * defecto y diferencian reglas comerciales. Uno es el por defecto (lo recibe
 * todo proyecto nuevo de HETMO); no se borran, se desactivan.
 */
export const TiposProyectoSection: React.FC<{ puedeEditar: boolean }> = ({ puedeEditar }) => {
  const queryClient = useQueryClient();
  const { data: tipos = [], isLoading, isError, refetch } = useQuery({ queryKey: ['tiposProyecto'], queryFn: getTiposProyecto });
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [nuevo, setNuevo] = useState<{ codigo: string; nombre: string; modo: ModoCubicacion } | null>(null);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['tiposProyecto'] });
  const guardar = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateTipoProyecto>[1] }) => updateTipoProyecto(id, payload),
    onSuccess: (_d, { id }) => {
      invalidar();
      setNombres(({ [id]: _, ...resto }) => resto);
    },
    onError: avisarError,
  });
  const crear = useMutation({
    mutationFn: (n: { codigo: string; nombre: string; modo: ModoCubicacion }) => createTipoProyecto({ codigo: n.codigo.trim(), nombre: n.nombre.trim(), orden: tipos.length + 1, modoCubicacion: n.modo }),
    onSuccess: () => {
      invalidar();
      setNuevo(null);
    },
    onError: avisarError,
  });

  if (isLoading) return <Cargando />;
  if (isError) return <ErrorCarga que="los tipos de proyecto" onReintentar={refetch} />;

  const nombreDe = (t: TipoProyecto) => nombres[t.id] ?? t.nombre;

  return (
    <Seccion
      titulo="Tipos de proyecto"
      descripcion="Cada proyecto tiene un tipo; define sus plantillas de textos por defecto, cómo se cubica (por edificio: torres, pisos y departamentos; o por casa: casas, pisos y recintos) en cuál carpeta de OneDrive está su carpeta comercial (obras mayores o retail; las carpetas se indican en Configuración › OneDrive) y si sus obras usan reserva de materiales y cubicación (retail no: se fabrica de una tirada y solo rectifica medidas, desde Fases). El tipo por defecto lo recibe todo proyecto nuevo de HETMO."
      sinRelleno
      acciones={
        puedeEditar && !nuevo ? (
          <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNuevo({ codigo: '', nombre: '', modo: 'EDIFICIO' })}>
            Nuevo tipo
          </Button>
        ) : undefined
      }
    >
      <Tabla>
        <Thead>
          <Tr>
            <Th>Código</Th>
            <Th>Nombre</Th>
            <Th>Cubica como</Th>
            <Th title="En cuál carpeta de OneDrive está la carpeta comercial de sus obras: obras mayores o retail">OneDrive</Th>
            <Th alinear="centro" title="Si sus obras reservan los materiales al aceptarse (Abastecimiento › Reserva de materiales). Retail no: se fabrica de una tirada y se compra directo.">Reserva</Th>
            <Th alinear="centro" title="Si sus obras tienen pestaña Cubicación. Sin ella, las fases se arman desde Fases (Rectificar medidas, Crear fase única, Nueva fase).">Cubicación</Th>
            <Th alinear="derecha">Proyectos</Th>
            <Th alinear="centro">Por defecto</Th>
            <Th alinear="centro">Activo</Th>
            {puedeEditar && <Th />}
          </Tr>
        </Thead>
        <Tbody>
          {nuevo && (
            <Tr tono="destacada">
              <Td>
                <InputCompacto aria-label="Código" autoFocus placeholder="EJ: INMOBILIARIA" value={nuevo.codigo} onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value.toUpperCase() })} className="w-full font-mono" />
              </Td>
              <Td>
                <InputCompacto aria-label="Nombre" placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className="w-full" />
              </Td>
              <Td>
                <SelectCompacto aria-label="Cubica como" value={nuevo.modo} onChange={(e) => setNuevo({ ...nuevo, modo: e.target.value as ModoCubicacion })}>
                  <option value="EDIFICIO">Edificio</option>
                  <option value="CASA">Casa</option>
                </SelectCompacto>
              </Td>
              <Td colSpan={6} />
              <Td alinear="derecha" className="whitespace-nowrap">
                <Button size="sm" onClick={() => crear.mutate(nuevo)} disabled={!nuevo.codigo.trim() || !nuevo.nombre.trim()} isLoading={crear.isPending}>
                  Crear
                </Button>
                <IconButton icono={X} etiqueta="Cancelar" className="ml-1" onClick={() => setNuevo(null)} />
              </Td>
            </Tr>
          )}
          {tipos.map((t) => {
            const guardando = guardar.isPending && guardar.variables?.id === t.id;
            return (
              <Tr key={t.id} tono={t.activo ? undefined : 'atenuada'}>
                <Td className="font-mono text-[11px] text-slate-500">{t.codigo}</Td>
                <Td>
                  {puedeEditar ? (
                    <InputCompacto aria-label="Nombre" value={nombreDe(t)} onChange={(e) => setNombres((p) => ({ ...p, [t.id]: e.target.value }))} className="w-full min-w-[7rem]" />
                  ) : (
                    t.nombre
                  )}
                </Td>
                <Td>
                  {puedeEditar ? (
                    <SelectCompacto
                      aria-label={`Cubica como (${t.nombre})`}
                      value={t.modoCubicacion}
                      onChange={(e) => guardar.mutate({ id: t.id, payload: { modoCubicacion: e.target.value as ModoCubicacion } })}
                    >
                      <option value="EDIFICIO">Edificio</option>
                      <option value="CASA">Casa</option>
                    </SelectCompacto>
                  ) : t.modoCubicacion === 'CASA' ? (
                    'Casa'
                  ) : (
                    'Edificio'
                  )}
                </Td>
                <Td>
                  {puedeEditar ? (
                    <SelectCompacto
                      aria-label={`Carpeta en OneDrive (${t.nombre})`}
                      value={t.raizOneDrive}
                      onChange={(e) => guardar.mutate({ id: t.id, payload: { raizOneDrive: e.target.value as RaizComercialOneDrive } })}
                    >
                      <option value="OBRAS_MAYORES">Mayores</option>
                      <option value="RETAIL">Retail</option>
                    </SelectCompacto>
                  ) : t.raizOneDrive === 'RETAIL' ? (
                    'Retail'
                  ) : (
                    'Obras mayores'
                  )}
                </Td>
                <Td alinear="centro">
                  <Interruptor
                    valor={t.usaReservaMateriales}
                    disabled={!puedeEditar}
                    etiqueta={t.usaReservaMateriales ? 'Sus obras usan reserva de materiales: clic para quitarla' : 'Sus obras no usan reserva de materiales: clic para activarla'}
                    onChange={(usaReservaMateriales) => guardar.mutate({ id: t.id, payload: { usaReservaMateriales } })}
                  />
                </Td>
                <Td alinear="centro">
                  <Interruptor
                    valor={t.usaCubicacion}
                    disabled={!puedeEditar}
                    etiqueta={t.usaCubicacion ? 'Sus obras usan cubicación: clic para quitarla' : 'Sus obras no usan cubicación: clic para activarla'}
                    onChange={(usaCubicacion) => guardar.mutate({ id: t.id, payload: { usaCubicacion } })}
                  />
                </Td>
                <Td numero>{t._count?.proyectos ?? 0}</Td>
                <Td alinear="centro">
                  {t.porDefecto ? (
                    <Badge size="sm" variant="brand">Por defecto</Badge>
                  ) : puedeEditar && t.activo ? (
                    <Button size="sm" variant="ghost" onClick={() => guardar.mutate({ id: t.id, payload: { porDefecto: true } })}>
                      Marcar
                    </Button>
                  ) : null}
                </Td>
                <Td alinear="centro">
                  <Interruptor
                    valor={t.activo}
                    disabled={!puedeEditar || t.porDefecto}
                    etiqueta={t.porDefecto ? 'El tipo por defecto no se puede desactivar' : t.activo ? 'Desactivar' : 'Activar'}
                    onChange={(activo) => guardar.mutate({ id: t.id, payload: { activo } })}
                  />
                </Td>
                {puedeEditar && (
                  <Td alinear="derecha">
                    <IconButton
                      icono={Save}
                      etiqueta="Guardar nombre"
                      tono="marca"
                      cargando={guardando}
                      onClick={() => guardar.mutate({ id: t.id, payload: { nombre: nombreDe(t).trim() } })}
                      disabled={nombreDe(t) === t.nombre || !nombreDe(t).trim()}
                    />
                  </Td>
                )}
              </Tr>
            );
          })}
        </Tbody>
        </Tabla>
    </Seccion>
  );
};
