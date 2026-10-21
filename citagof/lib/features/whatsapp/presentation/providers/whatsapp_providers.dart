import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/providers.dart';
import '../../data/repositories/whatsapp_repository_impl.dart';
import '../../domain/entities/whatsapp_channel.dart';
import '../../domain/repositories/whatsapp_repository.dart';
import '../../domain/usecases/whatsapp_usecases.dart';

final whatsAppRepositoryProvider = Provider<WhatsAppRepository>(
  (ref) => WhatsAppRepositoryImpl(ref.watch(dioProvider)),
);

final getWhatsAppChannelUseCaseProvider = Provider(
  (ref) => GetWhatsAppChannelUseCase(ref.watch(whatsAppRepositoryProvider)),
);
final connectWhatsAppChannelUseCaseProvider = Provider(
  (ref) => ConnectWhatsAppChannelUseCase(ref.watch(whatsAppRepositoryProvider)),
);
final disconnectWhatsAppChannelUseCaseProvider = Provider(
  (ref) =>
      DisconnectWhatsAppChannelUseCase(ref.watch(whatsAppRepositoryProvider)),
);

final whatsAppChannelProvider = FutureProvider.autoDispose<WhatsAppChannel>(
  (ref) => ref.watch(getWhatsAppChannelUseCaseProvider)(),
);
