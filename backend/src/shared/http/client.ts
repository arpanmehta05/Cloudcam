import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

export interface HttpClientConfig extends AxiosRequestConfig {
  retries?: number;
  retryDelayMs?: number;
}

/**
 * Creates an Axios client instance equipped with automatic retries and exponential backoff.
 */
export function createHttpClient(config: HttpClientConfig = {}): AxiosInstance {
  const {
    retries = 3,
    retryDelayMs = 1000,
    timeout = 30000, // Default 30s timeout
    ...axiosConfig
  } = config;

  const instance = axios.create({
    timeout,
    ...axiosConfig,
  });

  // Attach a custom retry interceptor
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const { config: requestConfig } = error;

      if (!requestConfig) {
        return Promise.reject(error);
      }

      // Track retry iteration internally
      requestConfig.__retryCount = requestConfig.__retryCount || 0;

      if (requestConfig.__retryCount >= retries) {
        return Promise.reject(error);
      }

      // Determine if error warrants a retry (network drop, 5xx server fault, or 429 rate limit)
      const isNetworkError = !error.response;
      const isServerError = error.response && error.response.status >= 500;
      const isRateLimited = error.response && error.response.status === 429;

      if (isNetworkError || isServerError || isRateLimited) {
        requestConfig.__retryCount += 1;

        // Calculate exponential backoff: baseDelay * 2^(retryCount - 1)
        const backoffDelay =
          retryDelayMs * Math.pow(2, requestConfig.__retryCount - 1);

        await new Promise((resolve) => setTimeout(resolve, backoffDelay));

        // Re-execute request
        return instance(requestConfig);
      }

      return Promise.reject(error);
    },
  );

  return instance;
}
