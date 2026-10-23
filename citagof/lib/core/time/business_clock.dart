import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

void initializeBusinessTime() => tzdata.initializeTimeZones();

const _weekdays = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
];

const _weekdaysAbbr = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

const _months = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

class BusinessClock {
  BusinessClock(String timezone, {DateTime Function()? now})
    : _location = tz.getLocation(timezone),
      _now = now ?? DateTime.now;

  final tz.Location _location;
  final DateTime Function() _now;

  String today() => dateOf(_now());

  String dateOf(DateTime instant) {
    final local = tz.TZDateTime.from(instant, _location);
    return _ymd(local.year, local.month, local.day);
  }

  String timeOf(DateTime instant) {
    final local = tz.TZDateTime.from(instant, _location);
    return '${_two(local.hour)}:${_two(local.minute)}';
  }

  ({DateTime from, DateTime to}) dayRangeUtc(String date) {
    final (y, m, d) = _parse(date);
    return (
      from: tz.TZDateTime(_location, y, m, d).toUtc(),
      to: tz.TZDateTime(_location, y, m, d + 1).toUtc(),
    );
  }

  DateTime instantOf(String date, String time) {
    final (y, m, d) = _parse(date);
    final parts = time.split(':');
    return tz.TZDateTime(
      _location,
      y,
      m,
      d,
      int.parse(parts[0]),
      int.parse(parts[1]),
    ).toUtc();
  }

  String addDays(String date, int days) {
    final (y, m, d) = _parse(date);
    final shifted = DateTime.utc(y, m, d + days);
    return _ymd(shifted.year, shifted.month, shifted.day);
  }

  static String longDate(String date) {
    final (y, m, d) = _parse(date);
    final weekday = DateTime.utc(y, m, d).weekday;
    return '${_weekdays[weekday - 1]} $d de ${_months[m - 1]}';
  }

  // ── Calendar arithmetic on `YYYY-MM-DD` strings ─────────────────────────
  //
  // Business dates are plain calendar days, so none of this depends on the
  // phone's zone or on DST. Weeks run Monday to Sunday.

  /// Hour of day (0-23) in the business zone.
  int hourNow() => tz.TZDateTime.from(_now(), _location).hour;

  /// 1 = Monday ... 7 = Sunday.
  static int weekdayOf(String date) {
    final (y, m, d) = _parse(date);
    return DateTime.utc(y, m, d).weekday;
  }

  static int dayOf(String date) => _parse(date).$3;

  static String startOfWeek(String date) => _shift(date, 1 - weekdayOf(date));

  static String endOfWeek(String date) => _shift(date, 7 - weekdayOf(date));

  /// The seven days (Monday first) of the week that contains [date].
  static List<String> weekDays(String date) {
    final monday = startOfWeek(date);
    return [for (var i = 0; i < 7; i++) _shift(monday, i)];
  }

  static String startOfMonth(String date) {
    final (y, m, _) = _parse(date);
    return _ymd(y, m, 1);
  }

  static String endOfMonth(String date) {
    final (y, m, _) = _parse(date);
    final last = DateTime.utc(y, m + 1, 0);
    return _ymd(last.year, last.month, last.day);
  }

  /// Moves [date] by whole months, clamping the day (Jan 31 + 1 → Feb 28).
  static String addMonths(String date, int months) {
    final (y, m, d) = _parse(date);
    final target = DateTime.utc(y, m + months, 1);
    final lastDay = DateTime.utc(target.year, target.month + 1, 0).day;
    return _ymd(target.year, target.month, d > lastDay ? lastDay : d);
  }

  static bool sameWeek(String a, String b) => startOfWeek(a) == startOfWeek(b);

  static bool sameMonth(String a, String b) =>
      startOfMonth(a) == startOfMonth(b);

  // ── Labels ──────────────────────────────────────────────────────────────

  /// `LUN`, `MAR`, ... for week strips.
  static String weekdayAbbr(String date) => _weekdaysAbbr[weekdayOf(date) - 1];

  /// `lun`, `mar`, ... (lowercase, for running text).
  static String weekdayShort(String date) =>
      _weekdays[weekdayOf(date) - 1].substring(0, 3);

  /// `Jueves 22 de octubre`.
  static String longDateCapitalized(String date) => capitalize(longDate(date));

  /// `22 oct`.
  static String shortDate(String date) {
    final (_, m, d) = _parse(date);
    return '$d ${_months[m - 1].substring(0, 3)}';
  }

  /// `jue 22 oct`.
  static String weekdayAndShortDate(String date) =>
      '${weekdayShort(date)} ${shortDate(date)}';

  /// `Octubre 2026`.
  static String monthYear(String date) {
    final (y, m, _) = _parse(date);
    return '${capitalize(_months[m - 1])} $y';
  }

  /// `19 – 25 oct`, or `29 oct – 4 nov` when the week spans two months.
  static String weekRangeLabel(String date) {
    final start = startOfWeek(date);
    final end = endOfWeek(date);
    final (_, sm, sd) = _parse(start);
    final (_, em, ed) = _parse(end);
    if (sm == em) return '$sd – $ed ${_months[em - 1].substring(0, 3)}';
    return '${shortDate(start)} – ${shortDate(end)}';
  }

  /// `Hoy`, `Mañana`, `Ayer` or `vie 23 oct`.
  String dayLabel(String date) {
    final today = this.today();
    if (date == today) return 'Hoy';
    if (date == addDays(today, 1)) return 'Mañana';
    if (date == addDays(today, -1)) return 'Ayer';
    return weekdayAndShortDate(date);
  }

  static String capitalize(String text) =>
      text.isEmpty ? text : text[0].toUpperCase() + text.substring(1);

  /// Bridges to Flutter date pickers, which speak `DateTime`. Only the
  /// year/month/day are meaningful; the zone is never used.
  static DateTime toCalendarDate(String date) {
    final (y, m, d) = _parse(date);
    return DateTime(y, m, d);
  }

  static String fromCalendarDate(DateTime date) =>
      _ymd(date.year, date.month, date.day);

  static String _shift(String date, int days) {
    final (y, m, d) = _parse(date);
    final shifted = DateTime.utc(y, m, d + days);
    return _ymd(shifted.year, shifted.month, shifted.day);
  }

  static (int, int, int) _parse(String date) {
    final p = date.split('-');
    return (int.parse(p[0]), int.parse(p[1]), int.parse(p[2]));
  }

  static String _ymd(int y, int m, int d) => '$y-${_two(m)}-${_two(d)}';

  static String _two(int n) => n.toString().padLeft(2, '0');
}
