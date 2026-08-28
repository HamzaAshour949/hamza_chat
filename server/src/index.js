import { createServer } from 'node:http';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const UPLOAD_DIR = join(ROOT, 'uploads');
const PORT = Number(process.env.PORT || 5101);
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me-32-chars-minimum';
const TOKEN_TTL = '30d';

const MIME_WHITELIST = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'audio/mp4',
  'audio/m4a',
  'audio/aac',
  'audio/mpeg',
  'audio/ogg',
  'audio/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
]);

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'audio/mp4': '.m4a',
  'audio/m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'application/pdf': '.pdf',
};

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(join(DATA_DIR, 'chat.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    from_user TEXT NOT NULL,
    to_user TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    content TEXT,
    media_url TEXT,
    thumbnail TEXT,
    mime_type TEXT,
    file_name TEXT,
    file_size INTEGER,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_pair_time
    ON messages(from_user, to_user, created_at);
`);

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function publicUser(row) {
  return { id: row.id, email: row.email };
}

function seedUser(id, email, password) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return;
  db.prepare(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
  ).run(id, email, hashPassword(password), new Date().toISOString());
}

seedUser('user_test_1', 'test1@test.com', 'password123');
seedUser('user_test_2', 'test2@test.com', 'password123');

function authHeader(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function requireUser(req, res, next) {
  try {
    const token = authHeader(req);
    if (!token) {
      res.status(401).json({ error: 'Missing token' });
      return;
    }
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function mapMessage(row) {
  return {
    id: row.id,
    from: row.from_user,
    to: row.to_user,
    type: row.type,
    content: row.content,
    mediaUrl: row.media_url,
    thumbnail: row.thumbnail,
    mimeType: row.mime_type,
    fileName: row.file_name,
    fileSize: row.file_size,
    createdAt: row.created_at,
  };
}

function insertMessage({ from, to, type, content, mediaUrl, thumbnail, mimeType, fileName, fileSize }) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO messages
      (id, from_user, to_user, type, content, media_url, thumbnail, mime_type, file_name, file_size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    from,
    to,
    type || 'text',
    content ?? null,
    mediaUrl ?? null,
    thumbnail ?? null,
    mimeType ?? null,
    fileName ?? null,
    fileSize ?? null,
    createdAt,
  );
  return mapMessage(db.prepare('SELECT * FROM messages WHERE id = ?').get(id));
}

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use('/media', express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: true }));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = EXT_BY_MIME[file.mimetype] || extname(file.originalname) || '';
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (MIME_WHITELIST.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Unsupported file type'));
  },
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/auth/register', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email.includes('@') || password.length < 6) {
    res.status(400).json({ error: 'Valid email and password (6+ chars) required' });
    return;
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }
  const user = {
    id: randomUUID(),
    email,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
  ).run(user.id, user.email, hashPassword(password), user.created_at);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

app.post('/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  res.json({ token: signToken(row), user: publicUser(row) });
});

app.get('/auth/me', requireUser, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get('/users/search', requireUser, (req, res) => {
  const q = String(req.query.email || '').trim().toLowerCase();
  if (q.length < 2) {
    res.json({ users: [] });
    return;
  }
  const rows = db
    .prepare(
      `SELECT id, email FROM users
       WHERE email LIKE ? AND id != ?
       ORDER BY email LIMIT 20`,
    )
    .all(`%${q}%`, req.user.id);
  res.json({ users: rows.map(publicUser) });
});

app.get('/conversations', requireUser, (req, res) => {
  const uid = req.user.id;
  const rows = db
    .prepare(
      `SELECT m.*,
              CASE WHEN m.from_user = ? THEN m.to_user ELSE m.from_user END AS peer_id
       FROM messages m
       JOIN (
         SELECT
           CASE WHEN from_user = ? THEN to_user ELSE from_user END AS peer_id,
           MAX(created_at) AS last_at
         FROM messages
         WHERE from_user = ? OR to_user = ?
         GROUP BY peer_id
       ) latest
         ON latest.last_at = m.created_at
        AND (CASE WHEN m.from_user = ? THEN m.to_user ELSE m.from_user END) = latest.peer_id
       ORDER BY m.created_at DESC`,
    )
    .all(uid, uid, uid, uid, uid);

  const conversations = rows.map((row) => {
    const peer = db.prepare('SELECT id, email FROM users WHERE id = ?').get(row.peer_id);
    const preview =
      row.type === 'text' ? row.content || '' : row.type;
    return {
      userId: row.peer_id,
      email: peer?.email || 'unknown',
      lastMessage: preview,
      lastMessageType: row.type,
      lastMessageAt: row.created_at,
    };
  });
  res.json({ conversations });
});

app.get('/messages', requireUser, (req, res) => {
  const peerId = String(req.query.userId || '');
  const limit = Math.min(Number(req.query.limit) || 30, 50);
  const before = req.query.before ? String(req.query.before) : null;
  if (!peerId) {
    res.status(400).json({ error: 'userId required' });
    return;
  }

  let beforeCreatedAt = null;
  if (before) {
    const beforeRow = db.prepare('SELECT created_at FROM messages WHERE id = ?').get(before);
    beforeCreatedAt = beforeRow?.created_at ?? null;
  }

  const rows = beforeCreatedAt
    ? db
        .prepare(
          `SELECT * FROM messages
           WHERE ((from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?))
             AND created_at < ?
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(req.user.id, peerId, peerId, req.user.id, beforeCreatedAt, limit)
    : db
        .prepare(
          `SELECT * FROM messages
           WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(req.user.id, peerId, peerId, req.user.id, limit);

  res.json({ messages: rows.map(mapMessage) });
});

app.post('/media/upload', requireUser, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'Upload failed' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'file required' });
      return;
    }
    res.status(201).json({
      url: `/media/${req.file.filename}`,
      filename: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  });
});

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message || 'Server error' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket'],
  pingInterval: 25000,
  pingTimeout: 20000,
});

const socketsByUser = new Map();

function emitToUser(userId, event, payload) {
  const set = socketsByUser.get(userId);
  if (!set) return;
  for (const socket of set) {
    socket.emit(event, payload);
  }
}

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      next(new Error('Missing token'));
      return;
    }
    const payload = jwt.verify(String(token), JWT_SECRET);
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(payload.sub);
    if (!user) {
      next(new Error('Invalid token'));
      return;
    }
    socket.user = user;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user.id;
  if (!socketsByUser.has(userId)) socketsByUser.set(userId, new Set());
  socketsByUser.get(userId).add(socket);
  socket.emit('authenticated', { userId });

  socket.on('send_message', (data = {}) => {
    const to = String(data.to || '');
    const type = String(data.type || 'text');
    if (!to) {
      socket.emit('error_message', { message: 'to required' });
      return;
    }
    const peer = db.prepare('SELECT id FROM users WHERE id = ?').get(to);
    if (!peer) {
      socket.emit('error_message', { message: 'Unknown recipient' });
      return;
    }
    const allowed = new Set(['text', 'image', 'video', 'voice', 'file']);
    if (!allowed.has(type)) {
      socket.emit('error_message', { message: 'Invalid type' });
      return;
    }
    const msg = insertMessage({
      from: userId,
      to,
      type,
      content: data.content ?? null,
      mediaUrl: data.mediaUrl ?? null,
      thumbnail: data.thumbnail ?? null,
      mimeType: data.mimeType ?? null,
      fileName: data.fileName ?? null,
      fileSize: data.fileSize ?? null,
    });
    socket.emit('message_sent', { localId: data.localId, ...msg });
    emitToUser(to, 'new_message', msg);
  });

  socket.on('disconnect', () => {
    const set = socketsByUser.get(userId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) socketsByUser.delete(userId);
  });
});

if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

httpServer.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
  console.log('[server] test accounts: test1@test.com / test2@test.com  password: password123');
});
