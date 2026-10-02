import Fastify from 'fastify';
import cors from '@fastify/cors';
import { pool } from './db';
import { corePool } from './services/core-pool';
import { getFloorLayout } from './services/floor';
import { getMenu } from './services/menu';
import { getStationQueue } from './services/kds';
import { getInventoryStock } from './services/inventory';
import { getStaffRoster } from './services/staff';
import { getRoomInventory } from './services/hotel';
import { getSystemAlerts } from './services/alerts';
import { verifyAuditChain } from './services/audit';

const fastify = Fastify({
  logger: false,
});

async function startServer() {
  await fastify.register(cors, {
    origin: true,
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

  // Audit verification
  fastify.get('/api/audit/verify', async () => {
    return await verifyAuditChain();
  });

  // Floor & Tables
  fastify.get('/api/tables', async (req, reply) => {
    try {
      const outletsRes = await pool.query('SELECT id FROM outlets LIMIT 1');
      const outletId = outletsRes.rows[0]?.id;
      if (!outletId) return reply.send({ tables: [] });
      const layout = await getFloorLayout(outletId);
      return reply.send({ tables: layout });
    } catch (err: any) {
      reply.status(500).send({ error: err.message });
    }
  });

  // Menu Catalog
  fastify.get('/api/menu', async (req, reply) => {
    try {
      const outletsRes = await pool.query('SELECT id FROM outlets LIMIT 1');
      const outletId = outletsRes.rows[0]?.id;
      if (!outletId) return reply.send({ menu: [] });
      const menu = await getMenu(outletId);
      return reply.send({ menu });
    } catch (err: any) {
      reply.status(500).send({ error: err.message });
    }
  });

  // KDS Station Queue
  fastify.get('/api/kds/:station', async (req: any, reply) => {
    try {
      const outletsRes = await pool.query('SELECT id FROM outlets LIMIT 1');
      const outletId = outletsRes.rows[0]?.id;
      const { station } = req.params;
      const queue = await getStationQueue(outletId, station);
      return reply.send({ tickets: queue });
    } catch (err: any) {
      reply.status(500).send({ error: err.message });
    }
  });

  // Inventory Stock Ledger
  fastify.get('/api/inventory', async (req, reply) => {
    try {
      const outletsRes = await pool.query('SELECT id FROM outlets LIMIT 1');
      const outletId = outletsRes.rows[0]?.id;
      const stock = await getInventoryStock(outletId);
      return reply.send({ inventory: stock });
    } catch (err: any) {
      reply.status(500).send({ error: err.message });
    }
  });

  // Staff Roster
  fastify.get('/api/staff', async (req, reply) => {
    try {
      const outletsRes = await pool.query('SELECT id FROM outlets LIMIT 1');
      const outletId = outletsRes.rows[0]?.id;
      const staff = await getStaffRoster(outletId);
      return reply.send({ staff });
    } catch (err: any) {
      reply.status(500).send({ error: err.message });
    }
  });

  // Hotel Room Inventory
  fastify.get('/api/hotel/rooms', async (req, reply) => {
    try {
      const outletsRes = await pool.query('SELECT id FROM outlets LIMIT 1');
      const outletId = outletsRes.rows[0]?.id;
      const rooms = await getRoomInventory(outletId);
      return reply.send({ rooms });
    } catch (err: any) {
      reply.status(500).send({ error: err.message });
    }
  });

  // System Alerts
  fastify.get('/api/alerts', async (req, reply) => {
    try {
      const outletsRes = await pool.query('SELECT id FROM outlets LIMIT 1');
      const outletId = outletsRes.rows[0]?.id;
      const alerts = await getSystemAlerts(outletId);
      return reply.send({ alerts });
    } catch (err: any) {
      reply.status(500).send({ error: err.message });
    }
  });

  // Native C++ Pricing Route
  fastify.post('/api/bills/price', async (req: any, reply) => {
    try {
      const result = await corePool.execute('price_bill', req.body);
      return reply.send({ ok: true, result });
    } catch (err: any) {
      reply.status(500).send({ ok: false, error: err.message });
    }
  });

  // Native C++ Hamilton Split Bill Route
  fastify.post('/api/bills/split', async (req: any, reply) => {
    try {
      const result = await corePool.execute('split_bill', req.body);
      return reply.send({ ok: true, result });
    } catch (err: any) {
      reply.status(500).send({ ok: false, error: err.message });
    }
  });

  const PORT = parseInt(process.env.PORT || '3000', 10);
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`ServeBase API running on http://localhost:${PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

startServer();
