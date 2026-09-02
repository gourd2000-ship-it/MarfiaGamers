import { createRealtimeServer } from './realtime-server.js';

const port = Number(process.env.PORT ?? 3000);
const webOrigins = process.env.WEB_ORIGIN
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOrigin = !webOrigins?.length
  ? undefined
  : webOrigins.length === 1
    ? webOrigins[0]
    : webOrigins;
const server = await createRealtimeServer({
  host: '0.0.0.0',
  port,
  corsOrigin
});
console.log(`Realtime server listening on ${server.url}`);
