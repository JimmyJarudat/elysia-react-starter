import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { toast } from "react-toastify";
import { apiConfig } from "@/config";

type RefreshResponse = {
  success?: boolean;
  message?: string;
};

type RetriableRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
};

type ApiRequestConfig = AxiosRequestConfig & {
  skipAuthRefresh?: boolean;
};

const REFRESH_ENDPOINT = "/auth/refresh-token";
const LOGIN_PATH = "/login";

let refreshPromise: Promise<boolean> | null = null;

const api: AxiosInstance = axios.create({
  baseURL: apiConfig.backendBaseUrl,
  timeout: 60_000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const refreshClient = axios.create({
  baseURL: apiConfig.backendBaseUrl,
  timeout: 60_000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const dispatchSessionChanged = () => {
  window.dispatchEvent(new Event("session:changed"));
};

const clearSession = () => {
  dispatchSessionChanged();
};

const getErrorMessage = (error: AxiosError, fallback: string) => {
  const data = error.response?.data;

  if (typeof data === "object" && data && "message" in data && typeof data.message === "string") {
    return data.message;
  }

  return fallback;
};

const isRefreshRequest = (url?: string) => {
  if (!url) {
    return false;
  }

  return url.includes(REFRESH_ENDPOINT);
};

const refreshAccessToken = async () => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await refreshClient.post<RefreshResponse>(REFRESH_ENDPOINT);
      const success = response.data.success ?? (response.status >= 200 && response.status < 300);

      if (success) {
        dispatchSessionChanged();
      }

      return success;
    } catch {
      clearSession();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

const redirectToLogin = () => {
  if (window.location.pathname !== LOGIN_PATH) {
    window.location.replace(LOGIN_PATH);
  }
};

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.withCredentials = true;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const status = error.response?.status;

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.skipAuthRefresh &&
      !isRefreshRequest(originalRequest.url)
    ) {
      originalRequest._retry = true;

      const refreshed = await refreshAccessToken();

      if (refreshed) {
        return api(originalRequest);
      }

      toast.error("Session expired, please log in again");
      redirectToLogin();
    }

    if (status === 403) {
      toast.error("You don't have permission to access this resource");
    } else if (status === 429) {
      toast.error(getErrorMessage(error, "Too many requests, please wait a moment"));
    } else if (status && status >= 500) {
      toast.error("A server error occurred");
    } else if (!error.response) {
      toast.error("Unable to connect to the server");
    }

    return Promise.reject(error);
  },
);

export const useApi = () => {
  const get = <T = unknown>(
    url: string,
    config?: ApiRequestConfig,
  ): Promise<AxiosResponse<T>> => api.get<T>(url, config);

  const post = <T = unknown>(
    url: string,
    data?: unknown,
    config?: ApiRequestConfig,
  ): Promise<AxiosResponse<T>> => api.post<T>(url, data, config);

  const put = <T = unknown>(
    url: string,
    data?: unknown,
    config?: ApiRequestConfig,
  ): Promise<AxiosResponse<T>> => api.put<T>(url, data, config);

  const patch = <T = unknown>(
    url: string,
    data?: unknown,
    config?: ApiRequestConfig,
  ): Promise<AxiosResponse<T>> => api.patch<T>(url, data, config);

  const del = <T = unknown>(
    url: string,
    config?: ApiRequestConfig,
  ): Promise<AxiosResponse<T>> => api.delete<T>(url, config);

  const fetchWithToken = async (url: string, options: RequestInit = {}) => {
    const response = await api.request({
      url,
      method: options.method ?? "GET",
      data: options.body,
      headers: options.headers as AxiosRequestConfig["headers"],
      withCredentials: true,
    });

    return new Response(JSON.stringify(response.data), {
      status: response.status,
      statusText: response.statusText,
      headers: { "Content-Type": "application/json" },
    });
  };

  return {
    api,
    get,
    post,
    put,
    patch,
    del,
    fetchWithToken,
    refreshAccessToken,
    clearTokens: clearSession,
    saveTokens: dispatchSessionChanged,
  };
};

export default api;
