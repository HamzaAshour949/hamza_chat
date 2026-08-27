import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function initDB(): Promise<void> {
  db = await SQLite.openDatabaseAsync('chatapp.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      server_id INTEGER,
      from_user INTEGER NOT NULL,
      to_user INTEGER NOT NULL,
      type TEXT DEFAULT 'text',
      content TEXT,
      media_url TEXT,
      thumbnail TEXT,
      mime_type TEXT,
      file_name TEXT,
      file_size INTEGER,
      created_at TEXT NOT NULL,
      status TEXT DEFAULT 'sent'
    );
    CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(from_user, to_user, created_at);
  `);
}

export async function saveMessage(msg: {
  id: string;
  serverId?: number | null;
  from: number;
  to: number;
  type: string;
  content: string | null;
  mediaUrl: string | null;
  thumbnail: string | null;
  mimeType: string | null;
  fileName: string | null;
  fileSize: number | null;
  createdAt: string;
  status: string;
}): Promise<void> {
  if (!db) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO messages (id, server_id, from_user, to_user, type, content, media_url, thumbnail, mime_type, file_name, file_size, created_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msg.id,
      msg.serverId ?? null,
      msg.from,
      msg.to,
      msg.type,
      msg.content,
      msg.mediaUrl,
      msg.thumbnail,
      msg.mimeType,
      msg.fileName,
      msg.fileSize,
      msg.createdAt,
      msg.status,
    ]
  );
}

export async function getMessages(
  userId1: number,
  userId2: number,
  limit: number = 30,
  beforeId?: string
): Promise<any[]> {
  if (!db) return [];
  let query = `SELECT * FROM messages
    WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)`;
  const params: any[] = [userId1, userId2, userId2, userId1];

  if (beforeId) {
    query += ` AND created_at < (SELECT created_at FROM messages WHERE id = ?)`;
    params.push(beforeId);
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  return await db.getAllAsync(query, params);
}

export async function updateMessageServerId(
  localId: string,
  serverId: number,
  createdAt: string
): Promise<void> {
  if (!db) return;
  const serverKey = String(serverId);
  await db.runAsync(`DELETE FROM messages WHERE id = ? AND id != ?`, [serverKey, localId]);
  await db.runAsync(
    `UPDATE messages SET id = ?, server_id = ?, created_at = ?, status = 'sent' WHERE id = ?`,
    [serverKey, serverId, createdAt, localId]
  );
}
