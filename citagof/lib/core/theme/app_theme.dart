import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_status_colors.dart';
import 'app_tokens.dart';

/// CitaGo design system: warm charcoal surfaces with a brushed-gold accent in
/// dark mode, and warm paper with bronze in light mode. Typography is Inter,
/// bundled as an asset.
class AppTheme {
  const AppTheme._();

  static const fontFamily = 'Inter';

  static ThemeData light() => _build(_lightScheme, AppStatusColors.light);

  static ThemeData dark() => _build(_darkScheme, AppStatusColors.dark);

  // ── Palettes ──────────────────────────────────────────────────────────────

  static const _darkScheme = ColorScheme(
    brightness: Brightness.dark,
    primary: Color(0xFFD9AE55),
    onPrimary: Color(0xFF1C1405),
    primaryContainer: Color(0xFF3A2D12),
    onPrimaryContainer: Color(0xFFF3DA9E),
    secondary: Color(0xFFC9B79A),
    onSecondary: Color(0xFF241C0F),
    secondaryContainer: Color(0xFF2D2720),
    onSecondaryContainer: Color(0xFFE9DEC9),
    tertiary: Color(0xFF7FB8A9),
    onTertiary: Color(0xFF07261F),
    tertiaryContainer: Color(0xFF173A32),
    onTertiaryContainer: Color(0xFFBDEBDD),
    error: Color(0xFFF08A7C),
    onError: Color(0xFF3B0A05),
    errorContainer: Color(0xFF4A1C16),
    onErrorContainer: Color(0xFFFFD2CB),
    surface: Color(0xFF100E0C),
    onSurface: Color(0xFFF4EFE8),
    onSurfaceVariant: Color(0xFFA8A097),
    surfaceContainerLowest: Color(0xFF0B0A08),
    surfaceContainerLow: Color(0xFF181512),
    surfaceContainer: Color(0xFF1E1A16),
    surfaceContainerHigh: Color(0xFF26211C),
    surfaceContainerHighest: Color(0xFF2F2923),
    outline: Color(0xFF5A5148),
    outlineVariant: Color(0xFF2E2923),
    inverseSurface: Color(0xFFF4EFE8),
    onInverseSurface: Color(0xFF1C1814),
    inversePrimary: Color(0xFF8A5B12),
    shadow: Color(0xFF000000),
    scrim: Color(0xFF000000),
    surfaceTint: Colors.transparent,
  );

  static const _lightScheme = ColorScheme(
    brightness: Brightness.light,
    primary: Color(0xFF8A5B12),
    onPrimary: Color(0xFFFFFFFF),
    primaryContainer: Color(0xFFF7E4BC),
    onPrimaryContainer: Color(0xFF3B2705),
    secondary: Color(0xFF6B5A3E),
    onSecondary: Color(0xFFFFFFFF),
    secondaryContainer: Color(0xFFEFE6D6),
    onSecondaryContainer: Color(0xFF2B2113),
    tertiary: Color(0xFF2F6F62),
    onTertiary: Color(0xFFFFFFFF),
    tertiaryContainer: Color(0xFFC9EEE2),
    onTertiaryContainer: Color(0xFF0B2F27),
    error: Color(0xFFB3261E),
    onError: Color(0xFFFFFFFF),
    errorContainer: Color(0xFFFADAD5),
    onErrorContainer: Color(0xFF410E0B),
    surface: Color(0xFFF7F4EF),
    onSurface: Color(0xFF1B1713),
    onSurfaceVariant: Color(0xFF6B6256),
    surfaceContainerLowest: Color(0xFFFFFFFF),
    surfaceContainerLow: Color(0xFFFFFFFF),
    surfaceContainer: Color(0xFFF1EDE6),
    surfaceContainerHigh: Color(0xFFEBE5DB),
    surfaceContainerHighest: Color(0xFFE3DCD0),
    outline: Color(0xFFB8AE9E),
    outlineVariant: Color(0xFFE6DFD3),
    inverseSurface: Color(0xFF2B2620),
    onInverseSurface: Color(0xFFF4EFE8),
    inversePrimary: Color(0xFFD9AE55),
    shadow: Color(0xFF000000),
    scrim: Color(0xFF000000),
    surfaceTint: Colors.transparent,
  );

