const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_UPLOAD_FILES = 5;

export type PostgresSslMode = "disable" | "require";

function currentEnvironment() {
  return process.env.NODE_ENV ?? "development";
}

export function isDevelopmentLikeEnvironment() {
  const environment = currentEnvironment();
  return environment === "development" || environment === "test";
}

export function getPostgresUrl() {
  const value = process.env.POSTGRES_URL?.trim();
  if (value) {
    return value;
  }

  throw new Error("POSTGRES_URL is required for the server runtime");
}

export function getPostgresSslMode(): PostgresSslMode {
  const configuredMode = process.env.POSTGRES_SSL_MODE?.trim().toLowerCase();
  if (configuredMode === "disable" || configuredMode === "require") {
    return configuredMode;
  }

  const url = getPostgresUrl().toLowerCase();
  if (url.includes("sslmode=disable")) {
    return "disable";
  }

  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    return "disable";
  }

  return "require";
}

export function getUploadLimits() {
  const maxUploadBytes = Number.parseInt(process.env.MAX_UPLOAD_BYTES ?? "", 10);
  const maxUploadFiles = Number.parseInt(process.env.MAX_UPLOAD_FILES ?? "", 10);

  return {
    maxUploadBytes: Number.isFinite(maxUploadBytes) && maxUploadBytes > 0 ? maxUploadBytes : DEFAULT_MAX_UPLOAD_BYTES,
    maxUploadFiles: Number.isFinite(maxUploadFiles) && maxUploadFiles > 0 ? maxUploadFiles : DEFAULT_MAX_UPLOAD_FILES
  };
}

export function getAdminSeed() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const email = process.env.ADMIN_EMAIL?.trim();
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || "Event Admin";

  if (username && password && email) {
    return {
      username,
      password,
      email,
      displayName
    };
  }

  if (username || password || email) {
    throw new Error("ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_EMAIL must be configured together");
  }

  if (isDevelopmentLikeEnvironment()) {
    return {
      username: "admin",
      password: "secret123",
      email: "admin@example.com",
      displayName
    };
  }

  return null;
}
