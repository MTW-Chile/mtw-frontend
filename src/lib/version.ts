declare const __APP_VERSION__: string | undefined;
declare const __APP_CANAL__: string | undefined;

// Las inyecta vite.config.ts desde package.json. Si el servidor de desarrollo se
// levantó antes de que existieran, la app no debe caerse por eso.
const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
const canal = typeof __APP_CANAL__ === 'string' ? __APP_CANAL__ : 'Dev';

/** Versión completa (package.json), ej. "2.0.0". */
export const VERSION = version;

/** Como se muestra: canal + major.minor, ej. "Alpha V2.0". El detalle de cada versión está en CHANGELOG.md. */
export const VERSION_VISIBLE = `${canal} V${version.split('.').slice(0, 2).join('.')}`;
