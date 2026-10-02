import { FastifyInstance } from 'fastify';
import {
  getRooms,
  checkInGuest,
  postChargeToRoom,
  settleAndCheckOut,
  runNightAudit,
} from '../services/hotel.js';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

export async function hotelRoutes(fastify: FastifyInstance) {
  // Get all rooms and occupancy
  fastify.get('/rooms', { preHandler: [authenticateToken] }, async (req, reply) => {
    const rooms = await getRooms(req.outletId!);
    return reply.send({ ok: true, data: rooms });
  });

  // Guest Check-in
  fastify.post('/checkin', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { guest_id, room_id, credit_limit_paise } = req.body;
    const folio = await checkInGuest(
      req.outletId!,
      room_id,
      guest_id,
      credit_limit_paise || 5000000
    );
    return reply.send({ ok: true, data: folio });
  });

  // Guest Check-out and settlement
  fastify.post('/checkout', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { folio_id, payment_method } = req.body;
    const result = await settleAndCheckOut(folio_id, payment_method || 'card', req.user!.userId);
    return reply.send({ ok: true, data: result });
  });

  // Get active folio details
  fastify.get('/folios/:id', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const folioRes = await query('SELECT * FROM hotel_folios WHERE id = $1', [req.params.id]);
    const linesRes = await query('SELECT * FROM folio_lines WHERE folio_id = $1 ORDER BY created_at ASC', [
      req.params.id,
    ]);
    return reply.send({
      ok: true,
      data: {
        folio: folioRes.rows[0],
        lines: linesRes.rows,
      },
    });
  });

  // Post restaurant POS charge to room folio
  const handleRoomCharge = async (req: any, reply: any) => {
    const { room_number, amount_paise, description, charge_type, reference_invoice_id } = req.body;
    const line = await postChargeToRoom(
      req.outletId!,
      room_number,
      amount_paise,
      description || 'Restaurant POS Charge',
      charge_type || 'restaurant_charge',
      reference_invoice_id
    );
    return reply.send({ ok: true, data: line });
  };

  fastify.post('/charge', { preHandler: [authenticateToken] }, handleRoomCharge);
  fastify.post('/post-charge', { preHandler: [authenticateToken] }, handleRoomCharge);

  // Reversal of accidental POS room charge (Mandatory POS void reversal)
  fastify.post('/void-reversal', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const { folio_line_id, reason } = req.body;
    const lineRes = await query('SELECT * FROM folio_lines WHERE id = $1', [folio_line_id]);
    if (lineRes.rows.length === 0) {
      return reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Folio line not found' } });
    }
    const orig = lineRes.rows[0];

    // Post offsetting credit line
    const reversal = await query(
      `INSERT INTO folio_lines (folio_id, outlet_id, amount_paise, description, reference_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        orig.folio_id,
        orig.outlet_id,
        -Number(orig.amount_paise),
        `VOID REVERSAL: ${reason || 'Accidental charge'}`,
        orig.id,
      ]
    );

    // Update folio total
    await query(
      `UPDATE hotel_folios
       SET total_posted_paise = total_posted_paise - $1
       WHERE id = $2`,
      [Number(orig.amount_paise), orig.folio_id]
    );

    return reply.send({ ok: true, data: reversal.rows[0] });
  });

  // Night Audit wizard (posts room tariffs & taxes, computes ADR and RevPAR, advances business date)
  fastify.post('/night-audit', { preHandler: [authenticateToken] }, async (req: any, reply) => {
    const businessDate = req.body.business_date || new Date().toISOString().split('T')[0];
    const audit = await runNightAudit(req.outletId!, businessDate, req.user!.userId);
    return reply.send({ ok: true, data: audit });
  });
}
