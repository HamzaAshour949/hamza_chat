import 'dart:io' show Platform;

/// Compile-time configuration.
///
/// Host resolution (mirrors `frontend/src/services/config.ts`):
///  1. If `--dart-define=API_HOST=<host>` is provided, use it.
///  2. Otherwise, on Android use the emulator loopback alias `10.0.2.2`.
///  3. On iOS / other, use `127.0.0.1`.
class Env {
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

  static String get apiBaseUrl => 'http://$host:3001';
  static String get wsUrl => 'http://$host:3000';
}