  // ── Typography ────────────────────────────────────────────────────────────

  static TextTheme _textTheme(ColorScheme scheme) {
    TextStyle style(
      double size,
      FontWeight weight, {
      double height = 1.35,
      double spacing = 0,
      Color? color,
    }) => TextStyle(
      fontFamily: fontFamily,
      fontSize: size,
      fontWeight: weight,
      height: height,
      letterSpacing: spacing,
      color: color ?? scheme.onSurface,
    );

    return TextTheme(
      displayLarge: style(40, FontWeight.w700, height: 1.15, spacing: -1),
      displayMedium: style(34, FontWeight.w700, height: 1.15, spacing: -0.8),
      displaySmall: style(30, FontWeight.w700, height: 1.15, spacing: -0.6),
      headlineLarge: style(28, FontWeight.w700, height: 1.2, spacing: -0.5),
      headlineMedium: style(24, FontWeight.w700, height: 1.25, spacing: -0.4),
      headlineSmall: style(20, FontWeight.w700, height: 1.3, spacing: -0.2),
      titleLarge: style(18, FontWeight.w600, height: 1.3, spacing: -0.1),
      titleMedium: style(16, FontWeight.w600, height: 1.35),
      titleSmall: style(14, FontWeight.w600, height: 1.35),
      bodyLarge: style(16, FontWeight.w400, height: 1.45),
      bodyMedium: style(14, FontWeight.w400, height: 1.45),
      bodySmall: style(
        12.5,
        FontWeight.w400,
        height: 1.4,
        color: scheme.onSurfaceVariant,
      ),
      labelLarge: style(14, FontWeight.w600, height: 1.2, spacing: 0.1),
      labelMedium: style(
        12,
        FontWeight.w600,
        height: 1.2,
        spacing: 0.2,
        color: scheme.onSurfaceVariant,
      ),
      labelSmall: style(
        11,
        FontWeight.w600,
        height: 1.2,
        spacing: 0.4,
        color: scheme.onSurfaceVariant,
      ),
    );
  }

  // ── Theme assembly ────────────────────────────────────────────────────────

