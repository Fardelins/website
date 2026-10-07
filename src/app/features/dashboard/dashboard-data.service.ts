import { Injectable } from '@angular/core';
import { DASHBOARD_PARCEL_STATUSES, dashboardParcelStatusGroup } from '@shared/parcel-status';
import { DeliverySummary, currencySymbol } from '@features/deliveries/deliveries.model';
import { phaseIndexForStatus } from '@features/tracking/tracking.model';
import {
  ActiveDeliveryCardData,
  ActivityRange,
  DashboardActivityPoint,
  DashboardMetric,
  DeliveredPeriod,
  MetricBreakdown,
  MetricTrend,
  DashboardParcelStatusGroup,
  SenderDashboardData,
} from './dashboard.models';

// Fixed approximation, not a live rate, see usdCaption() for why that matters here.
const USD_PER_NGN = 1 / 1550;

const FINAL_STATUSES = new Set(['completed', 'received', 'cancelled', 'canceled', 'failed']);
const DELIVERED_STATUSES = new Set(['completed', 'received']);
const STATUS_ORDER = DASHBOARD_PARCEL_STATUSES;

@Injectable({ providedIn: 'root' })
export class DashboardDataService {
  build(
    deliveries: DeliverySummary[],
    deliveredPeriod: DeliveredPeriod,
    locale: string,
    range?: ActivityRange,
  ): SenderDashboardData {
    const active = deliveries
      .filter((delivery) => !FINAL_STATUSES.has(delivery.status.toLowerCase()))
      .sort((left, right) => this.time(left.etaAt) - this.time(right.etaAt));
    const scoped = range ? this.inRange(deliveries, range) : deliveries;
    const delivered = scoped.filter(
      (delivery) =>
        DELIVERED_STATUSES.has(delivery.status.toLowerCase()) &&
        (range || this.insidePeriod(delivery.createdAt, deliveredPeriod)),
    );
    const spend = scoped.reduce((sum, delivery) => sum + this.amount(delivery), 0);
    const currency = deliveries.find((delivery) => delivery.currency)?.currency ?? 'NGN';

    const thisWeek = this.thisWeek(deliveries);

    return {
      isEmpty: deliveries.length === 0,
      metrics: this.metrics(
        active.length,
        delivered.length,
        scoped.length,
        spend,
        locale,
        currency,
        scoped,
        thisWeek,
      ).map((metric) =>
        range ? this.periodMetric(metric, range, deliveries, scoped, currency) : metric,
      ),
      activity: {
        'this-week': thisWeek,
        'this-month': this.thisMonth(deliveries),
        'last-month': this.lastMonth(deliveries),
        'last-6-months': this.lastSixMonths(deliveries),
        'this-year': this.thisYear(deliveries),
      },
      activeDeliveries: active.map((delivery) => this.activeCard(delivery)),
      recentParcels: [...deliveries]
        .sort((left, right) => this.time(right.createdAt) - this.time(left.createdAt))
        .slice(0, 7),
    };
  }

  private bounds(deliveries: DeliverySummary[], range: ActivityRange): [Date, Date] {
    const end = this.latestDate(deliveries);
    end.setHours(23, 59, 59, 999);
    let start = this.stripTime(end);
    switch (range) {
      case 'this-week':
        start = this.addDays(start, -6);
        break;
      case 'this-month':
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        break;
      case 'last-month':
        start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'last-6-months':
        start = new Date(end.getFullYear(), end.getMonth() - 5, 1);
        break;
      case 'this-year':
        start = new Date(end.getFullYear(), 0, 1);
        break;
    }
    return [start, end];
  }

  private inRange(deliveries: DeliverySummary[], range: ActivityRange): DeliverySummary[] {
    const [start, end] = this.bounds(deliveries, range);
    return deliveries.filter((parcel) => {
      const date = this.date(parcel.createdAt);
      return date && date >= start && date <= end;
    });
  }

  private periodMetric(
    metric: DashboardMetric,
    range: ActivityRange,
    all: DeliverySummary[],
    scoped: DeliverySummary[],
    currency: string,
  ): DashboardMetric {
    const label = {
      'this-week': 'this week',
      'this-month': 'this month',
      'last-month': 'last month',
      'last-6-months': 'in the last 6 months',
      'this-year': 'this year',
    }[range];
    const [start, end] = this.bounds(all, range);
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(start.getTime() - (end.getTime() - start.getTime() + 1));
    const previous = all.filter((parcel) => {
      const date = this.date(parcel.createdAt);
      return date && date >= previousStart && date <= previousEnd;
    });
    const value = (parcels: DeliverySummary[]) =>
      metric.key === 'spend'
        ? parcels.reduce((sum, p) => sum + this.amount(p), 0)
        : metric.key === 'delivered'
          ? parcels.filter((p) => dashboardParcelStatusGroup(p.status) === 'delivered').length
          : parcels.length;
    return {
      ...metric,
      trend: metric.key === 'in-transit' ? null : this.trend(value(scoped), value(previous)),
      caption:
        metric.key === 'spend'
          ? `${this.usdCaption(metric.value, currency) ?? 'Spent'} ${label}`
          : metric.key === 'delivered'
            ? `Delivered ${label}`
            : `Parcels ${label}`,
    };
  }

