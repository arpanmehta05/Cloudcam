const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
};

const getTimestamp = () =>
  new Date().toISOString().replace("T", " ").slice(0, 19);

/**
 * Structured logger utility to handle standardized application logs.
 */
export const logger = {
  info(message: string, ...args: unknown[]) {
    // eslint-disable-next-line no-console
    console.log(
      `${colors.dim}${getTimestamp()}${colors.reset} [${
        colors.green
      }INFO${colors.reset}] ${message}`,
      ...args,
    );
  },
  warn(message: string, ...args: unknown[]) {
    console.warn(
      `${colors.dim}${getTimestamp()}${colors.reset} [${
        colors.yellow
      }WARN${colors.reset}] ${message}`,
      ...args,
    );
  },
  error(message: string, error?: unknown, ...args: unknown[]) {
    const errDetails =
      error instanceof Error ? error.stack || error.message : error;
    console.error(
      `${colors.dim}${getTimestamp()}${colors.reset} [${
        colors.red
      }ERROR${colors.reset}] ${message}`,
      errDetails ? `\nDetails: ${errDetails}` : "",
      ...args,
    );
  },
  debug(message: string, ...args: unknown[]) {
    if (process.env.APP_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log(
        `${colors.dim}${getTimestamp()}${colors.reset} [${
          colors.cyan
        }DEBUG${colors.reset}] ${message}`,
        ...args,
      );
    }
  },
};
