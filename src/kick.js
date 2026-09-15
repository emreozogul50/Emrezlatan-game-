import crypto from 'node:crypto';

const ID_BASE = 'https://id.kick.com';
const API_BASE = 'https://api.kick.com';

// ---------------------------------------------------------------------------
// OAuth 2.1 + PKCE
// ---------------------------------------------------------------------------

const b64url = (buf) => buf.toString('base64url');

export function createPkcePair() {
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function buildAuthorizeUrl({ clientId, redirectUri, scopes, state, challenge }) {
  const url = new URL('/oauth/authorize', ID_BASE);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCode({ clientId, clientSecret, redirectUri, code, verifier }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    code,
  });

  const res = await fetch(`${ID_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) throw new Error(`Token alınamadı (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function fetchKickUser(accessToken) {
  const res = await fetch(`${API_BASE}/public/v1/users`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Kullanıcı alınamadı (${res.status})`);
  const data = await res.json();
  return Array.isArray(data?.data) ? data.data[0] : data?.data ?? null;
}

// ---------------------------------------------------------------------------
// Webhook imza doğrulama
// ---------------------------------------------------------------------------

let cachedKey = null;
let cachedKeyAt = 0;
const KEY_TTL = 60 * 60 * 1000;

/** KICK'in webhook imza public key'ini getirir (env varsa onu kullanır). */
export async function getPublicKey() {
  if (process.env.KICK_PUBLIC_KEY) {
    return process.env.KICK_PUBLIC_KEY.replace(/\\n/g, '\n');
  }
  if (cachedKey && Date.now() - cachedKeyAt < KEY_TTL) return cachedKey;

  const res = await fetch(`${API_BASE}/public/v1/public-key`);
  if (!res.ok) throw new Error(`Public key alınamadı (${res.status})`);
  const data = await res.json();
  const key = data?.data?.public_key ?? data?.public_key;
  if (!key) throw new Error('Public key yanıtı beklenen formatta değil.');

  cachedKey = key;
  cachedKeyAt = Date.now();
  return key;
}

const seenMessages = new Map(); // messageId -> ts
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function rememberMessage(id) {
  const cutoff = Date.now() - REPLAY_WINDOW_MS * 2;
  for (const [key, ts] of seenMessages) if (ts < cutoff) seenMessages.delete(key);
  if (seenMessages.has(id)) return false;
  seenMessages.set(id, Date.now());
  return true;
}

/**
 * KICK webhook isteğini doğrular.
 * İmza: base64( RSA-SHA256( `${messageId}.${timestamp}.${rawBody}` ) )
 * @param {object} headers Express req.headers
 * @param {Buffer} rawBody Ham gövde (JSON.parse edilmemiş olmalı)
 */
export async function verifyWebhook(headers, rawBody) {
  const messageId = headers['kick-event-message-id'];
  const timestamp = headers['kick-event-message-timestamp'];
  const signature = headers['kick-event-signature'];

  if (!messageId || !timestamp || !signature) {
    return { ok: false, error: 'İmza başlıkları eksik.' };
  }

  const age = Math.abs(Date.now() - Date.parse(timestamp));
  if (!Number.isFinite(age) || age > REPLAY_WINDOW_MS) {
    return { ok: false, error: 'Zaman damgası geçersiz veya çok eski.' };
  }

  if (!rememberMessage(messageId)) {
    return { ok: false, error: 'Bu mesaj zaten işlendi.', duplicate: true };
  }

  let publicKey;
  try {
    publicKey = await getPublicKey();
  } catch (err) {
    return { ok: false, error: `Public key hatası: ${err.message}` };
  }

  const payload = Buffer.concat([
    Buffer.from(`${messageId}.${timestamp}.`, 'utf8'),
    rawBody,
  ]);

  let valid = false;
  try {
    valid = crypto.verify(
      'sha256',
      payload,
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(signature, 'base64')
    );
  } catch (err) {
    return { ok: false, error: `Doğrulama hatası: ${err.message}` };
  }

  if (!valid) return { ok: false, error: 'İmza eşleşmedi.' };

  return { ok: true, eventType: headers['kick-event-type'], messageId };
}

/** chat.message.sent olayından oyuna uygun sade bir mesaj çıkarır. */
export function parseChatEvent(body) {
  const username =
    body?.sender?.username ??
    body?.sender?.slug ??
    body?.data?.sender?.username ??
    'izleyici';
  const text = body?.content ?? body?.data?.content ?? '';
  if (!text) return null;
  return { username, text };
}
