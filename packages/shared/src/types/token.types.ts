/**
 * JWT token types
 */

/**
 * Video grants for access token
 */
export interface VideoGrants {
  room?: string;
  roomJoin?: boolean;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  hidden?: boolean;
  recorder?: boolean;
}

/**
 * Access token claims
 */
export interface AccessTokenClaims {
  // Identity
  identity: string;
  name?: string;
  metadata?: Record<string, unknown>;

  // Grants
  video?: VideoGrants;

  // JWT standard claims
  iat?: number;
  nbf?: number;
  exp?: number;
  iss?: string;
  sub?: string;
  jti?: string;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  claims?: AccessTokenClaims;
  error?: string;
}