import { config } from "../../config/env";

export { config };

/**
 * Validates the loaded configuration on application startup.
 * Throws an error if required configuration variables are missing or insecure.
 */
export function validateConfig(): void {
  const requiredEnvVars = [
    { name: "MONGODB_URI", value: config.mongodbUri },
    { name: "JWT_SECRET", value: config.jwtSecret },
  ];

  const missing = requiredEnvVars
    .filter(
      (item) =>
        !item.value ||
        (item.name === "JWT_SECRET" &&
          item.value === "rabbittize-dev-secret-change-in-production" &&
          config.isProduction),
    )
    .map((item) => item.name);

  if (missing.length > 0) {
    throw new Error(
      `CRITICAL CONFIGURATION ERROR: Missing or insecure required environment variables: ${missing.join(
        ", ",
      )}`,
    );
  }

  if (!config.geminiApiKey) {
    console.warn(
      "WARNING: GEMINI_API_KEY is not set. AI Observability and proxy completion features will be disabled.",
    );
  }
}
