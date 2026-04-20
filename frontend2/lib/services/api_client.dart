import 'dart:convert';
import 'package:http/http.dart' as http;

import '../config/env.dart';
import 'auth_storage.dart';

class ApiException implements Exception {
  final String message;
  final int? status;
  ApiException(this.message, {this.status});
  @override
  String toString() => message;
}

class ApiClient {
  /// HTTP helper mirroring `frontend/src/services/api.ts`.
  static Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    final uri = Uri.parse('${Env.apiBaseUrl}$path');
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (auth) {
      final token = await AuthStorage.getToken();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }

    late http.Response res;
    try {
      switch (method) {
        case 'POST':
          res = await http.post(uri,
              headers: headers, body: body == null ? null : json.encode(body));
          break;
        default:
          res = await http.get(uri, headers: headers);
      }
    } catch (e) {
      throw ApiException('Network error: $e');
    }

    Map<String, dynamic> data;
    try {
      data = json.decode(res.body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException('Invalid server response (${res.statusCode})',
          status: res.statusCode);
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      final msg = (data['error'] as String?) ??
          'Request failed with status ${res.statusCode}';
      throw ApiException(msg, status: res.statusCode);
    }
    return data;
  }
}
