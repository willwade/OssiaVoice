import http from 'node:http';
import crypto from 'node:crypto';
import express from 'express';
import { WebSocketServer } from 'ws';
import { z } from 'zod';

const PORT = Number(process.env.PORT || 8787);
const app = express();
app.use(express.json());

const owners = new Map(); // ownerId -> { secret }
const enrollments = new Map(); // enrollToken -> { participantId, ownerId, displayName, expiresAt }
const devices = new Map(); // deviceId -> { participantId, ownerId, secret, displayName }
const sessions = new Map(); // sessionId -> Set of ws clients

function rateLimiter({ capacity, refillPerSec }) {
  return { capacity, refillPerSec, tokens: capacity, last: Date.now() };
}

function takeToken(bucket) {
  const now = Date.now();
  const elapsed = (now - bucket.last) / 1000;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.refillPerSec);
  bucket.last = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

const httpLimiters = new Map();
function httpRateLimit(key, capacity, refillPerSec) {
  if (!httpLimiters.has(key)) {
    httpLimiters.set(key, rateLimiter({ capacity, refillPerSec }));
  }
  return takeToken(httpLimiters.get(key));
}

const EnrollBody = z.object({
  enrollToken: z.string().min(10)
});

const DeviceAuth = z.object({
  ownerId: z.string(),
  ownerSecret: z.string(),
  deviceId: z.string()
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.post('/owner-register', (req, res) => {
  const key = `owner-register:${req.ip}`;
  if (!httpRateLimit(key, 5, 0.05)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const ownerId = crypto.randomUUID();
  const ownerSecret = crypto.randomBytes(24).toString('hex');
  owners.set(ownerId, { secret: ownerSecret });
  res.json({ ownerId, ownerSecret });
});

app.post('/enroll', (req, res) => {
  const key = `enroll:${req.ip}`;
  if (!httpRateLimit(key, 10, 0.2)) {
    return res.status(429).json({ error: 'rate_limited' });
  }
  const parsed = EnrollBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_request' });

  const record = enrollments.get(parsed.data.enrollToken);
  if (!record || record.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'invalid_or_expired' });
  }

  const deviceId = crypto.randomUUID();
  const deviceSecret = crypto.randomBytes(24).toString('hex');

  devices.set(deviceId, {
    participantId: record.participantId,
    ownerId: record.ownerId,
    displayName: record.displayName,
    secret: deviceSecret
  });

  enrollments.delete(parsed.data.enrollToken);

  res.json({
    deviceId,
    deviceSecret,
    participantId: record.participantId,
    ownerId: record.ownerId,
    displayName: record.displayName
  });
});

app.post('/enroll-issue', (req, res) => {
  const key = `enroll-issue:${req.ip}`;
  if (!httpRateLimit(key, 10, 0.2)) {
    return res.status(429).json({ error: 'rate_limited' });
  }
  const { participantId, ownerId, ownerSecret, displayName } = req.body || {};
  if (!participantId || !ownerId) return res.status(400).json({ error: 'missing_fields' });

  const owner = owners.get(ownerId);
  if (!owner || owner.secret !== ownerSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const enrollToken = crypto.randomBytes(16).toString('hex');
  enrollments.set(enrollToken, {
    participantId,
    ownerId,
    displayName,
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  res.json({ enrollToken, expiresIn: 600 });
});

app.post('/device-revoke', (req, res) => {
  const key = `device-revoke:${req.ip}`;
  if (!httpRateLimit(key, 10, 0.2)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const parsed = DeviceAuth.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_request' });

  const owner = owners.get(parsed.data.ownerId);
  if (!owner || owner.secret !== parsed.data.ownerSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const device = devices.get(parsed.data.deviceId);
  if (!device || device.ownerId !== parsed.data.ownerId) {
    return res.status(404).json({ error: 'device_not_found' });
  }

  devices.delete(parsed.data.deviceId);
  res.json({ revoked: true });
});

app.post('/device-rotate', (req, res) => {
  const key = `device-rotate:${req.ip}`;
  if (!httpRateLimit(key, 10, 0.2)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const parsed = DeviceAuth.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_request' });

  const owner = owners.get(parsed.data.ownerId);
  if (!owner || owner.secret !== parsed.data.ownerSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const device = devices.get(parsed.data.deviceId);
  if (!device || device.ownerId !== parsed.data.ownerId) {
    return res.status(404).json({ error: 'device_not_found' });
  }

  const deviceSecret = crypto.randomBytes(24).toString('hex');
  devices.set(parsed.data.deviceId, { ...device, secret: deviceSecret });
  res.json({ deviceId: parsed.data.deviceId, deviceSecret });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const JoinMessage = z.object({
  type: z.literal('join'),
  sessionId: z.string(),
  participantId: z.string(),
  deviceId: z.string(),
  deviceSecret: z.string()
});

const JoinListener = z.object({
  type: z.literal('join_listener'),
  sessionId: z.string(),
  ownerId: z.string(),
  ownerSecret: z.string()
});

function broadcast(sessionId, payload, except) {
  const peers = sessions.get(sessionId);
  if (!peers) return;
  for (const client of peers) {
    if (client !== except && client.readyState === 1) client.send(payload);
  }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.rate = rateLimiter({ capacity: 40, refillPerSec: 20 });
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', error: 'invalid_json' }));
      return;
    }

    if (message?.type === 'join') {
      const parsed = JoinMessage.safeParse(message);
      if (!parsed.success) {
        ws.send(JSON.stringify({ type: 'error', error: 'invalid_join' }));
        return;
      }
      const device = devices.get(parsed.data.deviceId);
      if (!device || device.secret !== parsed.data.deviceSecret) {
        ws.send(JSON.stringify({ type: 'error', error: 'unauthorized' }));
        return;
      }
      ws.sessionId = parsed.data.sessionId;
      ws.participantId = parsed.data.participantId;
      ws.role = 'device';

      if (!sessions.has(ws.sessionId)) sessions.set(ws.sessionId, new Set());
      sessions.get(ws.sessionId).add(ws);
      ws.send(JSON.stringify({ type: 'joined', sessionId: ws.sessionId }));
      return;
    }

    if (message?.type === 'join_listener') {
      const parsed = JoinListener.safeParse(message);
      if (!parsed.success) {
        ws.send(JSON.stringify({ type: 'error', error: 'invalid_join' }));
        return;
      }
      const owner = owners.get(parsed.data.ownerId);
      if (!owner || owner.secret !== parsed.data.ownerSecret) {
        ws.send(JSON.stringify({ type: 'error', error: 'unauthorized' }));
        return;
      }

      ws.sessionId = parsed.data.sessionId;
      ws.role = 'listener';
      if (!sessions.has(ws.sessionId)) sessions.set(ws.sessionId, new Set());
      sessions.get(ws.sessionId).add(ws);
      ws.send(JSON.stringify({ type: 'joined', sessionId: ws.sessionId }));
      return;
    }

    if (!ws.sessionId) {
      ws.send(JSON.stringify({ type: 'error', error: 'not_joined' }));
      return;
    }

    if (ws.role === 'device') {
      if (!takeToken(ws.rate)) {
        ws.send(JSON.stringify({ type: 'error', error: 'rate_limited' }));
        return;
      }
      broadcast(ws.sessionId, JSON.stringify(message), ws);
    }
  });

  ws.on('close', () => {
    if (!ws.sessionId) return;
    const peers = sessions.get(ws.sessionId);
    if (!peers) return;
    peers.delete(ws);
    if (peers.size === 0) sessions.delete(ws.sessionId);
  });
});

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, () => {
  console.log(`WS relay listening on :${PORT}`);
});
