import axios, { AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { sortResponseDropdowns } from '@/utils/dropdownSort';

export const API_PORT = 5001;
const DEFAULT_API_URL = `http://localhost:${API_PORT}/api/v1`;

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

export const getBaseApiUrl = (): string => {
  // 1. On Native Devices running Expo Go / development client:
  // Dynamically resolve the host machine's IP (e.g. 10.233.181.185 or 192.168.x.x)
  if (Platform.OS !== 'web') {
    const expoHost = getHostFromExpo();
    if (expoHost) {
      return `http://${expoHost}:${API_PORT}/api/v1`;
    }

    if (Platform.OS === 'android') {
      return `http://10.0.2.2:${API_PORT}/api/v1`;
    }
  }

  // 2. If configured via EXPO_PUBLIC_API_URL
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (
    configured &&
    !configured.includes('growvidya.in') &&
    !configured.includes('localhost') &&
    !configured.includes('127.0.0.1')
  ) {
    return configured.replace(/\/+$/, '').replace(':5000', `:${API_PORT}`);
  }

  // 3. Fallback (Web / Simulator)
  return DEFAULT_API_URL;
};

export const getServerBaseUrl = (): string => {
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

  const trimmed = picture.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file:')
  ) {
    if (trimmed.includes('portal.growvidya.in/dev/')) {
      const pathPart = trimmed.split('portal.growvidya.in/dev/')[1]?.replace(/^\/+/, '');
      return `${base}/${pathPart}`;
    }
    if (trimmed.includes('via.placeholder.com')) {
      return defaultAvatar;
    }
    // Replace any legacy local IP or port (5000 or 5001) with current server base
    if (/http:\/\/[^/]+:(5000|5001)/.test(trimmed)) {
      return trimmed.replace(/http:\/\/[^/]+:(5000|5001)/, base);
    }
    return trimmed;
  }

  return `${base}/${trimmed.replace(/^\/+/, '')}`;
};

export const getFileUrl = (filePath?: string | null): string => {
  if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
    return '';
  }
  const base = getServerBaseUrl();
  const trimmed = filePath.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file:')
  ) {
    if (trimmed.includes('portal.growvidya.in/dev/')) {
      const pathPart = trimmed.split('portal.growvidya.in/dev/')[1]?.replace(/^\/+/, '');
      return `${base}/${pathPart}`;
    }
    // Replace any legacy local IP or port (5000 or 5001) with current server base
    if (/http:\/\/[^/]+:(5000|5001)/.test(trimmed)) {
      return trimmed.replace(/http:\/\/[^/]+:(5000|5001)/, base);
    }
    return trimmed;
  }
  return `${base}/${trimmed.replace(/^\/+/, '')}`;
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
        const saved = await AsyncStorage.getItem('user_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          token = parsed?.token || parsed?.data?.token || null;
          if (token) {
            inMemoryToken = token;
          }
        }
      } catch {
        // ignore
      }
    }

    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export const cleanErrorMessage = (msg: any): string => {
  if (!msg) return 'An unexpected error occurred. Please try again.';
  if (typeof msg !== 'string') return String(msg);

  let text = msg.trim();

  // Axios default status code text
  const statusMatch = text.match(/Request failed with status code (\d+)/i);
  if (statusMatch) {
    const code = parseInt(statusMatch[1], 10);
    if (code === 400) return 'Invalid request. Please verify the entered information.';
    if (code === 401) return 'Session expired. Please log in again to continue.';
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
    return 'The requested operation could not be completed. Please try again.';
  }

  return text;
};

export const formatUserFriendlyError = (error: any): string => {
  if (!error) return 'An unexpected error occurred. Please try again.';
  if (typeof error === 'string') return cleanErrorMessage(error);

  const resData = error?.response?.data;
  if (resData) {
    // 1. If resData has code: 'FEATURE_NOT_IN_PLAN', use message directly
    if (resData.errors?.code === 'FEATURE_NOT_IN_PLAN' && resData.message) {
      return cleanErrorMessage(resData.message);
    }

    // 2. Specific human message from backend (unless it's just a generic "Validation failed" header)
    if (resData.message && typeof resData.message === 'string' && resData.message.trim()) {
      const msg = resData.message.trim();
      if (!/^(validation (error|failed)|invalid data|invalid input)$/i.test(msg)) {
        return cleanErrorMessage(msg);
      }
    }

    // 3. Array of field validation errors
    if (Array.isArray(resData.errors) && resData.errors.length > 0) {
      const msgs = resData.errors
        .map((e: any) => (typeof e === 'string' ? e : e?.msg || e?.message || ''))
        .filter(Boolean);
      if (msgs.length > 0) return cleanErrorMessage(msgs.join('. '));
    }

    // 4. Object of field validation errors (only if NOT metadata like code / upgrade_required)
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

  const status = error?.response?.status;
  if (status === 400) return 'Invalid request. Please verify the entered information.';
  if (status === 401) return 'Session expired. Please log in again to continue.';
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
  (error) => {
    const url = error?.config?.url || 'unknown';
    const base = error?.config?.baseURL || '';
    const fullUrl = `${base}${url}`;
    const status = error?.response?.status;
    console.warn(`[API Error ${status || 'NET'}] ${error?.config?.method?.toUpperCase()} ${fullUrl}:`, error?.response?.data || error?.message);
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
      const saved = await AsyncStorage.getItem('user_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        token = parsed?.token || parsed?.data?.token || null;
        if (token) {
          inMemoryToken = token;
        }
      }
    } catch {
      // ignore
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${token}`;
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
    json = { status: response.ok, message: text };
  }

  if (json && typeof json === 'object') {
    if (json.status === undefined && json.success !== undefined) {
      json.status = json.success;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    json: async () => json,
    data: json,
  };
};

export default apiClient;
