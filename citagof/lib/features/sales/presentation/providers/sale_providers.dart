import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/providers.dart';
import '../../../../core/time/business_clock.dart';
import '../../../authentication/presentation/providers/auth_providers.dart';
import '../../data/repositories/sale_repository_impl.dart';
import '../../domain/entities/money.dart';
import '../../domain/entities/sale.dart';
import '../../domain/repositories/sale_repository.dart';
import '../../domain/usecases/sale_usecases.dart';

final saleRepositoryProvider = Provider<SaleRepository>(
  (ref) => SaleRepositoryImpl(ref.watch(dioProvider)),
);

final registerSaleUseCaseProvider = Provider(
  (ref) => RegisterSaleUseCase(ref.watch(saleRepositoryProvider)),
);
final listSalesUseCaseProvider = Provider(
  (ref) => ListSalesUseCase(ref.watch(saleRepositoryProvider)),
);
final getSaleUseCaseProvider = Provider(
  (ref) => GetSaleUseCase(ref.watch(saleRepositoryProvider)),
);
final paySaleUseCaseProvider = Provider(
  (ref) => PaySaleUseCase(ref.watch(saleRepositoryProvider)),
);
final cancelSaleUseCaseProvider = Provider(
  (ref) => CancelSaleUseCase(ref.watch(saleRepositoryProvider)),
);
final refundSaleUseCaseProvider = Provider(
  (ref) => RefundSaleUseCase(ref.watch(saleRepositoryProvider)),
);

enum SalesPeriod { day, week, month }

/// A period of the business calendar around [anchor]. Weeks run Monday to
/// Sunday and months are calendar months, so "Semana" and "Mes" always match
/// what the owner sees on a wall calendar.
class SalesRange {
  const SalesRange({required this.anchor, required this.period});

  final String anchor;
  final SalesPeriod period;

  String get firstDay => switch (period) {
    SalesPeriod.day => anchor,
    SalesPeriod.week => BusinessClock.startOfWeek(anchor),
    SalesPeriod.month => BusinessClock.startOfMonth(anchor),
  };

  String get lastDay => switch (period) {
    SalesPeriod.day => anchor,
    SalesPeriod.week => BusinessClock.endOfWeek(anchor),
    SalesPeriod.month => BusinessClock.endOfMonth(anchor),
  };

  bool contains(String date) =>
      date.compareTo(firstDay) >= 0 && date.compareTo(lastDay) <= 0;

  SalesRange copyWith({String? anchor, SalesPeriod? period}) =>
      SalesRange(anchor: anchor ?? this.anchor, period: period ?? this.period);
}

class SalesRangeController extends Notifier<SalesRange> {
  @override
  SalesRange build() => SalesRange(
    anchor: ref.watch(businessClockProvider).today(),
    period: SalesPeriod.day,
  );

  void previous() => _shift(-1);
  void next() => _shift(1);

  void _shift(int direction) {
    final clock = ref.read(businessClockProvider);
    state = state.copyWith(
      anchor: switch (state.period) {
        SalesPeriod.day => clock.addDays(state.anchor, direction),
        SalesPeriod.week => clock.addDays(state.anchor, 7 * direction),
        SalesPeriod.month => BusinessClock.addMonths(state.anchor, direction),
      },
    );
  }

  void today() =>
      state = state.copyWith(anchor: ref.read(businessClockProvider).today());

  void select(String date) => state = state.copyWith(anchor: date);

  void setPeriod(SalesPeriod period) => state = state.copyWith(period: period);
}

final salesRangeProvider = NotifierProvider<SalesRangeController, SalesRange>(
  SalesRangeController.new,
);

class SalesStatusFilterController extends Notifier<SalesStatusFilter> {
  @override
  SalesStatusFilter build() => SalesStatusFilter.all;

  void select(SalesStatusFilter filter) => state = filter;
}

final salesStatusFilterProvider =
    NotifierProvider<SalesStatusFilterController, SalesStatusFilter>(
      SalesStatusFilterController.new,
    );

({DateTime from, DateTime to}) salesWindow(Ref ref) {
  final clock = ref.watch(businessClockProvider);
  final range = ref.watch(salesRangeProvider);
  return (
    from: clock.dayRangeUtc(range.firstDay).from,
    to: clock.dayRangeUtc(range.lastDay).to,
  );
}

class SalesListState {
  const SalesListState({
    required this.items,
    required this.hasMore,
    required this.total,
    this.loadingMore = false,
    this.loadMoreFailed = false,
    this.refreshing = false,
  });

  final List<Sale> items;
  final bool hasMore;

  final int total;
  final bool loadingMore;
  final bool loadMoreFailed;

  final bool refreshing;

  int get paidCents => items
      .where((sale) => sale.status == SaleStatus.paid)
      .fold(0, (sum, sale) => sum + Money.parse(sale.total).cents);

  String get paidTotal => Money(paidCents).toDecimalString();

  SalesListState copyWith({
    List<Sale>? items,
    bool? hasMore,
    int? total,
    bool? loadingMore,
    bool? loadMoreFailed,
    bool? refreshing,
  }) => SalesListState(
    items: items ?? this.items,
    hasMore: hasMore ?? this.hasMore,
    total: total ?? this.total,
    loadingMore: loadingMore ?? this.loadingMore,
    loadMoreFailed: loadMoreFailed ?? this.loadMoreFailed,
    refreshing: refreshing ?? this.refreshing,
  );
}

const _pageSize = 20;

class SalesListController extends AsyncNotifier<SalesListState> {
  int _page = 1;

  @override
  Future<SalesListState> build() {
    ref.watch(salesRangeProvider);
    ref.watch(salesStatusFilterProvider);
    return _firstPage();
  }

  Future<SalesListState> _firstPage() async {
    _page = 1;
    final window = salesWindow(ref);
    final status = ref.read(salesStatusFilterProvider).status;
    final page = await ref.read(listSalesUseCaseProvider)(
      from: window.from,
      to: window.to,
      status: status,
      limit: _pageSize,
    );
    return SalesListState(
      items: page.items,
      hasMore: page.hasMore,
      total: page.total,
    );
  }

  Future<void> refresh() async {
    final previous = state.value;
    if (previous != null) {
      state = AsyncData(previous.copyWith(refreshing: true));
    }
    final next = await AsyncValue.guard(_firstPage);
    if (next.hasError && previous != null) {
      state = AsyncData(previous.copyWith(refreshing: false));
    } else {
      state = next;
    }
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.loadingMore) return;

    state = AsyncData(
      current.copyWith(loadingMore: true, loadMoreFailed: false),
    );
    try {
      final window = salesWindow(ref);
      final status = ref.read(salesStatusFilterProvider).status;
      final page = await ref.read(listSalesUseCaseProvider)(
        from: window.from,
        to: window.to,
        status: status,
        page: _page + 1,
        limit: _pageSize,
      );
      _page++;
      state = AsyncData(
        current.copyWith(
          items: [...current.items, ...page.items],
          hasMore: page.hasMore,
          total: page.total,
          loadingMore: false,
        ),
      );
    } on Object {
      state = AsyncData(
        current.copyWith(loadingMore: false, loadMoreFailed: true),
      );
    }
  }
}

final salesListProvider =
    AsyncNotifierProvider.autoDispose<SalesListController, SalesListState>(
      SalesListController.new,
    );

final saleDetailProvider = FutureProvider.autoDispose.family<Sale, String>(
  (ref, id) => ref.watch(getSaleUseCaseProvider)(id),
);
