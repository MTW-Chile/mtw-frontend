import { useEffect, useState } from 'react';

type SessionState = 'checking' | 'ready' | 'redirecting';

/**
 * "Enciende" la sesion de Cloudflare Access antes de dejar que el resto de
 * la app haga llamadas XHR a mtw-relay-api. Cloudflare Access redirige con
 * una navegacion de pagina completa cuando no hay sesion - eso no funciona
 * si la primera vez que se topa con eso es en medio de un fetch/axios, asi
 * que esta pantalla se asegura de resolverlo primero con una redireccion
 * real de pestaña.
 *
 * Si VITE_API_URL no es una URL absoluta (desarrollo local, mismo origen),
 * no hay nada que "encender" - se considera listo de inmediato.
 */
export function useCloudflareAccessSession(): SessionState {
  const [state, setState] = useState<SessionState>('checking');

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;
    let relayOrigin: string;
    try {
      relayOrigin = new URL(apiUrl).origin;
    } catch {
      // VITE_API_URL relativo (ej. "/api") -> mismo origen, no hay Access de por medio.
      setState('ready');
      return;
    }

    const checkUrl = `${relayOrigin}/access-check`;

    fetch(checkUrl, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`access-check respondio ${res.status}`);
        return res.json();
      })
      .then((body) => {
        if (body?.ok) {
          setState('ready');
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

  return state;
}
