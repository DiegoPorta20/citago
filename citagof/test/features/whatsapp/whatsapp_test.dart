import 'package:citagof/core/time/business_clock.dart';
import 'package:citagof/features/authentication/domain/entities/auth_session.dart';
import 'package:citagof/features/authentication/presentation/providers/auth_providers.dart';
import 'package:citagof/features/whatsapp/data/models/whatsapp_channel_model.dart';
import 'package:citagof/features/whatsapp/domain/entities/whatsapp_channel.dart';
import 'package:citagof/features/whatsapp/domain/repositories/whatsapp_repository.dart';
import 'package:citagof/features/whatsapp/presentation/providers/whatsapp_providers.dart';
import 'package:citagof/features/whatsapp/presentation/whatsapp_routes.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class FakeWhatsAppRepository implements WhatsAppRepository {
  FakeWhatsAppRepository({WhatsAppChannel? channel})
    : channel = channel ?? const WhatsAppChannel.disconnected();

  WhatsAppChannel channel;
  final List<String> calls = [];
  WhatsAppConnectInput? connectInput;

  @override
  Future<WhatsAppChannel> get() async {
    calls.add('get');
    return channel;
  }

  @override
  Future<WhatsAppChannel> connect(WhatsAppConnectInput input) async {
    calls.add('connect:${input.phoneNumberId}:${input.accessToken}');
    connectInput = input;
    channel = WhatsAppChannel(
      connected: true,
      phoneNumberId: input.phoneNumberId,
      displayPhoneNumber: '+51 999 999 999',
      verifiedName: 'Barbería Demo',
      connectedAt: DateTime.utc(2026, 10, 20, 12),
    );
    return channel;
  }

  @override
  Future<void> disconnect() async {
    calls.add('disconnect');
    channel = const WhatsAppChannel.disconnected();
  }
}

class FakeSessionController extends SessionController {
  FakeSessionController(this._session);
  final AuthSession _session;

  @override
  Future<AuthSession?> build() async => _session;
}

AuthSession _session() => const AuthSession(
  user: SessionUser(id: 'u1', email: 'me@demo.local', name: 'Diego'),
  tenant: SessionTenant(
    id: 't1',
    name: 'Barbería Demo',
    currency: 'PEN',
    timezone: 'America/Lima',
  ),
  role: UserRole.owner,
);

Future<void> _pump(WidgetTester tester, FakeWhatsAppRepository repo) async {
  final router = GoRouter(
    initialLocation: WhatsAppRoutes.root,
    routes: whatsappRoutes,
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        whatsAppRepositoryProvider.overrideWithValue(repo),
        businessClockProvider.overrideWithValue(BusinessClock('America/Lima')),
        sessionControllerProvider.overrideWith(
          () => FakeSessionController(_session()),
        ),
      ],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeBusinessTime);

  group('models / bodies', () {
    test('connectBody sends the token and omits a blank wabaId', () {
      final body = connectBody(
        const WhatsAppConnectInput(
          phoneNumberId: ' 123 ',
          accessToken: 'secret-token-value-123456',
          wabaId: '',
        ),
      );
      expect(body['phoneNumberId'], '123');
      expect(body['accessToken'], 'secret-token-value-123456');
      expect(body.containsKey('wabaId'), isFalse);
    });

    test('connectBody keeps a wabaId when given', () {
      final body = connectBody(
        const WhatsAppConnectInput(
          phoneNumberId: '123',
          accessToken: 'secret-token-value-123456',
          wabaId: '456',
        ),
      );
      expect(body['wabaId'], '456');
    });

    test('whatsAppChannelFromJson parses a disconnected channel', () {
      final channel = whatsAppChannelFromJson({'connected': false});
      expect(channel.connected, isFalse);
      expect(channel.phoneNumberId, isNull);
    });

    test('whatsAppChannelFromJson parses a connected channel to UTC', () {
      final channel = whatsAppChannelFromJson({
        'connected': true,
        'phoneNumberId': '123',
        'wabaId': '456',
        'displayPhoneNumber': '+51 999 999 999',
        'verifiedName': 'Barbería Demo',
        'connectedAt': '2026-10-20T17:00:00.000Z',
      });
      expect(channel.connected, isTrue);
      expect(channel.displayPhoneNumber, '+51 999 999 999');
      expect(channel.connectedAt!.isUtc, isTrue);
    });
  });

  group('connect form', () {
    testWidgets('sends the body and does not echo the token afterwards', (
      tester,
    ) async {
      final repo = FakeWhatsAppRepository();
      await _pump(tester, repo);

      await tester.tap(find.widgetWithText(FilledButton, 'Conectar'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField).at(0), '123456');
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'super-secret-permanent-token',
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Conectar'));
      await tester.pumpAndSettle();

      expect(repo.connectInput?.accessToken, 'super-secret-permanent-token');
      expect(
        find.widgetWithText(TextField, 'super-secret-permanent-token'),
        findsNothing,
      );
      expect(find.text('super-secret-permanent-token'), findsNothing);
      expect(find.text('Conectado'), findsOneWidget);
    });
  });

  group('status + disconnect', () {
    testWidgets('shows the connected number and name', (tester) async {
      final repo = FakeWhatsAppRepository(
        channel: WhatsAppChannel(
          connected: true,
          phoneNumberId: '123',
          displayPhoneNumber: '+51 999 999 999',
          verifiedName: 'Barbería Demo',
          connectedAt: DateTime.utc(2026, 10, 20, 12),
        ),
      );
      await _pump(tester, repo);

      expect(find.text('Conectado'), findsOneWidget);
      expect(find.text('+51 999 999 999'), findsOneWidget);
      expect(find.text('Barbería Demo'), findsOneWidget);
    });

    testWidgets('disconnect requires confirmation before calling the API', (
      tester,
    ) async {
      final repo = FakeWhatsAppRepository(
        channel: const WhatsAppChannel(
          connected: true,
          phoneNumberId: '123',
          displayPhoneNumber: '+51 999 999 999',
        ),
      );
      await _pump(tester, repo);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Desconectar'));
      await tester.pumpAndSettle();

      expect(find.text('¿Desconectar WhatsApp?'), findsOneWidget);
      expect(repo.calls.contains('disconnect'), isFalse);

      await tester.tap(find.widgetWithText(TextButton, 'Cancelar'));
      await tester.pumpAndSettle();
      expect(repo.calls.contains('disconnect'), isFalse);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Desconectar'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Desconectar'));
      await tester.pumpAndSettle();

      expect(repo.calls, contains('disconnect'));
      expect(find.text('Sin conectar'), findsOneWidget);
    });
  });
}
