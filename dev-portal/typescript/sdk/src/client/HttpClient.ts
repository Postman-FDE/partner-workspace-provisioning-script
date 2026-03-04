/**
 * HTTP Client wrapper with authentication and error handling
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { ApiError, PostmanClientConfig } from '../types';

const DEFAULT_BASE_URL = 'https://api.getpostman.com';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY = 1000;

/**
 * Custom error class for Postman API errors
 */
export class PostmanApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PostmanApiError';
  }

  static fromAxiosError(error: AxiosError): PostmanApiError {
    const data = error.response?.data as Record<string, unknown> | undefined;
    const errorData = data?.error as Record<string, unknown> | undefined;
    const message = 
      (errorData?.message as string) ||
      (data?.message as string) ||
      error.message ||
      'An unknown error occurred';
    
    return new PostmanApiError(
      message,
      error.response?.status,
      errorData as Record<string, unknown> | undefined
    );
  }
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown, defaultMessage = 'An unknown error occurred'): string {
  if (error instanceof PostmanApiError) {
    return error.message;
  }
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | undefined;
    const errorData = data?.error as Record<string, unknown> | undefined;
    return (errorData?.message as string) || (data?.message as string) || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return defaultMessage;
}

/**
 * HTTP Client for Postman API
 */
export class HttpClient {
  private client: AxiosInstance;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: PostmanClientConfig) {
    this.retryAttempts = config.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
    this.retryDelay = config.retryDelay ?? DEFAULT_RETRY_DELAY;

    this.client = axios.create({
      baseURL: config.baseUrl ?? DEFAULT_BASE_URL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.apiKey,
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        throw PostmanApiError.fromAxiosError(error);
      }
    );
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    attempts: number = this.retryAttempts
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on 4xx errors (client errors)
        if (error instanceof PostmanApiError && error.statusCode && error.statusCode < 500) {
          throw error;
        }

        if (attempt < attempts) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * GET request
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithRetry(async () => {
      const response = await this.client.get<T>(url, config);
      return response.data;
    });
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithRetry(async () => {
      const response = await this.client.post<T>(url, data, config);
      return response.data;
    });
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithRetry(async () => {
      const response = await this.client.put<T>(url, data, config);
      return response.data;
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithRetry(async () => {
      const response = await this.client.patch<T>(url, data, config);
      return response.data;
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithRetry(async () => {
      const response = await this.client.delete<T>(url, config);
      return response.data;
    });
  }
}
