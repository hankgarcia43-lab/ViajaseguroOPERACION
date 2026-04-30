const EXPLICIT_API_URL = process.env.NEXT_PUBLIC_API_URL?.trim();
const LOCAL_API_URL = 'http://localhost:4000/api';
const REMOTE_API_URL = 'https://viajasegurooperacion-api.onrender.com/api';
const PROXY_API_URL = '/api/proxy';

function isLocalBrowser() {
  if (typeof window === 'undefined') {
    return false;
  }

  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function isLocalLike(url: string) {
  return /localhost|127\.0\.0\.1|::1/i.test(url);
}

function resolveDirectApiUrl() {
  if (EXPLICIT_API_URL) {
    return EXPLICIT_API_URL;
  }

  return isLocalBrowser() ? LOCAL_API_URL : REMOTE_API_URL;
}

function resolvePrimaryApiUrl() {
  if (typeof window !== 'undefined') {
    return PROXY_API_URL;
  }

  return resolveDirectApiUrl();
}

function resolveFallbackApiUrl(primaryApiUrl: string) {
  const directApiUrl = resolveDirectApiUrl();

  if (primaryApiUrl === PROXY_API_URL) {
    return directApiUrl;
  }

  if (isLocalLike(primaryApiUrl)) {
    return REMOTE_API_URL;
  }

  if (!isLocalLike(primaryApiUrl) && primaryApiUrl !== LOCAL_API_URL) {
    return LOCAL_API_URL;
  }

  return null;
}

export const API_URL = resolvePrimaryApiUrl();
export const API_ORIGIN = resolveDirectApiUrl().replace(/\/api\/?$/, '');

const SESSION_TOKEN_KEY = 'vs_token';
const SESSION_ROLE_KEY = 'vs_role';
const SESSION_NAME_KEY = 'vs_name';

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: 'passenger' | 'driver' | 'admin';
  };
}

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
}

function migrateLegacySession(storage: Storage) {
  const legacyToken = window.localStorage.getItem(SESSION_TOKEN_KEY);
  const legacyRole = window.localStorage.getItem(SESSION_ROLE_KEY);
  const legacyName = window.localStorage.getItem(SESSION_NAME_KEY);

  if (legacyToken && !storage.getItem(SESSION_TOKEN_KEY)) {
    storage.setItem(SESSION_TOKEN_KEY, legacyToken);
  }

  if (legacyRole && !storage.getItem(SESSION_ROLE_KEY)) {
    storage.setItem(SESSION_ROLE_KEY, legacyRole);
  }

  if (legacyName && !storage.getItem(SESSION_NAME_KEY)) {
    storage.setItem(SESSION_NAME_KEY, legacyName);
  }
}

function getApiErrorMessage(body: unknown) {
  if (!body || typeof body !== 'object') {
    return 'Ocurrio un error al conectar con la API';
  }

  const maybeBody = body as { message?: string | string[] };
  if (Array.isArray(maybeBody.message)) {
    return maybeBody.message.join(', ');
  }

  return maybeBody.message ?? 'Ocurrio un error al conectar con la API';
}

function parseBody(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  const headers = new Headers(options?.headers ?? {});

  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const performRequest = async (baseUrl: string) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers
    });

    const text = await response.text();
    const body = parseBody(text);

    if (!response.ok) {
      throw new Error(getApiErrorMessage(body));
    }

    return body as T;
  };

  const primaryApiUrl = resolvePrimaryApiUrl();

  try {
    return await performRequest(primaryApiUrl);
  } catch {
    const fallbackApiUrl = resolveFallbackApiUrl(primaryApiUrl);
    if (fallbackApiUrl) {
      try {
        return await performRequest(fallbackApiUrl);
      } catch {
        // Continue to final error.
      }
    }

    const fallbackText = fallbackApiUrl ? `, ${fallbackApiUrl}` : '';
    throw new Error(
      `No se pudo conectar con la API. Se intentaron: ${primaryApiUrl}${fallbackText}. Verifica NEXT_PUBLIC_API_URL, API_PROXY_TARGET y CORS_ORIGIN.`
    );
  }
}

export function buildApiAssetUrl(path: string | null | undefined) {
  if (!path) {
    return null;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (!API_ORIGIN) {
    return path;
  }

  return `${API_ORIGIN}${path}`;
}

export function saveSession(token: string, role: string, fullName: string) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(SESSION_TOKEN_KEY, token);
  storage.setItem(SESSION_ROLE_KEY, role);
  storage.setItem(SESSION_NAME_KEY, fullName);

  window.localStorage.removeItem(SESSION_TOKEN_KEY);
  window.localStorage.removeItem(SESSION_ROLE_KEY);
  window.localStorage.removeItem(SESSION_NAME_KEY);
}

export function saveToken(token: string) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(SESSION_TOKEN_KEY, token);
  window.localStorage.removeItem(SESSION_TOKEN_KEY);
}

export function getToken() {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  migrateLegacySession(storage);
  return storage.getItem(SESSION_TOKEN_KEY);
}

export function getSessionRole() {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  migrateLegacySession(storage);
  return storage.getItem(SESSION_ROLE_KEY);
}

export function getSessionName() {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  migrateLegacySession(storage);
  return storage.getItem(SESSION_NAME_KEY);
}

export function clearSession() {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(SESSION_TOKEN_KEY);
    storage.removeItem(SESSION_ROLE_KEY);
    storage.removeItem(SESSION_NAME_KEY);
  }

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
    window.localStorage.removeItem(SESSION_ROLE_KEY);
    window.localStorage.removeItem(SESSION_NAME_KEY);
  }
}