  static ThemeData _build(ColorScheme scheme, AppStatusColors status) {
    final text = _textTheme(scheme);
    final isDark = scheme.brightness == Brightness.dark;
    final controlShape = RoundedRectangleBorder(
      borderRadius: AppRadius.controlBorder,
    );
    final hairline = BorderSide(color: scheme.outlineVariant);

    return ThemeData(
      useMaterial3: true,
      brightness: scheme.brightness,
      colorScheme: scheme,
      fontFamily: fontFamily,
      textTheme: text,
      scaffoldBackgroundColor: scheme.surface,
      canvasColor: scheme.surface,
      visualDensity: VisualDensity.standard,
      splashFactory: InkSparkle.splashFactory,
      extensions: [status],
      dividerTheme: DividerThemeData(
        color: scheme.outlineVariant,
        thickness: 1,
        space: 1,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleSpacing: AppSpacing.page,
        titleTextStyle: text.headlineSmall,
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
          statusBarBrightness: isDark ? Brightness.dark : Brightness.light,
        ),
      ),
      cardTheme: CardThemeData(
        color: scheme.surfaceContainerLow,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.cardBorder,
          side: hairline,
        ),
      ),
      listTileTheme: ListTileThemeData(
        contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.l),
        iconColor: scheme.onSurfaceVariant,
        titleTextStyle: text.bodyLarge?.copyWith(fontWeight: FontWeight.w500),
        subtitleTextStyle: text.bodyMedium?.copyWith(
          color: scheme.onSurfaceVariant,
        ),
        shape: controlShape,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: controlShape,
          textStyle: text.labelLarge?.copyWith(fontSize: 15),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(64, 52),
          shape: controlShape,
          side: BorderSide(color: scheme.outline),
          foregroundColor: scheme.onSurface,
          textStyle: text.labelLarge?.copyWith(fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(48, 44),
          shape: controlShape,
          foregroundColor: scheme.primary,
          textStyle: text.labelLarge,
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          minimumSize: const Size(44, 44),
          foregroundColor: scheme.onSurface,
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: scheme.primary,
        foregroundColor: scheme.onPrimary,
        elevation: 0,
        highlightElevation: 0,
        extendedTextStyle: text.labelLarge?.copyWith(fontSize: 15),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
      chipTheme: ChipThemeData(
        showCheckmark: false,
        backgroundColor: Colors.transparent,
        selectedColor: scheme.primaryContainer,
        disabledColor: scheme.surfaceContainer,
        side: hairline,
        labelStyle: text.labelLarge?.copyWith(
          fontWeight: FontWeight.w500,
          color: scheme.onSurfaceVariant,
        ),
        secondaryLabelStyle: text.labelLarge?.copyWith(
          color: scheme.onPrimaryContainer,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.chip),
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: SegmentedButton.styleFrom(
          minimumSize: const Size(0, 44),
          shape: controlShape,
          side: hairline,
          textStyle: text.labelLarge,
          selectedBackgroundColor: scheme.primaryContainer,
          selectedForegroundColor: scheme.onPrimaryContainer,
          foregroundColor: scheme.onSurfaceVariant,
        ),
        selectedIcon: const SizedBox.shrink(),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 70,
        elevation: 0,
        backgroundColor: scheme.surfaceContainerLow,
        surfaceTintColor: Colors.transparent,
        indicatorColor: scheme.primaryContainer,
        indicatorShape: const StadiumBorder(),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 24,
            color: states.contains(WidgetState.selected)
                ? scheme.onPrimaryContainer
                : scheme.onSurfaceVariant,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => text.labelMedium?.copyWith(
            fontSize: 11.5,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w700
                : FontWeight.w500,
            color: states.contains(WidgetState.selected)
                ? scheme.onSurface
                : scheme.onSurfaceVariant,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surfaceContainerLow,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.l,
          vertical: AppSpacing.l,
        ),
        labelStyle: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
        hintStyle: text.bodyMedium?.copyWith(
          color: scheme.onSurfaceVariant.withValues(alpha: 0.7),
        ),
        border: OutlineInputBorder(
          borderRadius: AppRadius.controlBorder,
          borderSide: hairline,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.controlBorder,
          borderSide: BorderSide(color: scheme.outline.withValues(alpha: 0.6)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.controlBorder,
          borderSide: BorderSide(color: scheme.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadius.controlBorder,
          borderSide: BorderSide(color: scheme.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadius.controlBorder,
          borderSide: BorderSide(color: scheme.error, width: 1.5),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: scheme.surfaceContainerHigh,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.sheet),
        ),
        titleTextStyle: text.titleLarge,
        contentTextStyle: text.bodyMedium?.copyWith(
          color: scheme.onSurfaceVariant,
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: scheme.surfaceContainerHigh,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadius.sheet),
          ),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: scheme.inverseSurface,
        contentTextStyle: text.bodyMedium?.copyWith(
          color: scheme.onInverseSurface,
        ),
        shape: controlShape,
      ),
      badgeTheme: BadgeThemeData(
        backgroundColor: scheme.error,
        textColor: scheme.onError,
        textStyle: text.labelSmall?.copyWith(
          color: scheme.onError,
          fontWeight: FontWeight.w700,
        ),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: scheme.primary,
        linearTrackColor: scheme.surfaceContainerHighest,
        circularTrackColor: Colors.transparent,
      ),
      switchTheme: SwitchThemeData(
        trackOutlineColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? Colors.transparent
              : scheme.outline,
        ),
      ),
    );
  }
}
