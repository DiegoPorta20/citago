String formatMoney(String amount, String currency) {
  final negative = amount.startsWith('-');
  final unsigned = negative ? amount.substring(1) : amount;
  final parts = unsigned.split('.');
  final whole = parts.first.isEmpty ? '0' : parts.first;
  final fraction = parts.length > 1 ? parts[1] : '';
  final cents = '${fraction}00'.substring(0, 2);

  final grouped = StringBuffer();
  for (var i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) grouped.write(',');
    grouped.write(whole[i]);
  }

  final symbol = _symbols[currency] ?? currency;
  return '${negative ? '-' : ''}$symbol ${grouped.toString()}.$cents';
}

const _symbols = {
  'PEN': 'S/',
  'USD': r'US$',
  'MXN': r'MX$',
  'COP': r'COP$',
  'ARS': r'AR$',
  'CLP': r'CLP$',
  'EUR': '€',
};
