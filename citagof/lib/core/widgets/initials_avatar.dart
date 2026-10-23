import 'package:flutter/material.dart';

/// Circle with a person's initials ("Andrés Castillo" → "AC").
class InitialsAvatar extends StatelessWidget {
  const InitialsAvatar({super.key, required this.name, this.radius = 22});

  final String name;
  final double radius;

  static String initialsOf(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return CircleAvatar(
      radius: radius,
      backgroundColor: scheme.primaryContainer,
      child: ExcludeSemantics(
        child: Text(
          initialsOf(name),
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: scheme.onPrimaryContainer,
            fontWeight: FontWeight.w700,
            fontSize: radius * 0.75,
          ),
        ),
      ),
    );
  }
}
