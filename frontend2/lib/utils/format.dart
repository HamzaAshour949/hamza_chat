import 'package:intl/intl.dart';

const List<String> kAvatarColors = [
  '#00A884',
  '#F15C6D',
  '#6B8AFF',
  '#FFB347',
  '#A78BFA',
  '#34D399',
  '#F472B6',
  '#FBBF24',
];

String avatarColor(int userId) {
  return kAvatarColors[userId % kAvatarColors.length];
}

String initials(String email) {
  if (email.isEmpty) return '?';
  return email.substring(0, 1).toUpperCase();
}

String formatTime(String iso) {
  try {
    final date = DateTime.parse(iso).toLocal();
    return DateFormat.Hm().format(date);
  } catch (_) {
    return '';
  }
}

String formatTimestamp(String iso) {
  try {
    final date = DateTime.parse(iso).toLocal();
    final now = DateTime.now();
    final isToday = date.year == now.year &&
        date.month == now.month &&
        date.day == now.day;
    if (isToday) return DateFormat.Hm().format(date);
    final yesterday = now.subtract(const Duration(days: 1));
    final isYesterday = date.year == yesterday.year &&
        date.month == yesterday.month &&
        date.day == yesterday.day;
    if (isYesterday) return 'Yesterday';
    return DateFormat.MMMd().format(date);
  } catch (_) {
    return '';
  }
}

String formatFileSize(int? bytes) {
  if (bytes == null || bytes == 0) return '';
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

String formatDuration(int seconds) {
  final m = (seconds ~/ 60).toString();
  final s = (seconds % 60).toString().padLeft(2, '0');
  return '$m:$s';
}

String formatCallDuration(int seconds) {
  final m = (seconds ~/ 60).toString().padLeft(2, '0');
  final s = (seconds % 60).toString().padLeft(2, '0');
  return '$m:$s';
}

String formatLastMessagePreview(String message, String type) {
  switch (type) {
    case 'image':
      return '📷 Image';
    case 'video':
      return '🎥 Video';
    case 'voice':
      return '🎤 Voice message';
    case 'file':
      return '📄 File';
    default:
      return message;
  }
}
