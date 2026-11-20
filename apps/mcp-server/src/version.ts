declare const __SERVICE_VERSION__: string;

/**
 * Replaced at build time by tsup. The fallback keeps `tsx` development runs working
 * without a separate build step.
 */
export const SERVICE_VERSION =
  typeof __SERVICE_VERSION__ === 'string'
    ? __SERVICE_VERSION__
    : (process.env.npm_package_version ?? '0.0.0-dev');
