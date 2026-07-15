import { homedir } from 'node:os';
import { join } from 'node:path';

export const APP_DIR_NAME = 'anygate';

interface HomeEnv {
  APPDATA?: string;
  HOME?: string;
  ANYGATE_HOME?: string;
  USERPROFILE?: string;
  XDG_CONFIG_HOME?: string;
}

function userHome(env: HomeEnv = process.env): string {
  return env.HOME ?? env.USERPROFILE ?? homedir();
}

export function resolveAppHomeOverride(env: HomeEnv = process.env): string | undefined {
  const override = env.ANYGATE_HOME;
  return override?.trim() || undefined;
}

export function getAppHome(env: HomeEnv = process.env): string {
  const override = resolveAppHomeOverride(env);
  if (override) return override;
  return join(userHome(env), `.${APP_DIR_NAME}`);
}

export function getConfigPath(env: HomeEnv = process.env): string {
  return join(getAppHome(env), 'config.json');
}

export function getProvidersPath(env: HomeEnv = process.env): string {
  return join(getAppHome(env), 'providers.json');
}

export function getLogsPath(env: HomeEnv = process.env): string {
  return join(getAppHome(env), 'logs');
}

export function getVertexModelsPath(env: HomeEnv = process.env): string {
  return join(getAppHome(env), 'vertex-models.json');
}
