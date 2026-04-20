import 'package:flutter/material.dart';

class AppColors {
  static const bg = Color(0xFF111B21);
  static const surface = Color(0xFF1F2C33);
  static const inputBg = Color(0xFF2A3942);
  static const accent = Color(0xFF00A884);
  static const sentBubble = Color(0xFF005C4B);
  static const receivedBubble = surface;
  static const text = Color(0xFFE9EDEF);
  static const secondaryText = Color(0xFF8696A0);
  static const danger = Color(0xFFF15C6D);
  static const divider = Color(0xFF222D34);

  static Color fromHex(String hex) {
    final h = hex.replaceFirst('#', '');
    return Color(int.parse('FF$h', radix: 16));
  }
}

ThemeData buildAppTheme() {
  const colorScheme = ColorScheme.dark(
    surface: AppColors.bg,
    primary: AppColors.accent,
    secondary: AppColors.accent,
    error: AppColors.danger,
    onPrimary: Colors.white,
    onSurface: AppColors.text,
  );

  return ThemeData(
    useMaterial3: false,
    brightness: Brightness.dark,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: AppColors.bg,
    canvasColor: AppColors.bg,
    primaryColor: AppColors.accent,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.surface,
      foregroundColor: AppColors.text,
      elevation: 0,
      iconTheme: IconThemeData(color: AppColors.text),
      titleTextStyle: TextStyle(
        color: AppColors.text,
        fontSize: 18,
        fontWeight: FontWeight.w600,
      ),
    ),
    textTheme: const TextTheme(
      bodyMedium: TextStyle(color: AppColors.text, fontSize: 15),
      bodySmall: TextStyle(color: AppColors.secondaryText, fontSize: 13),
      titleLarge: TextStyle(
        color: AppColors.text,
        fontSize: 22,
        fontWeight: FontWeight.w700,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      hintStyle: const TextStyle(color: AppColors.secondaryText),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.inputBg),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.inputBg),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.accent),
      ),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: AppColors.accent,
    ),
  );
}
