const axios = require("axios");

const BASE_URL = "http://20.207.122.201/evaluation-service/logs";

const VALID_STACKS = ["backend", "frontend"];
const VALID_LEVELS = ["debug", "info", "warn", "error", "fatal"];
const VALID_PACKAGES_BACKEND = [
  "cache", "controller", "cron_job", "db", "domain",
  "handler", "repository", "route", "service"
];
const VALID_PACKAGES_FRONTEND = ["api", "component", "hook", "page", "state", "style"];
const VALID_PACKAGES_SHARED = ["auth", "config", "middleware", "utils"];

/**
 * Reusable Log function that sends log entries to the Affordmed evaluation server.
 * @param {string} stack   - "backend" or "frontend"
 * @param {string} level   - "debug" | "info" | "warn" | "error" | "fatal"
 * @param {string} pkg     - package name (see allowed values per stack)
 * @param {string} message - descriptive log message
 * @param {string} token   - Bearer token for authentication
 */
async function Log(stack, level, pkg, message, token) {
  // Validate inputs
  if (!VALID_STACKS.includes(stack)) {
    throw new Error(`Invalid stack: "${stack}". Must be one of: ${VALID_STACKS.join(", ")}`);
  }
  if (!VALID_LEVELS.includes(level)) {
    throw new Error(`Invalid level: "${level}". Must be one of: ${VALID_LEVELS.join(", ")}`);
  }

  const allValidPackages = [
    ...VALID_PACKAGES_SHARED,
    ...(stack === "backend" ? VALID_PACKAGES_BACKEND : VALID_PACKAGES_FRONTEND),
  ];
  if (!allValidPackages.includes(pkg)) {
    throw new Error(`Invalid package: "${pkg}" for stack "${stack}". Must be one of: ${allValidPackages.join(", ")}`);
  }

  if (!token) {
    throw new Error("Bearer token is required for logging.");
  }

  // API enforces max 48 characters on message
  const truncatedMessage = message.length > 48 ? message.substring(0, 45) + "..." : message;

  try {
    const response = await axios.post(
      BASE_URL,
      { stack, level, package: pkg, message: truncatedMessage },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (err) {
    // Silently fail so logging never crashes the main application
    const errMsg = err.response?.data || err.message;
    console.error(`[LogMiddleware] Failed to send log: ${JSON.stringify(errMsg)}`);
  }
}

module.exports = { Log };
