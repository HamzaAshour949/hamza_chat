import 'package:flutter/material.dart';

import '../models/message.dart';
import '../theme.dart';
import '../utils/format.dart';
import 'file_bubble.dart';
import 'media_placeholder.dart';
import 'voice_bubble.dart';

class MessageBubble extends StatelessWidget {
  final Message message;
  final bool isSent;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isSent,
  });

  @override
  Widget build(BuildContext context) {
    final isFailed = message.status == MessageStatus.failed;
    final isPending = message.status == MessageStatus.pending;

    final bubble = Container(
      constraints: BoxConstraints(
        maxWidth: MediaQuery.of(context).size.width * 0.78,
      ),
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      decoration: BoxDecoration(
        color: isSent ? AppColors.sentBubble : AppColors.receivedBubble,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(isSent ? 8 : 2),
          topRight: Radius.circular(isSent ? 2 : 8),
          bottomLeft: const Radius.circular(8),
          bottomRight: const Radius.circular(8),
        ),
      ),
      foregroundDecoration: isFailed
          ? const BoxDecoration(color: Color(0x4D000000))
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildContent(),
          Align(
            alignment: Alignment.centerRight,
            child: Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 2),
              child: _buildMeta(isFailed: isFailed, isPending: isPending),
            ),
          ),
        ],
      ),
    );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      child: Row(
        mainAxisAlignment:
            isSent ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [bubble],
      ),
    );
  }

  Widget _buildContent() {
    switch (message.type) {
      case MessageType.text:
        return Text(
          message.content ?? '',
          style: const TextStyle(
            color: AppColors.text,
            fontSize: 15,
            height: 20 / 15,
          ),
        );
      case MessageType.image:
      case MessageType.video:
        return MediaPlaceholder(
          type: message.type == MessageType.image ? 'image' : 'video',
          thumbnail: message.thumbnail,
          mediaUrl: message.mediaUrl,
        );
      case MessageType.voice:
        return VoiceBubble(fileSize: message.fileSize);
      case MessageType.file:
        return FileBubble(
          fileName: message.fileName,
          fileSize: message.fileSize,
        );
    }
  }

  Widget _buildMeta({required bool isFailed, required bool isPending}) {
    if (isFailed) {
      return const Icon(Icons.error_outline, size: 14, color: AppColors.danger);
    }
    if (isPending) {
      return const Icon(Icons.access_time,
          size: 14, color: AppColors.secondaryText);
    }
    return Text(
      formatTime(message.createdAt),
      style: const TextStyle(fontSize: 11, color: AppColors.secondaryText),
    );
  }
}
