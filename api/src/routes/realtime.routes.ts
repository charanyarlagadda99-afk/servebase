import { FastifyInstance } from 'fastify';
import { realtimeBus, RealtimeEvent } from '../services/realtime.js';

export async function realtimeRoutes(fastify: FastifyInstance) {
  // Server-Sent Events (SSE) stream for live kitchen, floor, and order events
  fastify.get('/stream', async (req: any, reply) => {
    const outletId = (req.query.outlet_id as string) || 'default';
    const stationId = req.query.station_id as string;

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders();

    // Initial connection ping
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ connected: true, outletId })}\n\n`);

    const listener = (event: RealtimeEvent) => {
      if (stationId && event.station_id && event.station_id !== stationId) {
        return;
      }
      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    const unsubscribe = realtimeBus.subscribeOutlet(outletId, listener);

    // Heartbeat every 25 seconds to keep connection open
    const heartbeatInterval = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, 25000);

    req.raw.on('close', () => {
      clearInterval(heartbeatInterval);
      unsubscribe();
    });
  });
}
