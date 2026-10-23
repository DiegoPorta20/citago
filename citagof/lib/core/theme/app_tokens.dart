import 'package:flutter/widgets.dart';

/// Spacing scale (logical pixels). Every gap in the UI comes from here so
/// screens share one rhythm.
class AppSpacing {
  const AppSpacing._();

  static const double xs = 4;
  static const double s = 8;
  static const double m = 12;
  static const double l = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;

  /// Horizontal gutter shared by every page.
  static const double page = 20;
}

/// Corner radii. Cards use [card], controls use [control], pills are full.
class AppRadius {
  const AppRadius._();

  static const double chip = 12;
  static const double control = 14;
  static const double card = 20;
  static const double sheet = 28;
  static const double pill = 999;

  static BorderRadius get cardBorder => BorderRadius.circular(card);
  static BorderRadius get controlBorder => BorderRadius.circular(control);
}

/// Type helpers that are not part of [TextTheme].
class AppText {
  const AppText._();

  /// Equal-width digits: times and money line up in columns.
  static const List<FontFeature> tabular = [FontFeature.tabularFigures()];
}
