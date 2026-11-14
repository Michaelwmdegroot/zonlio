import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const HASH_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
export const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex');
const sign = (secret, value) => createHmac('sha256', secret).update(value).digest('base64url');
function equal(a, b) {
  return timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest());
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024) {
    throw new Error('Gebruik een wachtwoord van 12 tot 1024 tekens.');
  }
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64, HASH_OPTIONS);
  return `scrypt$${HASH_OPTIONS.N}$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function validPasswordHash(encoded) {
  if (typeof encoded !== 'string') return false;
  const fields = encoded.split('$');
  return fields.length === 6 && fields[0] === 'scrypt' && ['16384', '32768', '65536'].includes(fields[1])
    && fields[2] === '8' && fields[3] === '1'
    && /^[A-Za-z0-9_-]{22}$/.test(fields[4]) && /^[A-Za-z0-9_-]{86}$/.test(fields[5]);
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 1024 || !validPasswordHash(encoded)) return false;
  const [, n, r, p, salt, expected] = encoded.split('$');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64url'), 64, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * 1024 * 1024,
  });
  return timingSafeEqual(actual, Buffer.from(expected, 'base64url'));
}

/** Bounded, memory-only counters. Keys contain hashes, never stored IP addresses. */
export function createRateLimiter({ now = () => Date.now(), maximumKeys = 5000 } = {}) {
  const entries = new Map();
  return {
    take(key, limit, windowMs) {
      const at = Number(now());
      let entry = entries.get(key);
      if (!entry || entry.until <= at) {
        if (entries.size >= maximumKeys) {
          for (const [oldKey, value] of entries) if (value.until <= at) entries.delete(oldKey);
          if (entries.size >= maximumKeys) return false;
        }
        entry = { total: 0, until: at + windowMs };
        entries.set(key, entry);
      }
      entry.total += 1;
      return entry.total <= limit;
    },
    clear() { entries.clear(); },
  };
}

export function createAuth({ env = process.env, store, now = () => Date.now() } = {}) {
  const production = env.NODE_ENV === 'production';
  const suppliedSecret = typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 32;
  // Ephemeral development tokens are allowed; production needs an explicit secret.
  const secret = suppliedSecret ? env.SESSION_SECRET : randomBytes(32).toString('hex');
  const configured = Boolean(store && suppliedSecret && validPasswordHash(env.ADMIN_PASSWORD_HASH));
  const email = (env.ADMIN_EMAIL || 'info@zonlio.nl').trim().toLowerCase();
  const cookieName = production ? '__Host-zonlio_admin' : 'zonlio_admin';
  const sessionMs = 8 * 3600000;
  const allowedOrigins = new Set();
  for (const value of [env.PUBLIC_URL || env.APP_URL || 'https://zonlio.nl', ...(env.ALLOWED_ORIGINS || '').split(',')]) {
    if (!value.trim()) continue;
    try { allowedOrigins.add(new URL(value.trim()).origin); } catch { /* invalid configuration grants no access */ }
  }
  const limiter = createRateLimiter({ now });
  const cookie = (value, maxAge) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production ? '; Secure' : ''}`;

  function readCookie(request) {
    const item = (request.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
    if (!item) return null;
    const value = item.slice(cookieName.length + 1);
    const [token, signature, extra] = value.split('.');
    if (extra || !/^[A-Za-z0-9_-]{43}$/.test(token || '') || !equal(signature, sign(secret, `session:${token}`))) return null;
    return token;
  }

  return {
    configured, email, secretConfigured: suppliedSecret, production, limiter,
    fingerprint: (purpose, value) => sign(secret, `${purpose}:${value}`),
    requestKey: (request) => sign(secret, `rate:${request.ip || request.socket?.remoteAddress || 'unknown'}`),
    originAllowed(request) {
      const origin = request.headers.origin;
      if (!origin || origin === 'null') return false;
      let parsed;
      try { parsed = new URL(origin); } catch { return false; }
      if (parsed.origin !== origin) return false;
      if (allowedOrigins.has(origin)) return true;
      // Local preview domains vary. This fallback is explicitly development-only.
      return !production && parsed.host === request.headers.host && ['http:', 'https:'].includes(parsed.protocol);
    },
    issueFormToken() {
      const issuedAt = Number(now());
      const body = Buffer.from(JSON.stringify({ at: issuedAt, nonce: randomBytes(16).toString('base64url') })).toString('base64url');
      return { token: `${body}.${sign(secret, `form:${body}`)}`, issuedAt };
    },
    verifyFormToken(token) {
      if (typeof token !== 'string' || token.length > 500) return false;
      const [body, signature, extra] = token.split('.');
      if (!body || !signature || extra || !equal(signature, sign(secret, `form:${body}`))) return false;
      try {
        const value = JSON.parse(Buffer.from(body, 'base64url').toString());
        const age = Number(now()) - value.at;
        return Number.isFinite(value.at) && age >= 0 && age <= 2 * 3600000;
      } catch { return false; }
    },
    async session(request) {
      if (!configured) return null;
      const token = readCookie(request);
      if (!token) return null;
      const saved = await store.getSession(sha256(token));
      if (!saved || saved.email !== email) return null;
      return { email: saved.email, idHash: sha256(token), csrfToken: sign(secret, `csrf:${token}`) };
    },
    async login(request, suppliedEmail, password) {
      if (!configured) return { error: 'Beheer is nog niet geconfigureerd.', status: 503 };
      if (!limiter.take(`login:${this.requestKey(request)}`, 8, 15 * 60000)) return { error: 'Te veel pogingen. Probeer het later opnieuw.', status: 429 };
      const correctPassword = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
      if (!correctPassword || typeof suppliedEmail !== 'string' || !equal(suppliedEmail.trim().toLowerCase(), email)) {
        return { error: 'E-mailadres of wachtwoord is onjuist.', status: 401 };
      }
      const token = randomBytes(32).toString('base64url');
      await store.createSession(sha256(token), email, new Date(Number(now()) + sessionMs).toISOString());
      return { cookie: cookie(`${token}.${sign(secret, `session:${token}`)}`, sessionMs / 1000),
        session: { authenticated: true, email, csrfToken: sign(secret, `csrf:${token}`) } };
    },
    csrfAllowed(request, session) {
      return this.originAllowed(request) && typeof request.headers['x-csrf-token'] === 'string'
        && equal(request.headers['x-csrf-token'], session.csrfToken);
    },
    async logout(session) {
      if (session) await store.revokeSession(session.idHash);
      return cookie('', 0);
    },
    cronAllowed(request) {
      return typeof env.CRON_SECRET === 'string' && env.CRON_SECRET.length >= 32
        && equal(request.headers.authorization || '', `Bearer ${env.CRON_SECRET}`);
    },
  };
}
