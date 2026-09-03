import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Ubuntu direct deployment configuration', () => {
  it('keeps the Node server private behind Caddy on the DuckDNS hostname', async () => {
    const caddyfile = await readFile(
      resolve(process.cwd(), 'deployment/ubuntu/Caddyfile'),
      'utf8'
    );
    const service = await readFile(
      resolve(process.cwd(), 'deployment/ubuntu/marfia-server.service'),
      'utf8'
    );

    expect(caddyfile).toContain('marfia-class.duckdns.org');
    expect(caddyfile).toContain('reverse_proxy 127.0.0.1:3100');
    expect(caddyfile).toContain('root * /srv/marfia/web');
    expect(service).toContain('EnvironmentFile=/etc/marfia/server.env');
    expect(service).toContain('NoNewPrivileges=true');
  });
});
