class WhatsAppChannel {
  const WhatsAppChannel({
    required this.connected,
    this.phoneNumberId,
    this.wabaId,
    this.displayPhoneNumber,
    this.verifiedName,
    this.connectedAt,
  });

  const WhatsAppChannel.disconnected()
    : connected = false,
      phoneNumberId = null,
      wabaId = null,
      displayPhoneNumber = null,
      verifiedName = null,
      connectedAt = null;

  final bool connected;
  final String? phoneNumberId;
  final String? wabaId;

  final String? displayPhoneNumber;

  final String? verifiedName;

  final DateTime? connectedAt;
}

class WhatsAppConnectInput {
  const WhatsAppConnectInput({
    required this.phoneNumberId,
    required this.accessToken,
    this.wabaId,
  });

  final String phoneNumberId;
  final String accessToken;
  final String? wabaId;
}
