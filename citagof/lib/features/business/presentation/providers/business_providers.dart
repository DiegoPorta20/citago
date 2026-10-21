import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/providers.dart';
import '../../data/repositories/business_repository_impl.dart';
import '../../domain/entities/business.dart';
import '../../domain/repositories/business_repository.dart';
import '../../domain/usecases/business_usecases.dart';

final businessRepositoryProvider = Provider<BusinessRepository>(
  (ref) => BusinessRepositoryImpl(ref.watch(dioProvider)),
);

final getBusinessUseCaseProvider = Provider(
  (ref) => GetBusinessUseCase(ref.watch(businessRepositoryProvider)),
);
final updateBusinessUseCaseProvider = Provider(
  (ref) => UpdateBusinessUseCase(ref.watch(businessRepositoryProvider)),
);
final replaceBusinessHoursUseCaseProvider = Provider(
  (ref) => ReplaceBusinessHoursUseCase(ref.watch(businessRepositoryProvider)),
);

final businessProvider = FutureProvider.autoDispose<Business>(
  (ref) => ref.watch(getBusinessUseCaseProvider)(),
);
