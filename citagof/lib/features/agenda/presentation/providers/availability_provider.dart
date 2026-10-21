import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/availability.dart';
import 'agenda_providers.dart';

class AvailabilityQuery {
  const AvailabilityQuery({
    required this.staffMemberId,
    required this.serviceId,
    required this.date,
  });

  final String staffMemberId;
  final String serviceId;
  final String date;

  @override
  bool operator ==(Object other) =>
      other is AvailabilityQuery &&
      other.staffMemberId == staffMemberId &&
      other.serviceId == serviceId &&
      other.date == date;

  @override
  int get hashCode => Object.hash(staffMemberId, serviceId, date);
}

final availabilityProvider = FutureProvider.autoDispose
    .family<Availability, AvailabilityQuery>(
      (ref, query) => ref.watch(getAvailabilityUseCaseProvider)(
        staffMemberId: query.staffMemberId,
        serviceId: query.serviceId,
        date: query.date,
      ),
    );
