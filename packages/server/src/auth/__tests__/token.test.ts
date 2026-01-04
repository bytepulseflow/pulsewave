/**
 * Tests for AccessToken module
 */

import { AccessToken, validateToken, decodeToken } from '../index';

describe('AccessToken', () => {
  const apiKey = 'test-api-key';
  const apiSecret = 'test-api-secret';

  describe('constructor', () => {
    it('should create a valid access token instance', () => {
      const token = new AccessToken(apiKey, apiSecret, 'test-user');

      expect(token).toBeDefined();
      expect(token.getClaims().identity).toBe('test-user');
    });
  });

  describe('setName', () => {
    it('should set the name', () => {
      const token = new AccessToken(apiKey, apiSecret, 'test-user');
      token.setName('Test User');

      expect(token.getClaims().name).toBe('Test User');
    });
  });

  describe('setMetadata', () => {
    it('should set metadata', () => {
      const token = new AccessToken(apiKey, apiSecret, 'test-user');
      const metadata = { role: 'admin' };
      token.setMetadata(metadata);

      expect(token.getClaims().metadata).toEqual(metadata);
    });
  });

  describe('addGrant', () => {
    it('should add video grant', () => {
      const token = new AccessToken(apiKey, apiSecret, 'test-user');
      token.addGrant({ roomJoin: true, room: 'test-room' });

      expect(token.getClaims().video.roomJoin).toBe(true);
      expect(token.getClaims().video.room).toBe('test-room');
    });
  });

  describe('setValidity', () => {
    it('should set token validity period', () => {
      const token = new AccessToken(apiKey, apiSecret, 'test-user');
      token.setValidity(3600);

      const claims = token.getClaims();
      expect(claims.nbf).toBeDefined();
      expect(claims.exp).toBeDefined();
      expect(claims.exp).toBeGreaterThan(claims.nbf);
    });
  });

  describe('toJwt', () => {
    it('should generate a JWT token', () => {
      const token = new AccessToken(apiKey, apiSecret, 'test-user');
      token.setName('Test User');
      token.addGrant({ roomJoin: true, room: 'test-room' });
      token.setValidity(3600);

      const jwt = token.toJwt();

      expect(jwt).toBeDefined();
      expect(typeof jwt).toBe('string');
      expect(jwt.split('.').length).toBe(3); // JWT has 3 parts
    });
  });
});

describe('validateToken', () => {
  const apiKey = 'test-api-key';
  const apiSecret = 'test-api-secret';

  it('should validate a valid token', () => {
    const token = new AccessToken(apiKey, apiSecret, 'test-user');
    token.setName('Test User');
    token.addGrant({ roomJoin: true, room: 'test-room' });
    token.setValidity(3600);

    const jwt = token.toJwt();
    const result = validateToken(jwt, apiSecret, apiKey);

    expect(result.valid).toBe(true);
    expect(result.claims).toBeDefined();
    expect(result.claims.identity).toBe('test-user');
    expect(result.claims.name).toBe('Test User');
  });

  it('should validate token without apiKey', () => {
    const token = new AccessToken(apiKey, apiSecret, 'test-user');
    token.setValidity(3600);

    const jwt = token.toJwt();
    const result = validateToken(jwt, apiSecret);

    expect(result.valid).toBe(true);
  });

  it('should reject invalid token', () => {
    const result = validateToken('invalid-token', apiSecret, apiKey);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('decodeToken', () => {
  const apiKey = 'test-api-key';
  const apiSecret = 'test-api-secret';

  it('should decode a valid token', () => {
    const token = new AccessToken(apiKey, apiSecret, 'test-user');
    token.setName('Test User');
    token.setValidity(3600);

    const jwt = token.toJwt();
    const decoded = decodeToken(jwt);

    expect(decoded).toBeDefined();
    expect(decoded.identity).toBe('test-user');
    expect(decoded.name).toBe('Test User');
  });

  it('should return null for invalid token', () => {
    const decoded = decodeToken('invalid-token');

    expect(decoded).toBeNull();
  });
});
