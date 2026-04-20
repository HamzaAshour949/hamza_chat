import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../models/message.dart';
import '../services/api_client.dart';
import '../services/message_store.dart';
import '../services/socket_service.dart';

String _generateLocalId() {
  final rand = Random().nextInt(1 << 32).toRadixString(36);
  return 'local_${DateTime.now().millisecondsSinceEpoch}_$rand';
}

class MessagesProvider extends ChangeNotifier {
  final int partnerId;
  final int currentUserId;
  final SocketService _socket;

  List<Message> _messages = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;

  void Function()? _offNew;
  void Function()? _offSent;

  List<Message> get messages => _messages;
  bool get loading => _loading;
  bool get loadingMore => _loadingMore;

  MessagesProvider({
    required this.partnerId,
    required this.currentUserId,
    required SocketService socket,
  }) : _socket = socket {
    _init();
  }

  Future<void> _init() async {
    await _loadCached();
    await _syncFromServer();
    _offNew = _socket.on('new_message', _onNewMessage);
    _offSent = _socket.on('message_sent', _onMessageSent);
  }

  Future<void> _loadCached() async {
    final cached = await MessageStore.getMessages(currentUserId, partnerId);
    if (cached.isNotEmpty) {
      _messages = cached;
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> _syncFromServer() async {
    try {
      final data = await ApiClient.request(
        '/messages?userId=$partnerId&limit=30',
      );
      final list = (data['messages'] as List? ?? const [])
          .cast<Map<String, dynamic>>()
          .map(Message.fromServerJson)
          .toList();

      for (final m in list) {
        await MessageStore.saveMessage(m);
      }

      // Merge: keep pending optimistic messages + server list, de-dup by id.
      final pending = _messages
          .where((m) => m.status == MessageStatus.pending)
          .toList();
      final merged = <Message>[...pending, ...list];
      final seen = <String>{};
      _messages = merged.where((m) => seen.add(m.id)).toList();
    } catch (e) {
      debugPrint('sync failed: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void _onNewMessage(dynamic data) {
    if (data is! Map) return;
    final m = Map<String, dynamic>.from(data);
    final from = (m['from'] as num?)?.toInt();
    final to = (m['to'] as num?)?.toInt();
    if (from != partnerId && to != partnerId) return;
    final msg = Message.fromServerJson(m);
    MessageStore.saveMessage(msg);
    _messages = [msg, ..._messages];
    notifyListeners();
  }

  void _onMessageSent(dynamic data) {
    if (data is! Map) return;
    final localId = data['localId'] as String?;
    final id = (data['id'] as num?)?.toInt();
    final createdAt = data['createdAt'] as String?;
    if (localId == null || id == null || createdAt == null) return;
    MessageStore.updateMessageServerId(localId, id, createdAt);
    _messages = _messages.map((m) {
      if (m.id == localId) {
        return m.copyWith(
          serverId: id,
          createdAt: createdAt,
          status: MessageStatus.sent,
        );
      }
      return m;
    }).toList();
    notifyListeners();
  }

  void sendText(String text) {
    final localId = _generateLocalId();
    final now = DateTime.now().toUtc().toIso8601String();
    final msg = Message(
      id: localId,
      from: currentUserId,
      to: partnerId,
      type: MessageType.text,
      content: text,
      createdAt: now,
      status: MessageStatus.pending,
    );
    MessageStore.saveMessage(msg);
    _messages = [msg, ..._messages];
    notifyListeners();

    _socket.emitOrQueue('send_message', {
      'to': partnerId,
      'type': 'text',
      'content': text,
      'localId': localId,
    });
  }

  Future<void> addOptimistic(Message msg) async {
    await MessageStore.saveMessage(msg);
    final existing = _messages.indexWhere((m) => m.id == msg.id);
    if (existing >= 0) {
      final copy = [..._messages];
      copy[existing] = msg;
      _messages = copy;
    } else {
      _messages = [msg, ..._messages];
    }
    notifyListeners();
  }

  String newLocalId() => _generateLocalId();

  Future<void> loadMore() async {
    if (_loadingMore || !_hasMore || _messages.isEmpty) return;
    _loadingMore = true;
    notifyListeners();
    try {
      final oldest = _messages.last;
      final before = oldest.serverId ?? int.tryParse(oldest.id);
      if (before == null) return;
      final data = await ApiClient.request(
        '/messages?userId=$partnerId&before=$before&limit=30',
      );
      final older = (data['messages'] as List? ?? const [])
          .cast<Map<String, dynamic>>()
          .map(Message.fromServerJson)
          .toList();
      if (older.length < 30) _hasMore = false;
      for (final m in older) {
        await MessageStore.saveMessage(m);
      }
      _messages = [..._messages, ...older];
    } catch (e) {
      debugPrint('loadMore failed: $e');
    } finally {
      _loadingMore = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _offNew?.call();
    _offSent?.call();
    super.dispose();
  }
}
