/**
 * API Configuration
 * Centralized configuration for API endpoints
 * Uses environment variables for cloud deployment compatibility
 */

const getApiBaseUrl = (): string => {
  // In development, use VITE_API_BASE_URL from .env
  // In production, this will be set by the deployment platform
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  
  if (!apiBaseUrl) {
    // Fallback to default local development URL
    console.warn('VITE_API_BASE_URL not set in .env file. Using default: http://localhost:3000');
    return 'http://localhost:3000';
  }
  
  // Ensure the URL doesn't end with a slash and trim whitespace
  return apiBaseUrl.trim().replace(/\/$/, '');
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * Constructs a full API endpoint URL
 * @param endpoint - API endpoint path (e.g., '/auth/examiner/login')
 * @returns Full URL to the API endpoint
 */
export const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
};

