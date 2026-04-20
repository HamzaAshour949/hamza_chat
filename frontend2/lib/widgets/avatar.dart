import 'package:flutter/material.dart';

import '../theme.dart';
import '../utils/format.dart';

class Avatar extends StatelessWidget {
  final int userId;
  final String email;
  final double size;

  const Avatar({
    super.key,
    required this.userId,
    required this.email,
    this.size = 48,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.fromHex(avatarColor(userId)),
        shape: BoxShape.circle,
      ),
      child: Text(
        initials(email),
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.4,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
