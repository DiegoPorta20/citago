import 'package:dio/dio.dart';

import '../../../../core/network/api_response.dart';
import '../../domain/entities/whatsapp_channel.dart';
import '../../domain/repositories/whatsapp_repository.dart';
import '../models/whatsapp_channel_model.dart';

class WhatsAppRepositoryImpl implements WhatsAppRepository {
  const WhatsAppRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<WhatsAppChannel> get() => _guard(() async {
    final response = await _dio.get<dynamic>('/whatsapp/channel');
    return whatsAppChannelFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<WhatsAppChannel> connect(WhatsAppConnectInput input) =>
      _guard(() async {
        final response = await _dio.put<dynamic>(
          '/whatsapp/channel',
          data: connectBody(input),
        );
        return whatsAppChannelFromJson(
          unwrapData<Map<String, dynamic>>(response),
        );
      });

  @override
  Future<void> disconnect() => _guard(() async {
    await _dio.delete<dynamic>('/whatsapp/channel');
  });

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
