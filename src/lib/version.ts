declare const __APP_VERSION__: string | undefined;
declare const __APP_CANAL__: string | undefined;

// Las inyecta vite.config.ts desde package.json. Si el servidor de desarrollo se
// levantó antes de que existieran, la app no debe caerse por eso.
const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
const canal = typeof __APP_CANAL__ === 'string' ? __APP_CANAL__ : 'Dev';

/** Versión completa (package.json), ej. "2.0.0". */
export const VERSION = version;

/** Como se muestra: canal + major.minor, ej. "Alpha V2.0". El detalle de cada versión está en CHANGELOG.md. */
// "Alpha v2.0", con parche "Alpha v2.0.1" y con corrección urgente sobre un
// parche "Alpha v2.0.4.1" (en package.json va como 2.0.4-1, que es semver
// válido). La v siempre en minúscula.
const [base, correccion] = version.split('-');
const [mayor = '0', menor = '0', parche = '0'] = base.split('.');
export const VERSION_VISIBLE = `${canal} v${mayor}.${menor}${parche !== '0' || correccion ? `.${parche}` : ''}${correccion ? `.${correccion}` : ''}`;