  private metrics(
    active: number,
    delivered: number,
    total: number,
    spend: number,
    locale: string,
    currency: string,
    deliveries: DeliverySummary[],
    thisWeek: DashboardActivityPoint[],
  ): DashboardMetric[] {
    const compact = new Intl.NumberFormat(locale, { notation: 'compact' });
    // Number via Intl (locale-aware grouping), symbol via our own map, Intl's built-in
    // style:'currency' silently prints the raw code when a locale has no symbol data for it
    // (NGN in an en-US locale, notably), so it isn't trusted for the symbol itself.
    const symbol = currencySymbol(currency);
    const money = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const anchor = this.latestDate(deliveries);
    const current = this.window(deliveries, anchor, 0, 7);
    const previous = this.window(deliveries, anchor, 7, 7);
    const busiest = thisWeek.reduce((max, point) => (point.total > max.total ? point : max), {
      label: '',
      total: 0,
    });

    return [
      {
        key: 'in-transit',
        label: 'In transit',
        value: active,
        displayValue: compact.format(active),
        icon: 'solarDeliveryBoldDuotone',
        trend: null,
        caption: null,
        breakdown: null,
      },
      {
        key: 'delivered',
        label: 'Delivered',
        value: delivered,
        displayValue: compact.format(delivered),
        icon: 'solarVerifiedCheckBoldDuotone',
        trend: this.trend(current.delivered, previous.delivered),
        caption: null,
        breakdown: this.breakdown(deliveries),
      },
      {
        key: 'total',
        label: 'Total parcels',
        value: total,
        displayValue: compact.format(total),
        icon: 'solarBoxBoldDuotone',
        trend: this.trend(current.parcels, previous.parcels),
        caption: busiest.total > 0 ? `Busiest day: ${busiest.label} (${busiest.total})` : null,
        breakdown: null,
      },
      {
        key: 'spend',
        label: 'Delivery spend',
        value: spend,
        displayValue: `${symbol}${money.format(spend)}`,
        icon: 'solarWalletBoldDuotone',
        trend: this.trend(current.spend, previous.spend),
        caption: this.usdCaption(spend, currency),
        breakdown: null,
      },
    ];
  }

  /**
   * A rough secondary reading in USD, since spend is otherwise only ever shown in the
   * account's own currency. `USD_PER_NGN` is a fixed, approximate rate, there's no live
   * FX source wired up, so this is intentionally framed with "~", never as an exact figure.
   */
  private usdCaption(spend: number, currency: string): string | null {
    if (!spend || currency.toUpperCase() !== 'NGN') return null;
    const usd = spend * USD_PER_NGN;
    return `~$${usd.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} spent`;
  }

  /** No prior-period baseline means no claim, a null trend hides the pill entirely. */
  private trend(current: number, previous: number): MetricTrend | null {
    if (previous <= 0) return null;
    const change = ((current - previous) / previous) * 100;
    const percent = Math.round(Math.abs(change));
    if (!Number.isFinite(change) || percent === 0) return null;
    return { direction: change > 0 ? 'up' : 'down', percent };
  }

  /** A `span`-day window ending `daysBack` days before the anchor the chart also uses. */
  private window(
    deliveries: DeliverySummary[],
    anchor: Date,
    daysBack: number,
    span: number,
  ): { parcels: number; spend: number; delivered: number } {
    const end = new Date(anchor);
    end.setDate(end.getDate() - daysBack);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - (span - 1));
    start.setHours(0, 0, 0, 0);

