import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, TokenPayload } from '../services/auth.js';
import { query } from '../db/pool.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
    outletId?: string;
  }
}

export async function authenticateToken(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token missing or invalid',
        timestamp: new Date().toISOString(),
      },
    });
  }

  const token = authHeader.substring(7);
  try {
    const payload = verifyToken(token);
    req.user = payload;

    // Resolve outlet context
    const requestedOutletId = req.headers['x-outlet-id'] as string;
    if (requestedOutletId) {
      // Verify user has permission for this outlet
      const hasOutletAccess = payload.roles.some((r) => r.outletId === requestedOutletId || r.roleName === 'Owner');
      if (!hasOutletAccess) {
        return reply.status(403).send({
          ok: false,
          error: {
            code: 'FORBIDDEN',
            message: `User does not have authorization for outlet: ${requestedOutletId}`,
            timestamp: new Date().toISOString(),
          },
        });
      }
      req.outletId = requestedOutletId;
    } else {
      // Default to first outlet role or query primary outlet from database
      if (payload.roles && payload.roles.length > 0 && payload.roles[0].outletId) {
        req.outletId = payload.roles[0].outletId;
      } else {
        const outletRes = await query('SELECT id FROM outlets WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1');
        req.outletId = outletRes.rows[0]?.id;
      }
    }
  } catch (err: any) {
    return reply.status(401).send({
      ok: false,
      error: {
        code: 'TOKEN_EXPIRED_OR_INVALID',
        message: err.message || 'Token is invalid or expired',
        timestamp: new Date().toISOString(),
      },
    });
  }
}

export function requirePermission(permission: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      return reply.status(401).send({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', timestamp: new Date().toISOString() },
      });
    }

    const currentOutletId = req.outletId;
    const matchingRoles = req.user.roles.filter(
      (r) => !currentOutletId || r.outletId === currentOutletId || r.roleName === 'Owner'
    );

    const isAuthorized = matchingRoles.some((r) => {
      if (r.roleName === 'Owner') return true;
      let perms: string[] = [];
      if (Array.isArray(r.permissions)) {
        perms = r.permissions;
      } else if (typeof r.permissions === 'string') {
        try {
          const parsed = JSON.parse(r.permissions);
          if (Array.isArray(parsed)) perms = parsed;
        } catch {
          perms = [r.permissions];
        }
      }
      return perms.includes(permission) || perms.includes('*');
    });

    if (!isAuthorized) {
      return reply.status(403).send({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: `Missing required permission: ${permission}`,
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
}
