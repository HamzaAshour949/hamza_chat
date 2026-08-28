import * as SQLite from 'expo-sqlite';
import type { Message } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export async function initDB(): Promise<void> {
  db = await SQLite.openDatabaseAsync('chatapp.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      from_user TEXT NOT NULL,
      to_user TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      content TEXT,
      media_url TEXT,
      local_uri TEXT,
      thumbnail TEXT,
      mime_type TEXT,
      file_name TEXT,
      file_size INTEGER,
      created_at TEXT NOT NULL,
      status TEXT DEFAULT 'sent'
    );
    CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(from_user, to_user, created_at);
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    serverId: row.server_id ? String(row.server_id) : null,
    from: String(row.from_user),
    to: String(row.to_user),
    type: (row.type as Message['type']) || 'text',
    content: (row.content as string | null) ?? null,
    mediaUrl: (row.media_url as string | null) ?? null,
    localUri: (row.local_uri as string | null) ?? null,
    thumbnail: (row.thumbnail as string | null) ?? null,
    mimeType: (row.mime_type as string | null) ?? null,
    fileName: (row.file_name as string | null) ?? null,
    fileSize: typeof row.file_size === 'number' ? row.file_size : null,
    createdAt: String(row.created_at),
    status: (row.status as Message['status']) || 'sent',
  };
}

export async function saveMessage(msg: Message): Promise<void> {
  if (!db) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO messages
      (id, server_id, from_user, to_user, type, content, media_url, local_uri, thumbnail, mime_type, file_name, file_size, created_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msg.id,
      msg.serverId,
      msg.from,
      msg.to,
      msg.type,
      msg.content,
      msg.mediaUrl,
      msg.localUri,
      msg.thumbnail,
      msg.mimeType,
      msg.fileName,
      msg.fileSize,
      msg.createdAt,
      msg.status,
    ],
  );
}

export async function getMessages(userId1: string, userId2: string, limit = 30): Promise<Message[]> {
  if (!db) return [];
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM messages
     WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId1, userId2, userId2, userId1, limit],
  );
  return rows.map(rowToMessage);
}

export async function updateMessageAck(localId: string, serverId: string, createdAt: string): Promise<void> {
  if (!db) return;
  await db.runAsync(`DELETE FROM messages WHERE id = ? AND id != ?`, [serverId, localId]);
  await db.runAsync(
    `UPDATE messages SET id = ?, server_id = ?, created_at = ?, status = 'sent' WHERE id = ?`,
    [serverId, serverId, createdAt, localId],
  );
}

export async function updateLocalUri(id: string, localUri: string): Promise<void> {
  if (!db) return;
  await db.runAsync(`UPDATE messages SET local_uri = ? WHERE id = ?`, [localUri, id]);
}

export async function enqueueOutbox(id: string, payload: unknown): Promise<void> {
  if (!db) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO outbox (id, payload, created_at) VALUES (?, ?, ?)`,
    [id, JSON.stringify(payload), new Date().toISOString()],
  );
}

export async function getOutbox(): Promise<Array<{ id: string; payload: unknown }>> {
  if (!db) return [];
  const rows = await db.getAllAsync<{ id: string; payload: string }>(`SELECT id, payload FROM outbox ORDER BY created_at ASC`);
  return rows.map((row) => ({ id: row.id, payload: JSON.parse(row.payload) }));
}

export async function removeOutbox(id: string): Promise<void> {
  if (!db) return;
  await db.runAsync(`DELETE FROM outbox WHERE id = ?`, [id]);
}
