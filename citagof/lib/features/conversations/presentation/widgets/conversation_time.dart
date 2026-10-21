import '../../../../core/time/business_clock.dart';

const _shortMonths = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

String inboxTimeLabel(DateTime instant, BusinessClock clock) {
  final date = clock.dateOf(instant);
  if (date == clock.today()) {
    return clock.timeOf(instant);
  }
  final parts = date.split('-');
  final year = int.parse(parts[0]);
  final month = int.parse(parts[1]);
  final day = int.parse(parts[2]);
  final thisYear = int.parse(clock.today().split('-')[0]);
  final short = '$day ${_shortMonths[month - 1]}';
  return year == thisYear ? short : '$short $year';
}
