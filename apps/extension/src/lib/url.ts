export function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error('Enter the local API URL.');
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Enter a valid local API URL, for example http://127.0.0.1:4317.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('The local API URL must use http or https.');
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error('The local API URL must not contain credentials.');
  }

  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}
