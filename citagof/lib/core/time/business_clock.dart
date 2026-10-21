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

  static (int, int, int) _parse(String date) {
    final p = date.split('-');
    return (int.parse(p[0]), int.parse(p[1]), int.parse(p[2]));
  }

  static String _ymd(int y, int m, int d) => '$y-${_two(m)}-${_two(d)}';

  static String _two(int n) => n.toString().padLeft(2, '0');
}
