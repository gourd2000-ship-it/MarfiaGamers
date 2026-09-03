import { describe, expect, it } from 'vitest';
import { parseServerConfig } from '../apps/server/src/server-config.js';

describe('parseServerConfig', () => {
  it('binds production servers to loopback and requires an allowed web origin', () => {
    expect(() => parseServerConfig({ NODE_ENV: 'production' })).toThrow(
      'WEB_ORIGIN must be set in production.'
    );

    expect(parseServerConfig({
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://marfia-class.duckdns.org'
    })).toMatchObject({
      host: '127.0.0.1',
      port: 3000,
      corsOrigin: 'https://marfia-class.duckdns.org'
    });
  });

  it('keeps the development listener available to the local network', () => {
    expect(parseServerConfig({ NODE_ENV: 'development' })).toMatchObject({
      host: '0.0.0.0',
      port: 3000,
      corsOrigin: undefined
    });
  });
});
