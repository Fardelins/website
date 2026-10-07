import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';
import { DashboardPreferencesService } from '@core/services/dashboard-preferences.service';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { ActivityRange, DashboardActivity } from '../../dashboard.models';

import { DASHBOARD_PARCEL_STATUSES, DashboardParcelStatusGroup } from '@shared/parcel-status';
const SERIES = DASHBOARD_PARCEL_STATUSES;

interface TooltipParam {
  seriesName: string;
  axisValue: string;
  dataIndex: number;
  marker: string;
  value: number | string;
}

interface ChartColors {
  delivered: string;
  transit: string;
  pending: string;
  cancelled: string;
  text: string;
  muted: string;
  border: string;
  card: string;
}

@Component({
  selector: 'app-delivery-activity-chart',
  imports: [NgxEchartsDirective, Skeleton],
  templateUrl: './delivery-activity-chart.html',
  styleUrl: './delivery-activity-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryActivityChart {
  readonly activity = input.required<DashboardActivity>();
  /** Owned by the dashboard's range dropdown so every panel moves together. */
  readonly range = input<ActivityRange>('this-week');

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly preferences = inject(DashboardPreferencesService);
  // ECharts needs literal colours, so the design tokens are read off the DOM and
  // re-read whenever the theme flips.
  private readonly colors = signal<ChartColors | null>(null);

  protected readonly points = computed(() => this.activity()[this.range()]);
  protected readonly total = computed(() =>
    this.points().reduce((sum, point) => sum + point.total, 0),
  );
  protected readonly summaries = computed(() =>
    SERIES.map((spec) => ({
      ...spec,
      count: this.points().reduce((sum, point) => sum + point[spec.key], 0),
    })),
  );
  protected readonly hasData = computed(() => this.points().some((point) => point.total > 0));
  // Gates the chart div itself, not just its data, so ECharts' very first setOption()
  // call already carries real series, and plays its entrance animation instead of
  // treating a later data arrival as a no-op update on an already-initialised chart.
  protected readonly ready = computed(() => this.colors() !== null);

  constructor() {
    afterNextRender(() => this.readColors());
    effect(() => {
      this.preferences.effectiveTheme();
      // untracked: reading colors() here must NOT make this effect depend on it, this
      // effect also writes colors() indirectly via readColors(), and a tracked read would
      // make it re-run on its own write, which is exactly NG0103 (infinite CD loop).
      if (untracked(() => this.colors()) !== null) queueMicrotask(() => this.readColors());
    });
  }

  protected readonly options = computed<EChartsCoreOption>(() => {
    const colors = this.colors();
    const points = this.points();
    if (!colors) return {};

    // A status that never occurs in this period would otherwise draw as a dead flat
    // line at zero across the whole chart, pure noise, so it's dropped instead.
    const active = SERIES.filter((spec) => points.some((point) => point[spec.key] > 0));

    const motion =
      this.preferences.motionEnabled() &&
      !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const series = active.map((spec, index) => ({
      name: spec.label,
      type: 'bar',
      stack: 'parcels',
      barMaxWidth: 32,
      data: points.map((point) => ({
        value: point[spec.key],
        itemStyle: {
          borderRadius: active.slice(index + 1).every((next) => point[next.key] === 0)
            ? [6, 6, 0, 0]
            : 0,
          decal: {
            symbol: 'rect',
            symbolSize: 0.6,
            color: 'rgba(255, 255, 255, 0.18)',
            dashArrayX: [1, 0],
            dashArrayY: [1, 4],
            rotation: -Math.PI / 4,
          },
        },
      })),
      itemStyle: { color: colors[spec.key] },
      emphasis: {
        focus: 'series',
        itemStyle: { shadowBlur: 12, shadowColor: `${colors[spec.key]}55` },
      },
      animationDuration: motion ? 650 : 0,
      animationDurationUpdate: motion ? 450 : 0,
      animationDelay: (dataIndex: number) => (motion ? dataIndex * 25 : 0),
      animationEasing: 'cubicOut',
    }));

    return {
      grid: { top: 12, right: 10, bottom: 26, left: 32 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        padding: [10, 13],
        extraCssText: `border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.18);`,
        textStyle: { color: colors.text, fontSize: 12 },
        axisPointer: { type: 'shadow', shadowStyle: { color: `${colors.pending}12` } },
        formatter: (params: TooltipParam[]) => {
          const total = params.reduce((sum, p) => sum + Number(p.value || 0), 0);
          const rows = params
            .filter((param) => Number(param.value) > 0)
            .map(
              (param) => `<div style="display:flex;gap:10px;align-items:center;margin-top:5px">
                ${param.marker}<span style="color:${colors.muted}">${param.seriesName}</span>
                <strong style="margin-left:auto">${param.value}</strong>
              </div>`,
            )
            .join('');
          const point = points[params[0]?.dataIndex ?? -1];
          const label = point?.tooltipLabel ?? params[0]?.axisValue ?? '';
          const heading = `<div style="display:flex;align-items:baseline;gap:8px">
            <span style="font-weight:700;font-size:13px">${label}</span>
            <span style="color:${colors.muted};font-size:11px">${total} parcel${total === 1 ? '' : 's'}</span>
          </div>`;
          return rows
            ? heading + rows
            : `${heading}<div style="color:${colors.muted};margin-top:5px">No parcels</div>`;
        },
      },
      xAxis: {
        type: 'category',
        data: points.map((point) => point.label),
        axisLine: { lineStyle: { color: colors.border } },
        axisTick: { show: false },
        axisLabel: { color: colors.muted, fontSize: 11.5 },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: colors.border, type: 'dashed' } },
        axisLabel: { color: colors.muted, fontSize: 11 },
      },
      series,
    };
  });

  private readColors(): void {
    const styles = getComputedStyle(this.host.nativeElement);
    const token = (name: string, fallback: string): string =>
      styles.getPropertyValue(name).trim() || fallback;
    const series = (key: DashboardParcelStatusGroup): string => {
      const spec = SERIES.find((item) => item.key === key)!;
      return token(spec.token, '#85858d');
    };

    this.colors.set({
      delivered: series('delivered'),
      transit: series('transit'),
      pending: series('pending'),
      cancelled: series('cancelled'),
      text: token('--dashboard-text', '#f1f1f1'),
      muted: token('--dashboard-muted', '#8b8b8b'),
      border: token('--dashboard-border', '#2a2a2a'),
      card: token('--dashboard-card', '#1a1a1a'),
    });
  }
}
