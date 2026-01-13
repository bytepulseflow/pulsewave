/**
 * API routes for token generation
 */

import express, { Router, Request, Response } from 'express';
import { AccessToken } from '../../auth';
import type { JwtConfig } from '../../config';

const router: Router = express.Router();

interface TokenRequestBody {
  identity: string;
  name?: string;
  room?: string;
  metadata?: Record<string, unknown>;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
}

interface TokenResponse {
  token: string;
}

interface HealthResponse {
  status: string;
  timestamp: number;
}

interface ErrorResponse {
  error: string;
}

/**
 * POST /api/token - Generate access token
 */
router.post(
  '/token',
  (
    req: Request<unknown, TokenResponse | ErrorResponse, TokenRequestBody>,
    res: Response<TokenResponse | ErrorResponse>
  ) => {
    try {
      const { identity, name, room, metadata, canPublish, canSubscribe, canPublishData } = req.body;

      if (!identity) {
        return res.status(400).json({ error: 'identity is required' });
      }

      const jwtConfig = req.app.get('jwtConfig') as JwtConfig;
      const token = new AccessToken(jwtConfig.apiKey, jwtConfig.apiSecret, identity);

      if (name) token.setName(name);
      if (metadata) token.setMetadata(metadata);

      token.addGrant({
        room,
        roomJoin: true,
        canPublish: canPublish ?? true,
        canSubscribe: canSubscribe ?? true,
        canPublishData: canPublishData ?? true,
      });

      token.setValidity(24 * 60 * 60); // 24 hours

      const jwt = token.toJwt();

      return res.json({ token: jwt });
    } catch (error) {
      console.error('Error generating token:', error);
      return res.status(500).json({ error: 'Failed to generate token' });
    }
  }
);

/**
 * GET /api/health - Health check
 */
router.get('/health', (_req: Request<unknown, HealthResponse>, res: Response<HealthResponse>) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

export default router;
