/**
 * AccessToken - JWT token generation and validation
 */

import jwt from 'jsonwebtoken';
import type { AccessTokenClaims, VideoGrants, TokenValidationResult } from '@bytepulse/pulsewave-shared';

/**
 * AccessToken class
 */
export class AccessToken {
  private claims: AccessTokenClaims;
  private apiKey: string;
  private apiSecret: string;

  constructor(apiKey: string, apiSecret: string, identity: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.claims = {
      identity,
      video: {},
    };
  }

  /**
   * Set name
   */
  public setName(name: string): void {
    this.claims.name = name;
  }

  /**
   * Set metadata
   */
  public setMetadata(metadata: Record<string, unknown>): void {
    this.claims.metadata = metadata;
  }

  /**
   * Add video grant
   */
  public addGrant(grant: VideoGrants): void {
    this.claims.video = {
      ...this.claims.video,
      ...grant,
    };
  }

  /**
   * Set token validity period
   */
  public setValidity(seconds: number): void {
    this.claims.nbf = Math.floor(Date.now() / 1000);
    this.claims.exp = this.claims.nbf + seconds;
  }

  /**
   * Get claims
   */
  public getClaims(): AccessTokenClaims {
    return { ...this.claims };
  }

  /**
   * Convert to JWT
   */
  public toJwt(): string {
    const payload = {
      ...this.claims,
      iss: this.apiKey,
      sub: this.claims.identity,
      jti: this.generateJti(),
    };

    return jwt.sign(payload, this.apiSecret, {
      algorithm: 'HS256',
    });
  }

  /**
   * Generate JWT ID
   */
  private generateJti(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }
}

/**
 * Validate a JWT token
 */
export function validateToken(
  token: string,
  apiSecret: string,
  apiKey?: string
): TokenValidationResult {
  try {
    const decoded = jwt.verify(token, apiSecret, {
      algorithms: ['HS256'],
      issuer: apiKey,
    }) as AccessTokenClaims;

    return {
      valid: true,
      claims: decoded,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid token',
    };
  }
}

/**
 * Decode a JWT token without verification
 */
export function decodeToken(token: string): AccessTokenClaims | null {
  try {
    const decoded = jwt.decode(token) as AccessTokenClaims;
    return decoded;
  } catch {
    return null;
  }
}