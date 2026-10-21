class BusinessCountry {
  const BusinessCountry({
    required this.code,
    required this.name,
    required this.currency,
    required this.timezone,
  });

  final String code;
  final String name;

  final String currency;

  final String timezone;
}

const List<BusinessCountry> supportedCountries = [
  BusinessCountry(
    code: 'PE',
    name: 'Perú',
    currency: 'PEN',
    timezone: 'America/Lima',
  ),
  BusinessCountry(
    code: 'MX',
    name: 'México',
    currency: 'MXN',
    timezone: 'America/Mexico_City',
  ),
  BusinessCountry(
    code: 'CO',
    name: 'Colombia',
    currency: 'COP',
    timezone: 'America/Bogota',
  ),
  BusinessCountry(
    code: 'AR',
    name: 'Argentina',
    currency: 'ARS',
    timezone: 'America/Argentina/Buenos_Aires',
  ),
  BusinessCountry(
    code: 'CL',
    name: 'Chile',
    currency: 'CLP',
    timezone: 'America/Santiago',
  ),
  BusinessCountry(
    code: 'ES',
    name: 'España',
    currency: 'EUR',
    timezone: 'Europe/Madrid',
  ),
  BusinessCountry(
    code: 'US',
    name: 'Estados Unidos (este)',
    currency: 'USD',
    timezone: 'America/New_York',
  ),
];

const int minPasswordLength = 10;

class BusinessRegistration {
  const BusinessRegistration({
    required this.businessName,
    required this.ownerName,
    required this.ownerEmail,
    required this.password,
    required this.country,
  });

  final String businessName;
  final String ownerName;
  final String ownerEmail;
  final String password;
  final BusinessCountry country;
}
