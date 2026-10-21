import '../entities/whatsapp_channel.dart';

abstract class WhatsAppRepository {
  Future<WhatsAppChannel> get();

  Future<WhatsAppChannel> connect(WhatsAppConnectInput input);

  Future<void> disconnect();
}
