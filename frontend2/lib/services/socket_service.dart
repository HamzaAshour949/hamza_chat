import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as sio;

import '../config/env.dart';

/// Wrapper around socket.io-client v2 that speaks Engine.IO 3, matching
/// the phpsocket.io backend. Also handles:
///   - auth emission on connect and reconnect
///   - offline queue (buffer `send_message`s when disconnected; flushed on
///     `authenticated`).
///   - a `connected` ChangeNotifier that screens listen to for the network
///     banner.
class SocketService extends ChangeNotifier {
  sio.Socket? _socket;
  String? _token;
  bool _connected = false;
  bool _authenticated = false;

  final List<_QueuedEvent> _queue = [];
  final Map<String, List<Function>> _subscribers = {};

  bool get connected => _connected && _authenticated;
  bool get rawConnected => _connected;
  sio.Socket? get raw => _socket;

  /// Connect (or reconnect) with a bearer token.
  void connect(String token) {
    _token = token;
    if (_socket != null) {
      if (_socket!.connected) {
        _emitAuthenticate();
        return;
      }
      _socket!.dispose();
      _socket = null;
    }

    final opts = sio.OptionBuilder()
        .setTransports(['websocket'])
        .disableAutoConnect()
        .enableReconnection()
        .setReconnectionAttempts(1 << 30)
        .setReconnectionDelay(1000)
        .setReconnectionDelayMax(5000)
        .build();

    final socket = sio.io(Env.wsUrl, opts);
    _socket = socket;

    socket.onConnect((_) {
      _connected = true;
      _authenticated = false;
      notifyListeners();
      _emitAuthenticate();
    });

    socket.onConnectError((err) {
      if (kDebugMode) debugPrint('[socket] connect_error: $err');
    });

    socket.onDisconnect((reason) {
      _connected = false;
      _authenticated = false;
      notifyListeners();
      if (kDebugMode) debugPrint('[socket] disconnected: $reason');
    });

    socket.onReconnect((_) {
      _emitAuthenticate();
    });

    socket.on('authenticated', (data) {
      _authenticated = true;
      notifyListeners();
      _flushQueue();
      _dispatch('authenticated', data);
    });

    socket.on('auth_error', (data) {
      if (kDebugMode) debugPrint('[socket] auth_error: $data');
      _dispatch('auth_error', data);
    });

    // Re-dispatch every other event to registered listeners.
    for (final ev in const [
      'new_message',
      'message_sent',
      'user_online',
      'user_offline',
      'call_offer',
      'call_answer',
      'ice_candidate',
      'call_ended',
      'call_rejected',
      'call_unavailable',
      'error',
    ]) {
      socket.on(ev, (data) => _dispatch(ev, data));
    }

    socket.connect();
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
    _connected = false;
    _authenticated = false;
    _queue.clear();
    notifyListeners();
  }

  void _emitAuthenticate() {
    final t = _token;
    if (t != null) {
      _socket?.emit('authenticate', {'token': t});
    }
  }

  /// Emit an event immediately, or queue it if disconnected.
  void emitOrQueue(String event, Map<String, dynamic> data) {
    if (_socket != null && _socket!.connected && _authenticated) {
      _socket!.emit(event, data);
    } else {
      _queue.add(_QueuedEvent(event, data));
    }
  }

  /// Emit unconditionally (for call signalling etc.).
  void emit(String event, Map<String, dynamic> data) {
    _socket?.emit(event, data);
  }

  void _flushQueue() {
    if (_queue.isEmpty || _socket == null || !_socket!.connected) return;
    final batch = List<_QueuedEvent>.from(_queue);
    _queue.clear();
    for (final q in batch) {
      _socket!.emit(q.event, q.data);
    }
  }

  /// Subscribe to a server event. Returns an unsubscribe function.
  void Function() on(String event, void Function(dynamic) handler) {
    _subscribers.putIfAbsent(event, () => []).add(handler);
    return () => off(event, handler);
  }

  void off(String event, void Function(dynamic) handler) {
    _subscribers[event]?.remove(handler);
  }

  void _dispatch(String event, dynamic data) {
    final list = _subscribers[event];
    if (list == null) return;
    for (final h in List<Function>.from(list)) {
      try {
        h(data);
      } catch (e, st) {
        if (kDebugMode) debugPrint('[socket] handler error on $event: $e\n$st');
      }
    }
  }

  @override
  void dispose() {
    disconnect();
    _subscribers.clear();
    super.dispose();
  }
}

class _QueuedEvent {
  final String event;
  final Map<String, dynamic> data;
  _QueuedEvent(this.event, this.data);
}