    const matched = deliveries.filter((delivery) => {
      const date = this.date(delivery.createdAt);
      return date !== null && date >= start && date <= end;
    });
    return {
      parcels: matched.length,
      spend: matched.reduce((sum, delivery) => sum + this.amount(delivery), 0),
      delivered: matched.filter((delivery) => DELIVERED_STATUSES.has(delivery.status.toLowerCase()))
        .length,
    };
  }

  private activeCard(delivery: DeliverySummary): ActiveDeliveryCardData {
    return {
      orderDate: delivery.createdLabel,
      trackingId: delivery.trackingId,
      title: delivery.title,
      recipientName: delivery.receiverName ?? 'Recipient',
      destination: delivery.dropOff ?? 'Destination pending',
      etaLabel: delivery.etaLabel ?? 'ETA pending',
      status: delivery.status,
      phaseIndex: Math.max(phaseIndexForStatus(delivery.status), 0),
    };
  }

  /** Rolling 7 days ending at the latest delivery, not the calendar week, matches the
   *  trailing "current vs. previous 7 days" window `metrics()` already trends against. */
  private thisWeek(deliveries: DeliverySummary[]): DashboardActivityPoint[] {
    const latest = this.latestDate(deliveries);
    return this.dayPoints(deliveries, this.addDays(latest, -6), latest, (day) =>
      day.toLocaleDateString('en-US', { weekday: 'short' }),
    );
  }

  /** 1st-of-month through the latest delivery, no fabricated zero days for the rest of
   *  the month that hasn't happened yet. */
  private thisMonth(deliveries: DeliverySummary[]): DashboardActivityPoint[] {
    const latest = this.latestDate(deliveries);
    const start = new Date(latest.getFullYear(), latest.getMonth(), 1);
    return this.dayPoints(deliveries, start, latest, (day) => String(day.getDate()));
  }

  private lastMonth(deliveries: DeliverySummary[]): DashboardActivityPoint[] {
    const latest = this.latestDate(deliveries);
    const start = new Date(latest.getFullYear(), latest.getMonth() - 1, 1);
    const end = new Date(latest.getFullYear(), latest.getMonth(), 0);
    return this.dayPoints(deliveries, start, end, (day) => String(day.getDate()));
  }

  private lastSixMonths(deliveries: DeliverySummary[]): DashboardActivityPoint[] {
    const latest = this.latestDate(deliveries);
    return this.monthPoints(
      deliveries,
      new Date(latest.getFullYear(), latest.getMonth() - 5, 1),
      latest,
    );
  }

  /** Jan through the latest delivery's month, same "don't chart the future" rule as
   *  `thisMonth()`. */
  private thisYear(deliveries: DeliverySummary[]): DashboardActivityPoint[] {
    const latest = this.latestDate(deliveries);
    return this.monthPoints(deliveries, new Date(latest.getFullYear(), 0, 1), latest);
  }

  private dayPoints(
    deliveries: DeliverySummary[],
    start: Date,
    end: Date,
    label: (day: Date) => string,
  ): DashboardActivityPoint[] {
    const days =
      Math.round((this.stripTime(end).getTime() - this.stripTime(start).getTime()) / 86_400_000) +
      1;
    return Array.from({ length: Math.max(days, 1) }, (_, index) => {
      const day = this.addDays(start, index);
      return this.activityPoint(
        label(day),
        day.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        deliveries.filter((delivery) => this.sameDay(this.date(delivery.createdAt), day)),
      );
    });
  }

  private monthPoints(
    deliveries: DeliverySummary[],
    start: Date,
    end: Date,
  ): DashboardActivityPoint[] {
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    return Array.from({ length: Math.max(months, 1) }, (_, index) => {
      const month = new Date(start.getFullYear(), start.getMonth() + index, 1);
      return this.activityPoint(
        month.toLocaleDateString('en-US', { month: 'short' }),
        month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        deliveries.filter((delivery) => {
          const date = this.date(delivery.createdAt);
          return (
            date?.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
          );
        }),
      );
    });
  }

  private addDays(date: Date, amount: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  }

  private stripTime(date: Date): Date {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  // Parcels are bucketed by where they stand *now*, against the day they were created.
  // The API gives no per-status history at this layer, so this is a snapshot by
  // creation date rather than a true status-over-time series.
  private activityPoint(
    label: string,
    tooltipLabel: string,
    matched: DeliverySummary[],
  ): DashboardActivityPoint {
    const counts = this.groupCounts(matched);
    return { label, tooltipLabel, total: matched.length, ...counts };
  }

  private groupCounts(deliveries: DeliverySummary[]): Record<DashboardParcelStatusGroup, number> {
    const counts: Record<DashboardParcelStatusGroup, number> = {
      pending: 0,
      transit: 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const delivery of deliveries) counts[dashboardParcelStatusGroup(delivery.status)] += 1;
    return counts;
  }

  private breakdown(deliveries: DeliverySummary[]): MetricBreakdown | null {
    const total = deliveries.length;
    if (!total) return null;
    const counts = this.groupCounts(deliveries);
    const segments = STATUS_ORDER.map(({ key, label }) => ({
      key,
      label,
      count: counts[key],
      percent: (counts[key] / total) * 100,
    })).filter((segment) => segment.count > 0);

    return { segments, total, caption: `out of ${total} parcel${total === 1 ? '' : 's'}` };
  }

  private insidePeriod(value: string | null | undefined, period: DeliveredPeriod): boolean {
    if (period === 'all-time') return true;
    const date = this.date(value);
    if (!date) return true;
    const now = new Date();
    if (period === 'this-year') return date.getFullYear() === now.getFullYear();
    if (period === 'last-six-months') {
      const threshold = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      return date >= threshold;
    }
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return date >= start;
  }

  private latestDate(deliveries: DeliverySummary[]): Date {
    const dates = deliveries
      .map((delivery) => this.date(delivery.createdAt))
      .filter((date): date is Date => Boolean(date));
    return dates.sort((left, right) => right.getTime() - left.getTime())[0] ?? new Date();
  }

  private amount(delivery: DeliverySummary): number {
    if (typeof delivery.amount === 'number' && Number.isFinite(delivery.amount))
      return delivery.amount;
    const value = Number(delivery.amountLabel?.replace(/[^\d.-]/g, '') ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  private time(value: string | null | undefined): number {
    return this.date(value)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  }

  private date(value: string | null | undefined): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private sameDay(left: Date | null, right: Date): boolean {
    return Boolean(
      left &&
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate(),
    );
  }
}
