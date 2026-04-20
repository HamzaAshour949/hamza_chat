import 'dart:convert';

/// Minimal JWT helper — decodes the payload and checks expiry.
class Jwt {
  static Map<String, dynamic>? decodePayload(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      var payload = parts[1];
      // base64url-decode, padding.
      switch (payload.length % 4) {
        case 2:
          payload += '==';
          break;
        case 3:
          payload += '=';
          break;
      }
      final bytes = base64Url.decode(payload);
      final jsonStr = utf8.decode(bytes);
      final decoded = json.decode(jsonStr);
      if (decoded is Map<String, dynamic>) return decoded;
    } catch (_) {
      return null;
    }
    return null;
  }

  /// Returns true if the token is present and not expired.
  static bool isValid(String token) {
    final payload = decodePayload(token);
    if (payload == null) return false;
    final exp = payload['exp'];
    if (exp is! int) return false;
    return exp * 1000 > DateTime.now().millisecondsSinceEpoch;
  }
}
