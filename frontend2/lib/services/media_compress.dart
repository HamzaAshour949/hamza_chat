import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:video_compress/video_compress.dart';

/// Low-bandwidth compression helpers.
///
/// Targets (from the project README):
///   - Images: JPEG quality 50%, max width 800, target ≤ 50 KB
///   - Thumbnails: inline base64 JPEG ~120 px wide, quality 0.3
///   - Videos: 240p 15 fps (best effort via video_compress's LowQuality preset)
class MediaCompress {
  /// Compresses a source image to a JPEG on disk, returning the new file path.
  static Future<String> compressImage(String srcPath) async {
    try {
      final dir = await getTemporaryDirectory();
      final outPath = p.join(
        dir.path,
        'cmp_${DateTime.now().millisecondsSinceEpoch}.jpg',
      );
      final out = await FlutterImageCompress.compressAndGetFile(
        srcPath,
        outPath,
        quality: 50,
        minWidth: 800,
        minHeight: 1,
        format: CompressFormat.jpeg,
      );
      return out?.path ?? srcPath;
    } catch (e) {
      if (kDebugMode) debugPrint('[compress] image failed: $e');
      return srcPath;
    }
  }

  /// Returns a tiny base64 JPEG (`data:image/jpeg;base64,...`) ~120 px wide.
  static Future<String> generateImageThumbnail(String srcPath) async {
    try {
      final bytes = await FlutterImageCompress.compressWithFile(
        srcPath,
        quality: 30,
        minWidth: 120,
        minHeight: 1,
        format: CompressFormat.jpeg,
      );
      if (bytes == null || bytes.isEmpty) return '';
      return 'data:image/jpeg;base64,${base64Encode(bytes)}';
    } catch (e) {
      if (kDebugMode) debugPrint('[compress] thumb failed: $e');
      return '';
    }
  }

  /// Best-effort video compression to ~240p. Returns the compressed file path
  /// or the original path on failure.
  static Future<String> compressVideo(String srcPath) async {
    try {
      final info = await VideoCompress.compressVideo(
        srcPath,
        quality: VideoQuality.LowQuality,
        deleteOrigin: false,
        includeAudio: true,
      );
      return info?.path ?? srcPath;
    } catch (e) {
      if (kDebugMode) debugPrint('[compress] video failed: $e');
      return srcPath;
    }
  }

  /// Grabs a frame from the video, then aggressively compresses it into a
  /// base64 JPEG thumbnail (`data:image/jpeg;base64,...`).
  static Future<String> generateVideoThumbnail(String srcPath) async {
    try {
      final file = await VideoCompress.getFileThumbnail(
        srcPath,
        quality: 50,
        position: 500,
      );
      return await generateImageThumbnail(file.path);
    } catch (e) {
      if (kDebugMode) debugPrint('[compress] video thumb failed: $e');
      return '';
    }
  }

  static Future<int> fileSize(String path) async {
    try {
      final f = File(path);
      if (!await f.exists()) return 0;
      return await f.length();
    } catch (_) {
      return 0;
    }
  }
}
