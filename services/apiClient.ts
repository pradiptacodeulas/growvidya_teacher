import axios, { AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { sortResponseDropdowns } from '@/utils/dropdownSort';

let inMemoryToken: string | null = null;

export const setAuthToken = (token: string | null): void => {
  inMemoryToken = token;
};

export const getAuthToken = (): string | null => {
  return inMemoryToken;
};

const getHostFromExpo = (): string | null => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any)?.manifest?.hostUri;
  if (hostUri) {
    return hostUri.split(':')[0];
  }
  return null;
};

const resolveEnvUrl = (rawUrl?: string): string => {
  const cleanUrl = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!cleanUrl) return '';

  if (Platform.OS !== 'web' && (cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1'))) {
    const host = getHostFromExpo() || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
    return cleanUrl.replace(/localhost|127\.0\.0\.1/, host);
  }

  return cleanUrl;
};

/**
 * Resolve Base API URL directly from .env
 */
export const getBaseApiUrl = (): string => {
  const apiUrl = resolveEnvUrl(process.env.EXPO_PUBLIC_API_URL);
  if (apiUrl) return apiUrl;

  const serverUrl = resolveEnvUrl(process.env.EXPO_PUBLIC_SERVER_URL).replace(/\/api\/v1\/?$/, '');
  return serverUrl ? `${serverUrl}/api/v1` : '';
};

/**
 * Server base URL (for static uploads / assets)
 */
export const getServerBaseUrl = (): string => {
  const configuredServer = resolveEnvUrl(process.env.EXPO_PUBLIC_SERVER_URL).replace(/\/api\/v1\/?$/, '');
  if (configuredServer) {
    return configuredServer;
  }
  return getBaseApiUrl().replace(/\/api\/v1\/?$/, '');
};

