import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../config/env.dart';
import '../theme.dart';

/// Media thumbnail for an image/video bubble.
/// Prefers the inline base64 `thumbnail`; falls back to the uploaded
/// `mediaUrl` (relative path) so the full image can load once available.
class MediaPlaceholder extends StatelessWidget {
  final String type; // 'image' | 'video'
  final String? thumbnail;
  final String? mediaUrl;

  const MediaPlaceholder({
    super.key,
    required this.type,
    required this.thumbnail,
    required this.mediaUrl,
  });

  @override
  Widget build(BuildContext context) {
    Widget? preview;
    final thumb = thumbnail ?? '';
    if (thumb.startsWith('data:image')) {
      try {
        final bytes = _decodeDataUri(thumb);
        if (bytes != null) {
          preview = Image.memory(bytes, fit: BoxFit.cover);
        }
      } catch (_) {}
    }
    if (preview == null && type == 'image' && mediaUrl != null) {
      final url = _resolveMediaUrl(mediaUrl!);
      preview = Image.network(url, fit: BoxFit.cover);
    }

    return Container(
      width: 200,
      height: 150,
      decoration: BoxDecoration(
        color: AppColors.inputBg,
        borderRadius: BorderRadius.circular(4),
      ),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (preview != null)
            preview
          else
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  type == 'image'
                      ? Icons.image_outlined
                      : Icons.videocam_outlined,
                  size: 32,
                  color: AppColors.secondaryText,
                ),
                const SizedBox(height: 4),
                Text(
                  type == 'image' ? 'Image' : 'Video',
                  style: const TextStyle(
                    color: AppColors.secondaryText,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          if (type == 'video')
            const Center(
              child: Icon(
                Icons.play_circle,
                size: 44,
                color: Color(0xE6FFFFFF),
              ),
            ),
        ],
      ),
    );
  }

  static Uint8List? _decodeDataUri(String data) {
    final idx = data.indexOf(',');
    if (idx < 0) return null;
    return base64Decode(data.substring(idx + 1));
  }

  static String _resolveMediaUrl(String url) {
    if (url.startsWith('http')) return url;
    return '${Env.apiBaseUrl}$url';
  }
}
