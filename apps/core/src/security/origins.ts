import type { AppConfig } from '../config/env.js';

const EXTENSION_PROTOCOLS = new Set(['chrome-extension:', 'moz-extension:']);

function isWellFormedExtensionOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);

    return (
      EXTENSION_PROTOCOLS.has(url.protocol) &&
      url.hostname.length > 0 &&
      (url.pathname === '' || url.pathname === '/') &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}

/**
 * Explicit origins are always allowed. Outside production, any well-formed browser
 * extension origin is accepted so unpacked development extensions can connect without
 * pinning an unstable extension ID. Production requires an explicit allowlist.
 */
export function isAllowedOrigin(
  origin: string,
  config: Pick<AppConfig, 'nodeEnv' | 'allowedOrigins'>,
): boolean {
  if (config.allowedOrigins.includes(origin)) {
    return true;
  }

  return config.nodeEnv !== 'production' && isWellFormedExtensionOrigin(origin);
}
