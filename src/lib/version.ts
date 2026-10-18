declare const __APP_VERSION__: string;
declare const __APP_CANAL__: string;

/** Versión completa (package.json), ej. "2.0.0". */
export const VERSION = __APP_VERSION__;

/** Como se muestra: canal + major.minor, ej. "Alpha V2.0". El detalle de cada versión está en CHANGELOG.md. */
export const VERSION_VISIBLE = `${__APP_CANAL__} V${VERSION.split('.').slice(0, 2).join('.')}`;
