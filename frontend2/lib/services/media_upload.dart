import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../config/env.dart';
import 'auth_storage.dart';

class UploadResult {
  final String url;
  final String filename;
  final String mimeType;
  final int size;
  const UploadResult({
    required this.url,
    required this.filename,
    required this.mimeType,
    required this.size,
  });

  factory UploadResult.fromJson(Map<String, dynamic> j) => UploadResult(
        url: j['url'] as String,
        filename: j['filename'] as String,
        mimeType: j['mimeType'] as String,
        size: (j['size'] as num).toInt(),
      );
}

class MediaUpload {
  static Future<UploadResult> upload({
    required String filePath,
    required String mimeType,
    required String fileName,
  }) async {
    final token = await AuthStorage.getToken();
    final uri = Uri.parse('${Env.apiBaseUrl}/media/upload');
    final req = http.MultipartRequest('POST', uri);
    if (token != null) req.headers['Authorization'] = 'Bearer $token';

    final file = File(filePath);
    final parts = mimeType.split('/');
    final mediaType = parts.length == 2
        ? MediaType(parts[0], parts[1])
        : MediaType('application', 'octet-stream');
    req.files.add(await http.MultipartFile.fromPath(
      'file',
      file.path,
      filename: fileName,
      contentType: mediaType,
    ));
    req.fields['filename'] = fileName;

    final streamed = await req.send();
    final body = await streamed.stream.bytesToString();
    if (streamed.statusCode != 201) {
      String msg;
      try {
        final err = json.decode(body) as Map<String, dynamic>;
        msg = (err['error'] as String?) ?? 'Upload failed';
      } catch (_) {
        msg = 'Upload failed (${streamed.statusCode})';
      }
      throw Exception(msg);
    }
    final j = json.decode(body) as Map<String, dynamic>;
    // Backend returns `url` like "/media/<uuid>.<ext>" — callers concatenate
    // with the base URL when rendering.
    return UploadResult.fromJson(j);
  }
}
