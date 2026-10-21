import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/providers.dart';
import '../../../../core/time/business_clock.dart';
import '../../data/datasources/auth_remote_datasource.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/auth_session.dart';
import '../../domain/entities/business_registration.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../domain/usecases/auth_usecases.dart';

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepositoryImpl(
    AuthRemoteDataSource(ref.watch(dioProvider)),
    ref.watch(tokenStorageProvider),
  ),
);

final loginUseCaseProvider = Provider(
  (ref) => LoginUseCase(ref.watch(authRepositoryProvider)),
);

final registerBusinessUseCaseProvider = Provider(
  (ref) => RegisterBusinessUseCase(ref.watch(authRepositoryProvider)),
);

final listTenantsUseCaseProvider = Provider(
  (ref) => ListTenantsUseCase(ref.watch(authRepositoryProvider)),
);

final switchTenantUseCaseProvider = Provider(
  (ref) => SwitchTenantUseCase(ref.watch(authRepositoryProvider)),
);

final myTenantsProvider = FutureProvider.autoDispose<List<TenantChoice>>(
  (ref) => ref.watch(listTenantsUseCaseProvider)(),
);

final restoreSessionUseCaseProvider = Provider(
  (ref) => RestoreSessionUseCase(ref.watch(authRepositoryProvider)),
);

final logoutUseCaseProvider = Provider(
  (ref) => LogoutUseCase(ref.watch(authRepositoryProvider)),
);

class SessionController extends AsyncNotifier<AuthSession?> {
  @override
  Future<AuthSession?> build() {
    ref.listen(
      sessionExpiredSignalProvider,
      (_, _) => state = const AsyncData(null),
    );
    return ref.read(restoreSessionUseCaseProvider)();
  }

  void signedIn(AuthSession session) => state = AsyncData(session);

  Future<void> signOut() async {
    await ref.read(logoutUseCaseProvider)();
    state = const AsyncData(null);
  }

  Future<void> retry() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      ref.read(restoreSessionUseCaseProvider).call,
    );
  }
}

final sessionControllerProvider =
    AsyncNotifierProvider<SessionController, AuthSession?>(
      SessionController.new,
    );

class LoginController extends AsyncNotifier<void> {
  @override
  Future<void> build() async {}

  Future<void> submit({required String email, required String password}) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final session = await ref.read(loginUseCaseProvider)(
        email: email,
        password: password,
      );
      ref.read(sessionControllerProvider.notifier).signedIn(session);
    });
  }
}

final loginControllerProvider = AsyncNotifierProvider<LoginController, void>(
  LoginController.new,
);

class RegisterController extends AsyncNotifier<void> {
  @override
  Future<void> build() async {}

  Future<void> submit(BusinessRegistration registration) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final session = await ref.read(registerBusinessUseCaseProvider)(
        registration,
      );
      ref.read(sessionControllerProvider.notifier).signedIn(session);
    });
  }
}

final registerControllerProvider =
    AsyncNotifierProvider<RegisterController, void>(RegisterController.new);

final businessClockProvider = Provider<BusinessClock>((ref) {
  final session = ref.watch(sessionControllerProvider).value;
  if (session == null) {
    throw StateError('businessClockProvider requires a signed-in session');
  }
  return BusinessClock(session.tenant.timezone);
});
