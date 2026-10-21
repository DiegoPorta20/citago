class Money {
  const Money(this.cents);

  final int cents;

  static const Money zero = Money(0);

  factory Money.parse(String amount) {
    final trimmed = amount.trim();
    if (trimmed.isEmpty) {
      throw const FormatException('Empty money string');
    }
    final negative = trimmed.startsWith('-');
    final unsigned = negative ? trimmed.substring(1) : trimmed;
    if (!RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(unsigned)) {
      throw FormatException('Invalid money string: $amount');
    }
    final parts = unsigned.split('.');
    final whole = int.parse(parts[0]);
    final fraction = parts.length > 1 ? parts[1].padRight(2, '0') : '00';
    final value = whole * 100 + int.parse(fraction);
    return Money(negative ? -value : value);
  }

  static Money? tryParse(String amount) {
    try {
      return Money.parse(amount);
    } on FormatException {
      return null;
    }
  }

  Money operator +(Money other) => Money(cents + other.cents);
  Money operator -(Money other) => Money(cents - other.cents);
  Money operator *(int quantity) => Money(cents * quantity);

  bool operator >(Money other) => cents > other.cents;
  bool operator <(Money other) => cents < other.cents;
  bool operator >=(Money other) => cents >= other.cents;
  bool operator <=(Money other) => cents <= other.cents;

  bool get isNegative => cents < 0;
  bool get isZero => cents == 0;

  @override
  bool operator ==(Object other) => other is Money && other.cents == cents;

  @override
  int get hashCode => cents.hashCode;

  String toDecimalString() {
    final negative = cents < 0;
    final abs = cents.abs();
    final whole = abs ~/ 100;
    final fraction = (abs % 100).toString().padLeft(2, '0');
    return '${negative ? '-' : ''}$whole.$fraction';
  }

  @override
  String toString() => toDecimalString();
}
