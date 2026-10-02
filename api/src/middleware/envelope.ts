import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError, ZodSchema } from 'zod';

export function errorHandler(error: FastifyError, req: FastifyRequest, reply: FastifyReply) {
  const timestamp = new Date().toISOString();

  if (error instanceof ZodError) {
    return reply.status(400).send({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload failed schema validation',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
        timestamp,
      },
    });
  }

  const statusCode = error.statusCode || 500;
  let code = 'INTERNAL_SERVER_ERROR';

  if (statusCode === 400) code = 'BAD_REQUEST';
  else if (statusCode === 401) code = 'UNAUTHORIZED';
  else if (statusCode === 403) code = 'FORBIDDEN';
  else if (statusCode === 404) code = 'NOT_FOUND';
  else if (statusCode === 429) code = 'TOO_MANY_REQUESTS';
  else if (statusCode === 503) code = 'SERVICE_UNAVAILABLE';

  reply.status(statusCode).send({
    ok: false,
    error: {
      code,
      message: error.message || 'An unexpected internal error occurred',
      timestamp,
    },
  });
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      req.body = schema.parse(req.body);
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body failed validation',
            details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
            timestamp: new Date().toISOString(),
          },
        });
      }
      throw err;
    }
  };
}
