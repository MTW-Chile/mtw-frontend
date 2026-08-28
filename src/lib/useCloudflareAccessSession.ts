import { useEffect, useState, createContext, useContext } from 'react';

export type SessionState = 'checking' | 'ready' | 'redirecting';

export interface UsuarioSession {
  id?: string;
  name?: string;
  nombre?: string;
  email?: string;
  displayName?: string;
  [key: string]: any;
}

export interface SessionContextType {
  state: SessionState;
  usuario: UsuarioSession | null;
}

export function displayName(usuario?: UsuarioSession | string | null): string {
  if (!usuario) return 'Usuario';
  if (typeof usuario === 'string') return usuario;
  if (usuario.name) return usuario.name;
  if (usuario.nombre) return usuario.nombre;
  if (usuario.displayName) return usuario.displayName;
  if (usuario.email) {
    const part = usuario.email.split('@')[0];
    return part.charAt(0).toUpperCase() + part.slice(1);
  }
  return 'Usuario';
}

export const SessionContext = createContext<SessionContextType>({
  state: 'checking',
  usuario: null,
});

export function useSession() {
  return useContext(SessionContext);
}

/**
 * Gestiona la sesión con Cloudflare Access y Microsoft Entra.
 */
export function useCloudflareAccessSession(): SessionContextType {
  const [state, setState] = useState<SessionState>('checking');
  const [usuario, setUsuario] = useState<UsuarioSession | null>(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;
    let relayOrigin: string;
    try {
      relayOrigin = new URL(apiUrl).origin;
    } catch {
      // VITE_API_URL relativo (dev local) -> sesion lista con usuario local
      setState('ready');
      setUsuario({ name: 'Usuario MTW' });
      return;
    }

    const checkUrl = `${relayOrigin}/api/session-check`;

    fetch(checkUrl, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`access-check respondio ${res.status}`);
        return res.json();
      })
      .then((body) => {
        if (body?.ok) {
          setState('ready');
          setUsuario(body.usuario || body.user || { name: body.email?.split('@')[0] || 'Usuario' });
        } else {
          throw new Error('access-check respondio sin ok:true');
        }
      })
      .catch(() => {
        setState('redirecting');
        const redirectTo = `${checkUrl}?redirect=${encodeURIComponent(window.location.href)}`;
        window.location.href = redirectTo;
      });
  }, []);

  return { state, usuario };
}
