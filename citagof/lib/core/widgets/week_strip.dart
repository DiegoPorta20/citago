import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';
import '../time/business_clock.dart';

/// Seven day tiles, Monday to Sunday, for the week that contains [selected].
/// Swiping sideways moves a week; tapping a tile selects that day.
class WeekStrip extends StatelessWidget {
  const WeekStrip({
    super.key,
    required this.selected,
    required this.today,
    required this.onSelected,
    required this.onPreviousWeek,
    required this.onNextWeek,
  });

  /// `YYYY-MM-DD`.
  final String selected;
  final String today;
  final ValueChanged<String> onSelected;
  final VoidCallback onPreviousWeek;
  final VoidCallback onNextWeek;

  static const _swipeVelocity = 250.0;

  @override
  Widget build(BuildContext context) {
    final days = BusinessClock.weekDays(selected);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onHorizontalDragEnd: (details) {
        final velocity = details.primaryVelocity ?? 0;
        if (velocity > _swipeVelocity) onPreviousWeek();
        if (velocity < -_swipeVelocity) onNextWeek();
      },
      child: Row(
        children: [
          for (var i = 0; i < days.length; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(
              child: _DayTile(
                date: days[i],
                isSelected: days[i] == selected,
                isToday: days[i] == today,
                onTap: () => onSelected(days[i]),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _DayTile extends StatelessWidget {
  const _DayTile({
    required this.date,
    required this.isSelected,
    required this.isToday,
    required this.onTap,
  });

  final String date;
  final bool isSelected;
  final bool isToday;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    final background = isSelected ? scheme.primary : scheme.surfaceContainerLow;
    final border = isSelected
        ? scheme.primary
        : isToday
        ? scheme.primary.withValues(alpha: 0.6)
        : scheme.outlineVariant;
    final dayColor = isSelected
        ? scheme.onPrimary
        : isToday
        ? scheme.primary
        : scheme.onSurface;
    final weekdayColor = isSelected
        ? scheme.onPrimary.withValues(alpha: 0.8)
        : scheme.onSurfaceVariant;

    return Semantics(
      button: true,
      selected: isSelected,
      label: BusinessClock.longDateCapitalized(date) + (isToday ? ', hoy' : ''),
      child: ExcludeSemantics(
        child: Material(
          color: background,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: BorderSide(color: border),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: SizedBox(
              height: 68,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    BusinessClock.weekdayAbbr(date),
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: weekdayColor,
                      fontSize: 10.5,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    '${BusinessClock.dayOf(date)}',
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: dayColor,
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                      fontFeatures: AppText.tabular,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
