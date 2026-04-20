import 'package:flutter/foundation.dart';

import '../config/env.dart';
import '../models/user.dart';
import '../services/api_client.dart';
import '../services/auth_storage.dart';
import '../utils/jwt.dart';

class AuthProvider extends ChangeNotifier {
  User? _user;
  bool _loading = true;
  String? _error;
  String? _pendingVerificationEmail;

  User? get user => _user;
  bool get loading => _loading;
  String? get error => _error;
  String? get pendingVerificationEmail => _pendingVerificationEmail;
  bool get isAuthenticated => _user != null;

  AuthProvider() {
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      final token = await AuthStorage.getToken();
      if (token != null) {
        if (Jwt.isValid(token)) {
          final payload = Jwt.decodePayload(token);
          final userId = (payload?['userId'] as num?)?.toInt();
          if (userId != null) {
            _user = User(id: userId, email: '');
          }
        } else {
          await AuthStorage.removeToken();
        }
      }
    } catch (_) {
      await AuthStorage.removeToken();
    } finally {
      _loading = false;
      notifyListeners();
      _maybeAutoLoginTestAccount();
    }
  }

  Future<void> _maybeAutoLoginTestAccount() async {
    if (_user != null) return;
    if (Env.testAccount.isEmpty) return;
    final idx = int.tryParse(Env.testAccount);
    if (idx == null) return;
    const accounts = [
      {'email': 'test1@test.com', 'password': 'password123'},
      {'email': 'test2@test.com', 'password': 'password123'},
    ];
    if (idx < 0 || idx >= accounts.length) return;
    try {
      await login(accounts[idx]['email']!, accounts[idx]['password']!);
    } catch (_) {
      // surfaced via _error
    }
  }

  /// Returns `true` when email verification is required.
  Future<bool> login(String email, String password) async {
    _error = null;
    _loading = true;
    notifyListeners();
    try {
      final data = await ApiClient.request(
        '/auth/login',
        method: 'POST',
        body: {'email': email, 'password': password},
        auth: false,
      );
      if (data['token'] is String && data['user'] is Map) {
        await AuthStorage.setToken(data['token'] as String);
        _user = User.fromJson(data['user'] as Map<String, dynamic>);
        _pendingVerificationEmail = null;
        return false;
      }
      _pendingVerificationEmail = (data['email'] as String?) ?? email;
      return true;
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<bool> register(String email, String password) async {
    _error = null;
    _loading = true;
    notifyListeners();
    try {
      final data = await ApiClient.request(
        '/auth/register',
        method: 'POST',
        body: {'email': email, 'password': password},
        auth: false,
      );
      if (data['token'] is String && data['user'] is Map) {
        await AuthStorage.setToken(data['token'] as String);
        _user = User.fromJson(data['user'] as Map<String, dynamic>);
        _pendingVerificationEmail = null;
        return false;
      }
      _pendingVerificationEmail = (data['email'] as String?) ?? email;
      return true;
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> verifyEmail(String email, String code) async {
    _error = null;
    _loading = true;
    notifyListeners();
    try {
      final data = await ApiClient.request(
        '/auth/verify-email',
        method: 'POST',
        body: {'email': email, 'code': code},
        auth: false,
      );
      await AuthStorage.setToken(data['token'] as String);
      _user = User.fromJson(data['user'] as Map<String, dynamic>);
      _pendingVerificationEmail = null;
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> resendVerification(String email) async {
    _error = null;
    notifyListeners();
    try {
      await ApiClient.request(
        '/auth/resend-verification',
        method: 'POST',
        body: {'email': email},
        auth: false,
      );
    } catch (e) {
      _error = e.toString();
      rethrow;
    }
  }

  void cancelVerification() {
    _pendingVerificationEmail = null;
    _error = null;
    notifyListeners();
  }

  Future<void> logout() async {
    await AuthStorage.removeToken();
    _user = null;
    _error = null;
    notifyListeners();
  }

  void clearError() {
    if (_error != null) {
      _error = null;
      notifyListeners();
    }
  }
}
