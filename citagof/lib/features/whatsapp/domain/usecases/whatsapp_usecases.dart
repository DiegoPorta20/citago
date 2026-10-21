import '../entities/whatsapp_channel.dart';
import '../repositories/whatsapp_repository.dart';

class GetWhatsAppChannelUseCase {
  const GetWhatsAppChannelUseCase(this._repository);

  final WhatsAppRepository _repository;

  Future<WhatsAppChannel> call() => _repository.get();
}

class ConnectWhatsAppChannelUseCase {
  const ConnectWhatsAppChannelUseCase(this._repository);

  final WhatsAppRepository _repository;

  Future<WhatsAppChannel> call(WhatsAppConnectInput input) =>
      _repository.connect(input);
}

class DisconnectWhatsAppChannelUseCase {
  const DisconnectWhatsAppChannelUseCase(this._repository);

  final WhatsAppRepository _repository;

  Future<void> call() => _repository.disconnect();
}
