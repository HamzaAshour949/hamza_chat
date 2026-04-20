class User {
  final int id;
  final String email;
  const User({required this.id, required this.email});

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: (j['id'] as num).toInt(),
        email: (j['email'] ?? '') as String,
      );

  Map<String, dynamic> toJson() => {'id': id, 'email': email};
}
