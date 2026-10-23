import 'package:flutter/material.dart';

/// Semantic tones shared by every status indicator (appointments, sales...).
/// Features map their own states to a tone; they never pick raw colors.
enum StatusTone { success, warning, info, teal, accent, danger, neutral }

@immutable
class AppStatusColors extends ThemeExtension<AppStatusColors> {
  const AppStatusColors({
    required this.success,
    required this.warning,
    required this.info,
    required this.teal,
    required this.accent,
    required this.danger,
    required this.neutral,
  });

  final Color success;
  final Color warning;
  final Color info;
  final Color teal;
  final Color accent;
  final Color danger;
  final Color neutral;

  static const dark = AppStatusColors(
    success: Color(0xFF6FCF97),
    warning: Color(0xFFF2A65A),
    info: Color(0xFF7FB0E6),
    teal: Color(0xFF5CC9B8),
    accent: Color(0xFFE0B65E),
    danger: Color(0xFFF08A7C),
    neutral: Color(0xFFADA498),
  );

  static const light = AppStatusColors(
    success: Color(0xFF1E7F4B),
    warning: Color(0xFFB25E09),
    info: Color(0xFF2B66B0),
    teal: Color(0xFF0F766E),
    accent: Color(0xFF8A5B12),
    danger: Color(0xFFB3261E),
    neutral: Color(0xFF6B6256),
  );

  /// Works even under a bare `MaterialApp` (tests, previews) by falling back
  /// to the palette for the current brightness.
  static AppStatusColors of(BuildContext context) {
    final theme = Theme.of(context);
    return theme.extension<AppStatusColors>() ??
        (theme.brightness == Brightness.dark ? dark : light);
  }

  Color foreground(StatusTone tone) => switch (tone) {
    StatusTone.success => success,
    StatusTone.warning => warning,
    StatusTone.info => info,
    StatusTone.teal => teal,
    StatusTone.accent => accent,
    StatusTone.danger => danger,
    StatusTone.neutral => neutral,
  };

  Color background(StatusTone tone) => foreground(tone).withValues(alpha: 0.15);

  @override
  AppStatusColors copyWith({
    Color? success,
    Color? warning,
    Color? info,
    Color? teal,
    Color? accent,
    Color? danger,
    Color? neutral,
  }) => AppStatusColors(
    success: success ?? this.success,
    warning: warning ?? this.warning,
    info: info ?? this.info,
    teal: teal ?? this.teal,
    accent: accent ?? this.accent,
    danger: danger ?? this.danger,
    neutral: neutral ?? this.neutral,
  );

  @override
  AppStatusColors lerp(ThemeExtension<AppStatusColors>? other, double t) {
    if (other is! AppStatusColors) return this;
    return AppStatusColors(
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      info: Color.lerp(info, other.info, t)!,
      teal: Color.lerp(teal, other.teal, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      neutral: Color.lerp(neutral, other.neutral, t)!,
    );
  }
}
