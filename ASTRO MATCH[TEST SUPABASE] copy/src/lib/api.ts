import { toast } from 'sonner';

export class ApiError extends Error {
  status: number;
  code?: string;
  
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, code?: string) {
    super(message, 400, code || 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}
const API_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        throw new ApiError(
          `Request failed with status ${response.status}`,
          response.status
        );
      }
      
      if (response.status === 400) {
        throw new ValidationError(
          errorData.message || 'Validation failed',
          errorData.code
        );
      }
      
      throw new ApiError(
        errorData.message || 'An error occurred',
        response.status,
        errorData.code
      );
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new NetworkError('Request timed out');
    }
    
    if (error instanceof NetworkError && retryCount < MAX_RETRIES) {
      await delay(RETRY_DELAYS[retryCount]);
      return fetchWithRetry<T>(url, options, retryCount + 1);
    }
    
    throw error;
  }
}

export function handleApiError(error: unknown, defaultMessage = 'An error occurred') {
  console.error('API Error:', error);
  
  if (error instanceof ValidationError) {
    toast.error(error.message);
    return;
  }
  
  if (error instanceof ApiError) {
    toast.error(error.message || defaultMessage);
    return;
  }
  
  if (error instanceof NetworkError) {
    toast.error('Network error. Please check your connection and try again.');
    return;
  }
  
  toast.error(defaultMessage);
}
