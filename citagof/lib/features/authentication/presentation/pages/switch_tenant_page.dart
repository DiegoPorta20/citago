import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/app_failure.dart';
import '../../../../core/widgets/app_restart.dart';
import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/auth_session.dart';
import '../providers/auth_providers.dart';

class SwitchTenantPage extends ConsumerStatefulWidget {
  const SwitchTenantPage({super.key});

  @override
  ConsumerState<SwitchTenantPage> createState() => _SwitchTenantPageState();
}

class _SwitchTenantPageState extends ConsumerState<SwitchTenantPage> {
  String? _switchingTo;
  String? _error;

  Future<void> _switch(TenantChoice tenant) async {
    setState(() {
      _switchingTo = tenant.tenantId;
      _error = null;
    });
    try {
      await ref.read(switchTenantUseCaseProvider)(tenant.tenantId);
      if (!mounted) return;
      AppRestart.restart(context);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _switchingTo = null;
        _error = failureMessage(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tenants = ref.watch(myTenantsProvider);
    final busy = _switchingTo != null;

    return Scaffold(
      appBar: AppBar(title: const Text('Cambiar de negocio')),
      body: tenants.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(myTenantsProvider),
        ),
        data: (items) => ListView(
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Semantics(
                  liveRegion: true,
                  child: Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              ),
            for (final tenant in items)
              ListTile(
                minTileHeight: 64,
                enabled: !busy,
                leading: const Icon(Icons.storefront_outlined),
                title: Text(tenant.name),
                subtitle: Text(_roleLabel(tenant.role)),
                trailing: tenant.current
                    ? const Chip(label: Text('Actual'))
                    : _switchingTo == tenant.tenantId
                    ? const SizedBox(
                        height: 24,
                        width: 24,
                        child: CircularProgressIndicator(strokeWidth: 2.5),
                      )
                    : const Icon(Icons.chevron_right),
                onTap: tenant.current || busy ? null : () => _switch(tenant),
              ),
          ],
        ),
      ),
    );
  }

  String _roleLabel(UserRole role) => switch (role) {
    UserRole.owner => 'Propietario',
    UserRole.admin => 'Administrador',
    UserRole.staff => 'Profesional',
  };
}
