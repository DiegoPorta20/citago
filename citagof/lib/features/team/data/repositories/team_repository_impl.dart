import 'package:dio/dio.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/network/api_response.dart';
import '../../../authentication/domain/entities/auth_session.dart';
import '../../domain/entities/team_member.dart';
import '../../domain/repositories/team_repository.dart';
import '../models/team_member_model.dart';

class TeamRepositoryImpl implements TeamRepository {
  const TeamRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<TeamMember>> list() => _guard(() async {
    final response = await _dio.get<dynamic>('/users');
    return _unwrapList(response, teamMemberFromJson);
  });

  @override
  Future<AddedTeamMember> add(TeamMemberInput input) => _guard(() async {
    final response = await _dio.post<dynamic>(
      '/users',
      data: addTeamMemberBody(input),
    );
    return addedTeamMemberFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<TeamMember> changeRole(String membershipId, UserRole role) =>
      _guard(() async {
        final response = await _dio.patch<dynamic>(
          '/users/$membershipId',
          data: changeRoleBody(role),
        );
        return teamMemberFromJson(unwrapData<Map<String, dynamic>>(response));
      });

  @override
  Future<TeamMember> revoke(String membershipId) => _guard(() async {
    final response = await _dio.post<dynamic>('/users/$membershipId/revoke');
    return teamMemberFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  @override
  Future<TeamMember> restore(String membershipId) => _guard(() async {
    final response = await _dio.post<dynamic>('/users/$membershipId/restore');
    return teamMemberFromJson(unwrapData<Map<String, dynamic>>(response));
  });

  List<T> _unwrapList<T>(
    Response<dynamic> response,
    T Function(Map<String, dynamic> json) parse,
  ) {
    final body = response.data;
    if (body is! Map<String, dynamic> || body['data'] is! List<dynamic>) {
      throw const AppFailure(message: 'Respuesta inesperada del servidor.');
    }
    return [
      for (final row in body['data'] as List<dynamic>)
        parse(row as Map<String, dynamic>),
    ];
  }

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
