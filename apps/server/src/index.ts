import { createRealtimeServer } from './realtime-server.js';
import { parseServerConfig } from './server-config.js';

const { host, port, corsOrigin } = parseServerConfig();
const server = await createRealtimeServer({
  host,
  port,
  corsOrigin
});
console.log(`Realtime server listening on ${server.url}`);
