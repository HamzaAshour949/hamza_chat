import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

import '../models/message.dart';

/// Local SQLite cache — mirrors `frontend/src/services/messageStore.ts`.
class MessageStore {
  static Database? _db;

  static Future<void> init() async {
    if (_db != null) return;
    final dir = await getApplicationDocumentsDirectory();
    final path = p.join(dir.path, 'chatapp.db');
    _db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, _) async {
        await db.execute('''
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
          )
        ''');
        await db.execute(
            'CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(from_user, to_user, created_at)');
      },
    );
  }

  static Database get _require {
    final db = _db;
    if (db == null) {
      throw StateError('MessageStore not initialised — call init() first.');
    }
    return db;
  }

  static Future<void> saveMessage(Message msg) async {
    await _require.insert(
      'messages',
      msg.toDbRow(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  static Future<List<Message>> getMessages(
    int userId1,
    int userId2, {
    int limit = 30,
    String? beforeId,
  }) async {
    var sql = '''SELECT * FROM messages
      WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)''';
    final args = <Object?>[userId1, userId2, userId2, userId1];

    if (beforeId != null) {
      sql +=
          ' AND created_at < (SELECT created_at FROM messages WHERE id = ?)';
      args.add(beforeId);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    args.add(limit);

    final rows = await _require.rawQuery(sql, args);
    return rows.map(Message.fromDbRow).toList();
  }

  static Future<void> updateMessageServerId(
    String localId,
    int serverId,
    String createdAt,
  ) async {
    await _require.update(
      'messages',
      {'server_id': serverId, 'created_at': createdAt, 'status': 'sent'},
      where: 'id = ?',
      whereArgs: [localId],
    );
  }

  static Future<void> updateStatus(String localId, MessageStatus status) async {
    await _require.update(
      'messages',
      {'status': statusToString(status)},
      where: 'id = ?',
      whereArgs: [localId],
    );
  }
}
