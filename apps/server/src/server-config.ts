export interface ServerRuntimeConfig {
  host: string;
  port: number;
  corsOrigin?: string | readonly string[];
}

export type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export function parseServerConfig(
  environment: RuntimeEnvironment = process.env
): ServerRuntimeConfig {
  const webOrigins = environment.WEB_ORIGIN
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isProduction = environment.NODE_ENV === 'production';

  if (isProduction && !webOrigins?.length) {
    throw new Error('WEB_ORIGIN must be set in production.');
  }

  return {
    host: environment.HOST?.trim() || (isProduction ? '127.0.0.1' : '0.0.0.0'),
    port: Number(environment.PORT ?? 3000),
    corsOrigin: !webOrigins?.length
      ? undefined
      : webOrigins.length === 1
        ? webOrigins[0]
        : webOrigins
  };
}