export const getAvatarUrl = (
  picture?: string | null,
  gender?: string | number | null
): string => {
  const base = getServerBaseUrl();
  const isFemale =
    Number(gender) === 2 ||
    String(gender).trim().toLowerCase() === 'female' ||
    String(gender).trim().toLowerCase() === 'f';
  const defaultAvatar = isFemale
    ? `${base}/vidya_assets/images/female-user.png`
    : `${base}/vidya_assets/images/male-user.png`;

  if (!picture || typeof picture !== 'string' || picture.trim() === '') {
    return defaultAvatar;
  }

  const normalized = picture.trim().replace(/\\/g, '/');
  if (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('file:')
  ) {
    if (normalized.includes('via.placeholder.com')) {
      return defaultAvatar;
    }
    // Harmonize dev/localhost address to the active base
    if (/https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/i.test(normalized)) {
      return normalized.replace(/https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/i, base);
    }
    return normalized;
  }

  const clean = normalized.replace(/^public\//, '').replace(/^\/+/, '');
  return `${base}/${clean}`;
};

export const formatGender = (
  gender?: string | number | null,
  genderName?: string | null
): string => {
  if (genderName && typeof genderName === 'string' && isNaN(Number(genderName)) && genderName.trim()) {
    return genderName.trim();
  }
  const g = String(gender ?? '').trim().toLowerCase();
  if (g === '1' || g === 'male' || g === 'm') return 'Male';
  if (g === '2' || g === 'female' || g === 'f') return 'Female';
  if (g === '3' || g === 'other' || g === 'others') return 'Other';
  if (typeof gender === 'string' && gender.trim() && isNaN(Number(gender))) {
    return gender.trim();
  }
  return 'N/A';
};

export const getFileUrl = (filePath?: string | null): string => {
  if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
    return '';
  }
  const base = getServerBaseUrl();
  const normalized = filePath.trim().replace(/\\/g, '/');

  if (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('file:')
  ) {
    // Harmonize dev/localhost address to the active base
    if (/https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/i.test(normalized)) {
      return normalized.replace(/https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/i, base);
    }
    return normalized;
  }

  const clean = normalized.replace(/^public\//, '').replace(/^\/+/, '');
  return `${base}/${clean}`;
};

/**
 * Standard API Client with automatic JWT Token Injection and response normalization.
 */
export const apiClient = axios.create({
  baseURL: getBaseApiUrl(),
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Attach Bearer token from in-memory token or AsyncStorage
apiClient.interceptors.request.use(
  async (config) => {
    config.baseURL = getBaseApiUrl();

    let token = inMemoryToken;
    if (!token) {
      try {
        token = await AsyncStorage.getItem('@auth_token');
        if (!token) {
          const saved = await AsyncStorage.getItem('user_data');
          if (saved) {
            const parsed = JSON.parse(saved);
            token = parsed?.token || parsed?.data?.token || null;
          }
        }
        if (token) {
          inMemoryToken = token;
        }
      } catch {
        // ignore
      }
    }

    if (token && !config.headers.Authorization) {
      config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    // If data is FormData, remove manual Content-Type so Axios/engine creates multipart boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

const NON_ADMIN_SUBSCRIPTION_PAUSED_MSG =
  'School portal services are temporarily paused. Please contact your School Administration.';
const NON_ADMIN_FEATURE_DISABLED_MSG =
  'This module is currently not enabled for your school. Please contact your School Administration.';
const NON_ADMIN_STORAGE_FULL_MSG =
  'School cloud storage capacity has been reached. Please contact your School Administration.';

const SUBSCRIPTION_LOCK_CODES = new Set([
  'SUBSCRIPTION_EXPIRED',
  'SUBSCRIPTION_SUSPENDED',
  'SUBSCRIPTION_PENDING_APPROVAL',
  'SUBSCRIPTION_REQUIRED',
]);

const FEATURE_LOCK_CODES = new Set([
  'FEATURE_NOT_IN_PLAN',
  'FEATURE_NOT_INCLUDED',
]);

export const cleanErrorMessage = (
  msg: any,
  fallback: string = 'An unexpected error occurred. Please try again.'
): string => {
  if (!msg) return fallback;
  if (typeof msg !== 'string') return String(msg);

  const text = msg.trim();

  // Axios default status code text
  const statusMatch = text.match(/Request failed with status code (\d+)/i);
  if (statusMatch) {
    const code = parseInt(statusMatch[1], 10);
    if (code === 400) return 'Invalid request. Please verify the entered information.';
    if (code === 401) return 'Session expired. Please log in again to continue.';
    if (code === 402) return NON_ADMIN_SUBSCRIPTION_PAUSED_MSG;
    if (code === 403) return 'Access denied: You do not have permission to perform this action.';
    if (code === 404) return 'The requested record or resource was not found.';
    if (code === 409) return 'A conflict occurred: A record with this information already exists.';
    if (code === 413) return 'The uploaded file exceeds the allowed file size limit.';
    if (code === 422) return 'Validation error. Please verify the entered fields.';
    if (code >= 500) return 'The server encountered an error. Please try again shortly.';
  }

  // Network & Timeout
  if (
    text === 'Network Error' ||
    text.includes('Network Error') ||
    text === 'Failed to fetch' ||
    text.includes('ERR_NETWORK') ||
    text.includes('ECONNREFUSED')
  ) {
    return 'Unable to connect to the server. Please check your internet connection or verify the server is running.';
  }
  if (text.includes('timeout') || text.includes('timed out') || text.includes('ECONNABORTED')) {
    return 'The request timed out. Please check your internet connection and try again.';
  }

  // Database / Collation leaks
  if (text.includes('Illegal mix of collations') || text.includes('ER_CANT_AGGREGATE_2COLLATIONS')) {
    return 'One or more fields contain unsupported characters or emojis. Please check your text.';
  }
  if (text.includes('ER_DUP_ENTRY') || text.toLowerCase().includes('duplicate entry')) {
    const lower = text.toLowerCase();
    if (lower.includes('email')) return 'An account with this email address already exists. Please use a different email.';
    if (lower.includes('phone') || lower.includes('primary_contact_number') || lower.includes('mobile')) {
      return 'An account with this mobile/phone number already exists.';
    }
    return 'A record with this information already exists. Please check your entries.';
  }
  if (text.includes('foreign key constraint fails') || text.includes('ER_ROW_IS_REFERENCED')) {
    return 'This item cannot be deleted or modified because other records depend on it.';
  }
  if (text.includes('ER_DATA_TOO_LONG')) {
    return 'The entered text is too long for one or more fields. Please shorten your input.';
  }
  if (text.includes('SQL syntax') || text.includes('ER_PARSE_ERROR') || text.includes('SELECT ') || text.includes('UPDATE ')) {
    return 'A database query error occurred while processing the request.';
  }

  // Generic uninformative phrases
  if (/^(failed|error|failed!|error!|something went wrong|an error occurred|operation failed)$/i.test(text)) {
    return fallback;
  }

  return text;
};

export const formatUserFriendlyError = (error: any): string => {
  if (!error) return 'An unexpected error occurred. Please try again.';
  if (typeof error === 'string') return cleanErrorMessage(error);

  const status = error?.response?.status;
  const resData = error?.response?.data;
  const errCode = resData?.errors?.code || resData?.code || null;

  // Non-admin polite subscription / feature gating messages (zero billing or upgrade prompts)
  if (status === 402 || (errCode && SUBSCRIPTION_LOCK_CODES.has(String(errCode)))) {
    return NON_ADMIN_SUBSCRIPTION_PAUSED_MSG;
  }
  if (errCode && FEATURE_LOCK_CODES.has(String(errCode))) {
    return NON_ADMIN_FEATURE_DISABLED_MSG;
  }
  if (errCode === 'STORAGE_QUOTA_EXCEEDED') {
    return NON_ADMIN_STORAGE_FULL_MSG;
  }

  if (resData) {
    // Specific human message from backend (unless it's just a generic "Validation failed" header)
    if (resData.message && typeof resData.message === 'string' && resData.message.trim()) {
      const msg = resData.message.trim();
      if (
        msg.toLowerCase().includes('upgrade your') ||
        msg.toLowerCase().includes('not included in your')
      ) {
        return NON_ADMIN_FEATURE_DISABLED_MSG;
      }
      if (!/^(validation (error|failed)|invalid data|invalid input)$/i.test(msg)) {
        return cleanErrorMessage(msg);
      }
    }

    // Array of field validation errors
    if (Array.isArray(resData.errors) && resData.errors.length > 0) {
      const msgs = resData.errors
        .map((e: any) => (typeof e === 'string' ? e : e?.msg || e?.message || ''))
        .filter(Boolean);
      if (msgs.length > 0) return cleanErrorMessage(msgs.join('. '));
    }

    // Object of field validation errors (only if NOT metadata like code / upgrade_required)
    if (resData.errors && typeof resData.errors === 'object' && !resData.errors.code && !resData.errors.upgrade_required) {
      const msgs = Object.values(resData.errors)
        .map((e: any) => (typeof e === 'string' ? e : e?.msg || e?.message || ''))
        .filter(Boolean);
      if (msgs.length > 0) return cleanErrorMessage(msgs.join('. '));
    }

    if (resData.message && typeof resData.message === 'string' && resData.message.trim()) {
      return cleanErrorMessage(resData.message);
    }
    if (resData.error && typeof resData.error === 'string' && resData.error.trim()) {
      return cleanErrorMessage(resData.error);
    }
  }

  if (status === 400) return 'Invalid request. Please verify the entered information.';
  if (status === 401) return 'Session expired. Please log in again to continue.';
  if (status === 402) return NON_ADMIN_SUBSCRIPTION_PAUSED_MSG;
  if (status === 403) return 'Access denied: You do not have permission to perform this action.';
  if (status === 404) return 'The requested record or resource was not found.';
  if (status === 409) return 'A conflict occurred: A record with this information already exists.';
  if (status === 413) return 'The uploaded file exceeds the allowed file size limit.';
  if (status === 422) return 'Validation error. Please verify the entered fields.';
  if (status >= 500) return 'The server encountered an error. Please try again shortly.';

  if (error?.code === 'ECONNABORTED' || String(error?.message || '').includes('timeout')) {
    return 'The request timed out. Please check your internet connection and try again.';
  }
  if (
    error?.message === 'Network Error' ||
    String(error?.message || '').includes('Network Error') ||
    !error?.response
  ) {
    return 'Unable to connect to the server. Please check your internet connection or verify the server is running.';
  }

  return cleanErrorMessage(error?.message || 'An unexpected error occurred. Please try again.');
};

let onUnauthorizedCallback: (() => void) | null = null;

export const setOnUnauthorizedCallback = (callback: (() => void) | null): void => {
  onUnauthorizedCallback = callback;
};

let isHandling401 = false;

export const handleUnauthorizedSession = async (requestUrl?: string): Promise<void> => {
  const url = requestUrl || '';
  const isAuthEndpoint =
    url.toLowerCase().includes('/auth/login') ||
    url.toLowerCase().includes('/auth/signin') ||
    url.toLowerCase().endsWith('/login');

  if (isAuthEndpoint) {
    return;
  }

  if (isHandling401) {
    return;
  }
  isHandling401 = true;

  try {
    setAuthToken(null);
    delete apiClient.defaults.headers.common['Authorization'];
    await AsyncStorage.removeItem('@auth_token');
    await AsyncStorage.removeItem('user_data');

    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
  } catch (err) {
    console.warn('[handleUnauthorizedSession] Error during 401 session cleanup:', err);
  } finally {
    setTimeout(() => {
      isHandling401 = false;
    }, 3000);
  }
};

// Response Interceptor: Normalize { success: true, data } into { status: true, data, message } and sort dropdowns
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data && typeof response.data === 'object') {
      if (response.data.status === undefined && response.data.success !== undefined) {
        response.data.status = response.data.success;
      }
      const requestUrl = response.config?.url || '';
      response.data = sortResponseDropdowns(requestUrl, response.data);
    }
    return response;
  },
  async (error) => {
    const url = error?.config?.url || 'unknown';
    const base = error?.config?.baseURL || '';
    const fullUrl = `${base}${url}`;
    const status = error?.response?.status;
    console.warn(`[API Error ${status || 'NET'}] ${error?.config?.method?.toUpperCase()} ${fullUrl}:`, error?.response?.data || error?.message);

    if (status === 401) {
      await handleUnauthorizedSession(url);
    }

    const friendlyMessage = formatUserFriendlyError(error);
    const err = new Error(friendlyMessage);
    (err as any).response = error?.response;
    return Promise.reject(err);
  }
);

/**
 * Universal fetch adapter for legacy screens still using fetch-like syntax
 */
export const apiFetch = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const base = getBaseApiUrl();
  const cleanEndpoint = endpoint.startsWith('http')
    ? endpoint
    : `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  let token = inMemoryToken;
  if (!token) {
    try {
      token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        const saved = await AsyncStorage.getItem('user_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          token = parsed?.token || parsed?.data?.token || null;
        }
      }
      if (token) {
        inMemoryToken = token;
      }
    } catch {
      // ignore
    }
  }

  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers.Authorization && !headers.authorization) {
    headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  const response = await fetch(cleanEndpoint, {
    ...options,
    headers,
  });

  const text = await response.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { status: response.ok, success: response.ok, message: text };
  }

  if (json && typeof json === 'object') {
    if (json.status === undefined && json.success !== undefined) {
      json.status = json.success;
    }
    if (json.success === undefined) {
      json.success = response.ok;
    }
  }

  if (response.status === 401) {
    await handleUnauthorizedSession(cleanEndpoint);
  }

  const errCode = json?.errors?.code || json?.code || null;
  let normalizedMessage = json?.message;
  if (response.status === 402 || (errCode && SUBSCRIPTION_LOCK_CODES.has(String(errCode)))) {
    normalizedMessage = NON_ADMIN_SUBSCRIPTION_PAUSED_MSG;
  } else if (errCode && FEATURE_LOCK_CODES.has(String(errCode))) {
    normalizedMessage = NON_ADMIN_FEATURE_DISABLED_MSG;
  } else if (errCode === 'STORAGE_QUOTA_EXCEEDED') {
    normalizedMessage = NON_ADMIN_STORAGE_FULL_MSG;
  }

  return {
    ok: response.ok,
    status: response.status,
    success: Boolean(json?.success ?? response.ok),
    data: json?.data !== undefined ? json.data : json,
    json: async () => json,
    ...json,
    message: normalizedMessage,
  };
};

export default apiClient;
