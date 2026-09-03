import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Vercel deployment configuration', () => {
  it('builds only the web workspace and keeps SPA invite URLs routable', async () => {
    const configPath = resolve(process.cwd(), 'vercel.json');
    const config = JSON.parse(await readFile(configPath, 'utf8')) as {
      buildCommand?: string;
      outputDirectory?: string;
      rewrites?: Array<{ source: string; destination: string }>;
    };

    expect(config.buildCommand).toBe('npm run build:vercel');
    expect(config.outputDirectory).toBe('apps/web/dist');
    expect(config.rewrites).toContainEqual({
      source: '/(.*)',
      destination: '/index.html'
    });
  });
});
