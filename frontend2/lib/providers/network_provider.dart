import 'package:flutter/foundation.dart';

import '../services/socket_service.dart';

/// Thin wrapper to expose socket connectivity as a ChangeNotifier.
class NetworkProvider extends ChangeNotifier {
  final SocketService _socket;
  bool _connected = false;

  bool get connected => _connected;

  NetworkProvider(this._socket) {
    _connected = _socket.connected;
    _socket.addListener(_onChanged);
  }

  void _onChanged() {
    final now = _socket.connected;
    if (now != _connected) {
      _connected = now;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _socket.removeListener(_onChanged);
    super.dispose();
  }
}
