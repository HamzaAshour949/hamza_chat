enum MessageType { text, image, video, voice, file }

MessageType messageTypeFromString(String s) {
  switch (s) {
    case 'image':
      return MessageType.image;
    case 'video':
      return MessageType.video;
    case 'voice':
      return MessageType.voice;
    case 'file':
      return MessageType.file;
    default:
      return MessageType.text;
  }
}

String messageTypeToString(MessageType t) {
  switch (t) {
    case MessageType.image:
      return 'image';
    case MessageType.video:
      return 'video';
    case MessageType.voice:
      return 'voice';
    case MessageType.file:
      return 'file';
    case MessageType.text:
      return 'text';
  }
}

enum MessageStatus { pending, sent, failed }

MessageStatus statusFromString(String? s) {
  switch (s) {
    case 'pending':
      return MessageStatus.pending;
    case 'failed':
      return MessageStatus.failed;
    default:
      return MessageStatus.sent;
  }
}

String statusToString(MessageStatus s) {
  switch (s) {
    case MessageStatus.pending:
      return 'pending';
    case MessageStatus.failed:
      return 'failed';
    case MessageStatus.sent:
      return 'sent';
  }
}

class Message {
  final String id; // local id or stringified server id
  final int? serverId;
  final int from;
  final int to;
  final MessageType type;
  final String? content;
  final String? mediaUrl;
  final String? thumbnail;
  final String? mimeType;
  final String? fileName;
  final int? fileSize;
  final String createdAt;
  final MessageStatus status;

  const Message({
    required this.id,
    this.serverId,
    required this.from,
    required this.to,
    required this.type,
    this.content,
    this.mediaUrl,
    this.thumbnail,
    this.mimeType,
    this.fileName,
    this.fileSize,
    required this.createdAt,
    this.status = MessageStatus.sent,
  });

  Message copyWith({
    String? id,
    int? serverId,
    String? createdAt,
    MessageStatus? status,
    String? mediaUrl,
    String? thumbnail,
    int? fileSize,
  }) =>
      Message(
        id: id ?? this.id,
        serverId: serverId ?? this.serverId,
        from: from,
        to: to,
        type: type,
        content: content,
        mediaUrl: mediaUrl ?? this.mediaUrl,
        thumbnail: thumbnail ?? this.thumbnail,
        mimeType: mimeType,
        fileName: fileName,
        fileSize: fileSize ?? this.fileSize,
        createdAt: createdAt ?? this.createdAt,
        status: status ?? this.status,
      );

  factory Message.fromServerJson(Map<String, dynamic> m) {
    return Message(
      id: m['id'].toString(),
      serverId: (m['id'] as num).toInt(),
      from: (m['from'] as num).toInt(),
      to: (m['to'] as num).toInt(),
      type: messageTypeFromString((m['type'] ?? 'text') as String),
      content: m['content'] as String?,
      mediaUrl: m['mediaUrl'] as String?,
      thumbnail: m['thumbnail'] as String?,
      mimeType: m['mimeType'] as String?,
      fileName: m['fileName'] as String?,
      fileSize: (m['fileSize'] as num?)?.toInt(),
      createdAt: (m['createdAt'] ?? '') as String,
      status: MessageStatus.sent,
    );
  }

  factory Message.fromDbRow(Map<String, dynamic> r) {
    return Message(
      id: r['id'] as String,
      serverId: (r['server_id'] as num?)?.toInt(),
      from: (r['from_user'] as num).toInt(),
      to: (r['to_user'] as num).toInt(),
      type: messageTypeFromString((r['type'] ?? 'text') as String),
      content: r['content'] as String?,
      mediaUrl: r['media_url'] as String?,
      thumbnail: r['thumbnail'] as String?,
      mimeType: r['mime_type'] as String?,
      fileName: r['file_name'] as String?,
      fileSize: (r['file_size'] as num?)?.toInt(),
      createdAt: (r['created_at'] ?? '') as String,
      status: statusFromString(r['status'] as String?),
    );
  }

  Map<String, Object?> toDbRow() => {
        'id': id,
        'server_id': serverId,
        'from_user': from,
        'to_user': to,
        'type': messageTypeToString(type),
        'content': content,
        'media_url': mediaUrl,
        'thumbnail': thumbnail,
        'mime_type': mimeType,
        'file_name': fileName,
        'file_size': fileSize,
        'created_at': createdAt,
        'status': statusToString(status),
      };
}
