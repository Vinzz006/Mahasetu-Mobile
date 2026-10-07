import { auth } from '../lib/firebase';
import { getAppCheckToken } from '../lib/appCheck';
import { Config } from '../constants/config';

class ApiClient {
  private get baseUrl(): string {
    return Config.API_BASE_URL;
  }

  private async getAuthToken(forceRefresh = false): Promise<string | null> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return null;
      return await currentUser.getIdToken(forceRefresh);
    } catch {
      return null;
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
    const token = await this.getAuthToken(isRetry);
    const appCheckToken = await getAppCheckToken(isRetry);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (appCheckToken) {
      headers['X-Firebase-AppCheck'] = appCheckToken;
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // On 401 Unauthorized: check if REAUTH_REQUIRED, otherwise force refresh token once and retry
      if (response.status === 401) {
        let errorData: any = {};
        try {
          const cloned = response.clone();
          errorData = await cloned.json();
        } catch {
          // Response body was not JSON or already consumed
        }

        if (errorData?.code === 'REAUTH_REQUIRED') {
          const error = new Error(errorData.message || 'Re-authentication required for this privileged action') as any;
          error.status = 401;
          error.code = 'REAUTH_REQUIRED';
          throw error;
        }

        if (!isRetry && auth.currentUser) {
          try {
            const refreshedToken = await auth.currentUser.getIdToken(true);
            if (refreshedToken) {
              return await this.request<T>(endpoint, options, true);
            }
          } catch {
            // Token revoked or user disabled -> sign out immediately
            await auth.signOut();
          }
        }
      }

      if (!response.ok) {
        let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
        let errorCode: string | undefined;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          errorCode = errorData.code;
        } catch {
          // Non-JSON error body
        }

        if (response.status === 401 && isRetry) {
          // Persistent 401 after force refresh -> sign out
          await auth.signOut();
        }

        const error = new Error(errorMessage) as any;
        error.status = response.status;
        error.code = errorCode;
        throw error;
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Please check your network connection.');
      }
      throw err;
    }
  }

  get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  post<T>(endpoint: string, data?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
  }

  put<T>(endpoint: string, data?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
  }

  patch<T>(endpoint: string, data?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
  }

  delete<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }
}

export const api = new ApiClient();
