import '../../domain/entities/whatsapp_channel.dart';

WhatsAppChannel whatsAppChannelFromJson(Map<String, dynamic> json) {
  final connected = json['connected'] as bool? ?? false;
  if (!connected) return const WhatsAppChannel.disconnected();
  return WhatsAppChannel(
    connected: true,
    phoneNumberId: json['phoneNumberId'] as String?,
    wabaId: json['wabaId'] as String?,
    displayPhoneNumber: json['displayPhoneNumber'] as String?,
    verifiedName: json['verifiedName'] as String?,
    connectedAt: _parseInstant(json['connectedAt'] as String?),
  );
}

Map<String, dynamic> connectBody(WhatsAppConnectInput input) => {
  'phoneNumberId': input.phoneNumberId.trim(),
  'accessToken': input.accessToken,
  if ((input.wabaId ?? '').trim().isNotEmpty) 'wabaId': input.wabaId!.trim(),
};

DateTime? _parseInstant(String? value) =>
    value == null ? null : DateTime.parse(value).toUtc();
