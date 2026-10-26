import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../agenda/presentation/providers/upcoming_appointments_provider.dart';
import '../../../conversations/presentation/providers/pending_conversations_provider.dart';
import 'dashboard_providers.dart';

/// Marks everything the home screen shows as out of date.
///
/// The shell keeps every tab alive, so the home screen never rebuilds on its
/// own: whoever changes appointments, sales or conversations calls this, and
/// the tab itself calls it when the user comes back to it.
void refreshHome(WidgetRef ref) {
  ref.invalidate(businessDashboardProvider);
  ref.invalidate(ownDashboardProvider);
  ref.invalidate(upcomingAppointmentsProvider);
  ref.invalidate(pendingConversationsCountProvider);
}
