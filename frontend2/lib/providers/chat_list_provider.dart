import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/conversation.dart';
import '../services/api_client.dart';
import '../services/socket_service.dart';

class ChatListProvider extends ChangeNotifier {
  final SocketService _socket;

  List<Conversation> _conversations = [];
  List<Map<String, dynamic>> _searchResults = [];
  String _searchQuery = '';
  bool _loading = true;
  Timer? _searchDebounce;
  void Function()? _offNewMessage;
  void Function()? _offMessageSent;

  List<Conversation> get conversations => _conversations;
  List<Map<String, dynamic>> get searchResults => _searchResults;
  String get searchQuery => _searchQuery;
  bool get loading => _loading;

  ChatListProvider(this._socket) {
    fetchConversations();
    _offNewMessage = _socket.on('new_message', (_) => fetchConversations());
    _offMessageSent = _socket.on('message_sent', (_) => fetchConversations());
  }

  Future<void> fetchConversations() async {
    try {
      final data = await ApiClient.request('/conversations');
      final list = (data['conversations'] as List? ?? const [])
          .cast<Map<String, dynamic>>()
          .map(Conversation.fromJson)
          .toList();
      _conversations = list;
    } catch (e) {
      debugPrint('fetchConversations failed: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void setSearchQuery(String q) {
    _searchQuery = q;
    notifyListeners();

    _searchDebounce?.cancel();
    if (q.length < 2) {
      _searchResults = [];
      notifyListeners();
      return;
    }
    _searchDebounce = Timer(const Duration(milliseconds: 300), () async {
      try {
        final data = await ApiClient.request(
          '/users/search?email=${Uri.encodeQueryComponent(q)}',
        );
        _searchResults =
            (data['users'] as List? ?? const []).cast<Map<String, dynamic>>();
        notifyListeners();
      } catch (e) {
        debugPrint('search failed: $e');
      }
    });
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _offNewMessage?.call();
    _offMessageSent?.call();
    super.dispose();
  }
}
