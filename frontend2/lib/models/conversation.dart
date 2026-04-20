class Conversation {
  final int userId;
  final String email;
  final String lastMessage;
  final String lastMessageType;
  final String lastMessageAt;

  const Conversation({
    required this.userId,
    required this.email,
    required this.lastMessage,
    required this.lastMessageType,
    required this.lastMessageAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> j) => Conversation(
        userId: (j['userId'] as num).toInt(),
        email: (j['email'] ?? '') as String,
        lastMessage: (j['lastMessage'] ?? '') as String,
        lastMessageType: (j['lastMessageType'] ?? 'text') as String,
        lastMessageAt: (j['lastMessageAt'] ?? '') as String,
      );
}
