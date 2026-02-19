import axios from 'axios';

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether the request was successful
 * @property {*} [data] - Response data if successful
 * @property {string} [error] - Error message if failed
 */

/**
 * Generic HTTP client for Postman API
 */
export class HttpClient {
  /**
   * @param {string} apiKey - Postman API key
   * @param {string} [baseUrl='https://api.getpostman.com'] - Base URL for API
   * @param {number} [timeout=30000] - Request timeout in milliseconds
   */
  constructor(apiKey, baseUrl = 'https://api.getpostman.com', timeout = 30000) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
    });
  }

  /**
   * Handle API errors consistently
   * @private
   * @param {Error} error - Axios error
   * @returns {ApiResponse}
   */
  _handleError(error) {
    const errorMessage = error.response?.data?.error?.message 
      || error.response?.data?.message 
      || error.message;
    console.error(`API Error: ${errorMessage}`, error.response?.data);
    return { success: false, error: errorMessage };
  }

  /**
   * Make a GET request
   * @param {string} path - API path
   * @param {Object} [config] - Axios config
   * @returns {Promise<ApiResponse>}
   */
  async get(path, config) {
    try {
      const response = await this.client.get(path, config);
      return { success: true, data: response.data };
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Make a POST request
   * @param {string} path - API path
   * @param {*} payload - Request body
   * @param {Object} [config] - Axios config
   * @returns {Promise<ApiResponse>}
   */
  async post(path, payload, config) {
    try {
      const response = await this.client.post(path, payload, config);
      return { success: true, data: response.data };
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Make a PUT request
   * @param {string} path - API path
   * @param {*} payload - Request body
   * @param {Object} [config] - Axios config
   * @returns {Promise<ApiResponse>}
   */
  async put(path, payload, config) {
    try {
      const response = await this.client.put(path, payload, config);
      return { success: true, data: response.data };
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Make a PATCH request
   * @param {string} path - API path
   * @param {*} payload - Request body
   * @param {Object} [config] - Axios config
   * @returns {Promise<ApiResponse>}
   */
  async patch(path, payload, config) {
    try {
      const response = await this.client.patch(path, payload, config);
      return { success: true, data: response.data };
    } catch (error) {
      return this._handleError(error);
    }
  }

  /**
   * Make a DELETE request
   * @param {string} path - API path
   * @param {Object} [config] - Axios config
   * @returns {Promise<ApiResponse>}
   */
  async delete(path, config) {
    try {
      const response = await this.client.delete(path, config);
      return { success: true, data: response.data };
    } catch (error) {
      return this._handleError(error);
    }
  }
}

export default HttpClient;
