import 'dart:io' show Platform;

/// Compile-time configuration.
///
/// URL resolution (mirrors `frontend/src/services/config.ts`):
///  1. Production builds may provide full `API_BASE_URL` and `WS_URL` values.
///  2. Otherwise, `API_HOST` targets the direct local backend ports.
///  3. Without defines, Android uses `10.0.2.2`; iOS / other use `127.0.0.1`.
class Env {
  static const String _apiBaseUrlDefine =
      String.fromEnvironment('API_BASE_URL', defaultValue: '');
  static const String _wsUrlDefine =
      String.fromEnvironment('WS_URL', defaultValue: '');
  static const String _apiHostDefine =
      String.fromEnvironment('API_HOST', defaultValue: '');

  /// TEST_ACCOUNT: 0 → test1@test.com, 1 → test2@test.com, password123.
  /// Empty string means auto-login disabled.
  static const String testAccount =
      String.fromEnvironment('TEST_ACCOUNT', defaultValue: '');

  static String get host {
    if (_apiHostDefine.isNotEmpty) return _apiHostDefine;
    try {
      if (Platform.isAndroid) return '10.0.2.2';
    } catch (_) {
      // Platform unavailable (tests / web) — fall through.
    }
    return '127.0.0.1';
  }

  static String _withoutTrailingSlash(String value) =>
      value.endsWith('/') ? value.substring(0, value.length - 1) : value;

  static String get apiBaseUrl => _apiBaseUrlDefine.isNotEmpty
      ? _withoutTrailingSlash(_apiBaseUrlDefine)
      : 'http://$host:5101';

  static String get wsUrl => _wsUrlDefine.isNotEmpty
      ? _withoutTrailingSlash(_wsUrlDefine)
      : 'http://$host:5100';
}
