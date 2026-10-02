import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { pool } from './db/index.js';
import { corePool } from './services/core-pool.js';
import { registerV1Routes } from './routes/index.js';
import { errorHandler } from './middleware/envelope.js';
import { getFloorLayout } from './services/floor.js';
import { getFullMenu } from './services/menu.js';
import { getStationQueue } from './services/kds.js';
import { getAllStockOnHand } from './services/inventory.js';
import { getEmployees } from './services/staff.js';
import { getRooms } from './services/hotel.js';
import { getAlerts } from './services/alerts.js';
import { verifyAuditChain } from './services/audit.js';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false,
  });

  fastify.setErrorHandler(errorHandler);

  await fastify.register(cors, {
    origin: true,
  });

  await fastify.register(rateLimit, {
    max: 2000,
    timeWindow: '1 minute',
  });

  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'ServeBase Enterprise Hospitality API',
        description: 'REST API surface for Point-of-Sale, Kitchen KDS, Inventory, and Hotel PMS operations',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    let dbStatus = 'connected';
    try {
      await pool.query('SELECT 1');
    } catch {
      dbStatus = 'disconnected';
    }

    let coreStatus = 'active';
    try {
      const res = await corePool.execute('price_bill', {
        items: [{ quantity: 1, unit_price: 10000, tax_rate_percent: 5 }],
      });
      if (!res) coreStatus = 'degraded';
    } catch {
      coreStatus = 'unavailable';
    }

    return {
      status: 'ok',
      service: 'ServeBase API Server',
      database: dbStatus,
      core_engine: coreStatus,
      timestamp: new Date().toISOString(),
    };
  });

  // Register modern versioned REST surface (/api/v1)
  await fastify.register(registerV1Routes, { prefix: '/api/v1' });

  // Legacy compatibility endpoints for unmigrated callers
  fastify.get('/api/audit/verify', async () => {
    const oRes = await pool.query('SELECT id FROM outlets WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1');
    return verifyAuditChain(oRes.rows[0]?.id || 'default');
  });
  fastify.get('/api/tables', async () => {
    const oRes = await pool.query('SELECT id FROM outlets WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1');
    const layout = await getFloorLayout(oRes.rows[0]?.id);
    return { tables: layout };
  });
  fastify.get('/api/menu', async () => {
    const oRes = await pool.query('SELECT id FROM outlets WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1');
    const menu = await getFullMenu(oRes.rows[0]?.id);
    return { menu };
  });
  fastify.get('/api/kds/:station', async (req: any) => {
    const oRes = await pool.query('SELECT id FROM outlets WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1');
    const queue = await getStationQueue(oRes.rows[0]?.id, req.params.station);
    return { tickets: queue };
  });
  fastify.get('/api/inventory', async () => {
    const oRes = await pool.query('SELECT id FROM outlets WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1');
    const inv = await getAllStockOnHand(oRes.rows[0]?.id);
    return { inventory: inv };
  });
  fastify.get('/api/staff', async () => {
    const oRes = await pool.query('SELECT id FROM outlets WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1');
    const staff = await getEmployees(oRes.rows[0]?.id);
    return { staff };
  });
  fastify.get('/api/hotel/rooms', async () => {
    const oRes = await pool.query('SELECT id FROM outlets WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1');
    const rooms = await getRooms(oRes.rows[0]?.id);
    return { rooms };
  });
  fastify.get('/api/alerts', async () => {
    const oRes = await pool.query('SELECT id FROM outlets WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1');
    const alerts = await getAlerts(oRes.rows[0]?.id);
    return { alerts };
  });
  fastify.post('/api/bills/price', async (req: any) => {
    const result = await corePool.execute('price_bill', req.body);
    return { ok: true, result };
  });
  fastify.post('/api/bills/split', async (req: any) => {
    const result = await corePool.execute('split_bill', req.body);
    return { ok: true, result };
  });

  return fastify;
}

export async function startServer() {
  const app = await buildApp();
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`\n🚀 ServeBase API Server listening at http://localhost:${PORT}`);
    console.log(`📚 OpenAPI Documentation available at http://localhost:${PORT}/docs`);
    console.log(`⚡ Connected to PostgreSQL 16 & Native C++ Core Engine\n`);
  } catch (err) {
    console.error('Failed to start ServeBase server:', err);
    process.exit(1);
  }
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  startServer();
}
