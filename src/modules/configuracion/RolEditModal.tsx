import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Crown } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Aviso } from '../../components/ui/Aviso';
import { Casilla } from '../../components/ui/Campos';
import { Cargando } from '../../components/ui/Estados';
import { createRol, getCatalogoPermisos, updateRol } from '../../api/client';
import type { ModuloPermisos, Rol } from '../../types';

interface RolEditModalProps {
  rol: Rol | null; // null = crear nuevo
  onClose: () => void;
}

// Permisos que quedan incluidos por los marcados (cierre de las implicaciones
// del catalogo): se muestran marcados y bloqueados, con quien los incluye.
function incluidosPor(marcados: string[], catalogo: ModuloPermisos[]): Map<string, string> {
  const implica = new Map(catalogo.flatMap((m) => m.permisos.map((p) => [p.clave, p.implica] as const)));
  const nombre = new Map(catalogo.flatMap((m) => m.permisos.map((p) => [p.clave, p.nombre] as const)));
  const resultado = new Map<string, string>();
  for (const origen of marcados) {
    const pendientes = [...(implica.get(origen) ?? [])];
    while (pendientes.length > 0) {
      const p = pendientes.pop()!;
      if (resultado.has(p) || marcados.includes(p)) continue;
      resultado.set(p, nombre.get(origen) ?? origen);
      pendientes.push(...(implica.get(p) ?? []));
    }
  }
  return resultado;
}

/**
 * Rol = conjunto de permisos del catalogo de mtw-api, agrupados por modulo.
 * La lista sale de GET /api/permisos/catalogo: un permiso nuevo aparece aca
 * solo, sin tocar este archivo. El administrador de negocio tiene siempre
 * todos los permisos de negocio (incluidos los que se agreguen despues).
 */
export const RolEditModal: React.FC<RolEditModalProps> = ({ rol, onClose }) => {
  const queryClient = useQueryClient();
  const esNuevo = !rol;

  const [nombre, setNombre] = useState(rol?.nombre || '');
  const [descripcion, setDescripcion] = useState(rol?.descripcion || '');
  const [esAdministradorNegocio, setEsAdministradorNegocio] = useState(rol?.esAdministradorNegocio ?? false);
  const [permisos, setPermisos] = useState<string[]>(rol?.permisos || []);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const { data: catalogoData, isLoading: cargandoCatalogo } = useQuery({
    queryKey: ['catalogoPermisos'],
    queryFn: getCatalogoPermisos,
    staleTime: Infinity,
  });
  const catalogo = useMemo(() => catalogoData?.data ?? [], [catalogoData]);
  const incluidos = useMemo(() => incluidosPor(permisos, catalogo), [permisos, catalogo]);

  const toggle = (clave: string) =>
    setPermisos((actual) => (actual.includes(clave) ? actual.filter((p) => p !== clave) : [...actual, clave]));

  const mutation = useMutation({
    mutationFn: async () => {
      const datos = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        esAdministradorNegocio,
        // Se guardan solo los marcados a mano; los incluidos los resuelve el backend.
        permisos: esAdministradorNegocio ? [] : permisos,
      };
      return esNuevo ? createRol(datos) : updateRol(rol!.id, datos);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['misPermisos'] });
      onClose();
    },
    onError: (err: any) => {
      setGeneralError(err?.response?.data?.error || err?.message || 'Error al guardar el rol.');
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setGeneralError(null);
    if (!nombre.trim()) {
      setGeneralError('El nombre es obligatorio.');
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      icono={ShieldCheck}
      ancho="lg"
      titulo={esNuevo ? 'Nuevo rol' : rol!.nombre}
      subtitulo="Qué puede hacer en el sistema quien tenga este rol"
      onClose={onClose}
      cerrable={!mutation.isPending}
      onSubmit={handleSubmit}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {esNuevo ? 'Crear rol' : 'Guardar cambios'}
          </Button>
        </Modal.Pie>
      }
    >
      {generalError && <Aviso tono="peligro">{generalError}</Aviso>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nombre del rol" placeholder="Ej: Jefe Comercial" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <Input
          label="Descripción"
          placeholder="Para qué sirve este rol"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </div>

      <Casilla
        className="flex! p-3 rounded-xl border border-amber-200 bg-amber-50/60"
        checked={esAdministradorNegocio}
        onChange={setEsAdministradorNegocio}
        label={
          <span className="flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-600" /> Administrador de negocio
          </span>
        }
        descripcion="Tiene todos los permisos de negocio, incluidos los que se agreguen en el futuro. No incluye las funciones técnicas del sistema."
      />

      {!esAdministradorNegocio && (
        <div className="space-y-4">
          {cargandoCatalogo && <Cargando texto="Cargando permisos…" />}
          {catalogo.map((modulo) => (
            <fieldset key={modulo.id} className="rounded-xl border border-slate-200 overflow-hidden">
              <legend className="sr-only">{modulo.nombre}</legend>
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {modulo.nombre}
              </div>
              <div className="divide-y divide-slate-100">
                {modulo.permisos.map((p) => {
                  const marcado = permisos.includes(p.clave);
                  const incluidoPor = incluidos.get(p.clave);
                  return (
                    <Casilla
                      key={p.clave}
                      className="flex! px-4 py-2.5 hover:bg-slate-50/60"
                      checked={marcado || !!incluidoPor}
                      disabled={!!incluidoPor}
                      onChange={() => toggle(p.clave)}
                      label={p.nombre}
                      descripcion={
                        <>
                          {p.descripcion}
                          {incluidoPor && <span className="block text-[11px] text-brand-700">Incluido por «{incluidoPor}»</span>}
                        </>
                      }
                    />
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}
    </Modal>
  );
};
