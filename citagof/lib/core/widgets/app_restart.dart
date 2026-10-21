import 'package:flutter/material.dart';

class AppRestart extends StatefulWidget {
  const AppRestart({super.key, required this.child});

  final Widget child;

  static void restart(BuildContext context) =>
      context.findAncestorStateOfType<_AppRestartState>()?._restart();

  @override
  State<AppRestart> createState() => _AppRestartState();
}

class _AppRestartState extends State<AppRestart> {
  Key _key = UniqueKey();

  void _restart() => setState(() => _key = UniqueKey());

  @override
  Widget build(BuildContext context) =>
      KeyedSubtree(key: _key, child: widget.child);
}
