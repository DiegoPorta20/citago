import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/providers.dart';
import '../../data/repositories/staff_repository_impl.dart';
import '../../domain/entities/staff_member.dart';
import '../../domain/repositories/staff_repository.dart';
import '../../domain/usecases/staff_usecases.dart';

final staffRepositoryProvider = Provider<StaffRepository>(
  (ref) => StaffRepositoryImpl(ref.watch(dioProvider)),
);

final listStaffUseCaseProvider = Provider(
  (ref) => ListStaffUseCase(ref.watch(staffRepositoryProvider)),
);
final getStaffUseCaseProvider = Provider(
  (ref) => GetStaffUseCase(ref.watch(staffRepositoryProvider)),
);
final createStaffUseCaseProvider = Provider(
  (ref) => CreateStaffUseCase(ref.watch(staffRepositoryProvider)),
);
final updateStaffUseCaseProvider = Provider(
  (ref) => UpdateStaffUseCase(ref.watch(staffRepositoryProvider)),
);
final setStaffStatusUseCaseProvider = Provider(
  (ref) => SetStaffStatusUseCase(ref.watch(staffRepositoryProvider)),
);
final replaceScheduleUseCaseProvider = Provider(
  (ref) => ReplaceScheduleUseCase(ref.watch(staffRepositoryProvider)),
);
final listTimeOffUseCaseProvider = Provider(
  (ref) => ListTimeOffUseCase(ref.watch(staffRepositoryProvider)),
);
final addTimeOffUseCaseProvider = Provider(
  (ref) => AddTimeOffUseCase(ref.watch(staffRepositoryProvider)),
);
final removeTimeOffUseCaseProvider = Provider(
  (ref) => RemoveTimeOffUseCase(ref.watch(staffRepositoryProvider)),
);

final staffListProvider = FutureProvider.autoDispose<List<StaffMember>>(
  (ref) => ref.watch(listStaffUseCaseProvider)(),
);

final activeStaffProvider = FutureProvider.autoDispose<List<StaffMember>>((
  ref,
) async {
  final all = await ref.watch(staffListProvider.future);
  return all.where((member) => member.active).toList();
});

final staffDetailProvider = FutureProvider.autoDispose
    .family<StaffMember, String>(
      (ref, id) => ref.watch(getStaffUseCaseProvider)(id),
    );

final staffTimeOffProvider = FutureProvider.autoDispose
    .family<List<TimeOff>, TimeOffQuery>(
      (ref, query) => ref.watch(listTimeOffUseCaseProvider)(
        query.staffMemberId,
        from: query.from,
        to: query.to,
      ),
    );

class TimeOffQuery {
  const TimeOffQuery({
    required this.staffMemberId,
    required this.from,
    required this.to,
  });

  final String staffMemberId;
  final DateTime from;
  final DateTime to;

  @override
  bool operator ==(Object other) =>
      other is TimeOffQuery &&
      other.staffMemberId == staffMemberId &&
      other.from == from &&
      other.to == to;

  @override
  int get hashCode => Object.hash(staffMemberId, from, to);
}

void invalidateStaff(Ref ref, {String? id}) {
  ref.invalidate(staffListProvider);
  ref.invalidate(activeStaffProvider);
  if (id != null) ref.invalidate(staffDetailProvider(id));
}

void invalidateStaffFrom(WidgetRef ref, {String? id}) {
  ref.invalidate(staffListProvider);
  ref.invalidate(activeStaffProvider);
  if (id != null) ref.invalidate(staffDetailProvider(id));
}
