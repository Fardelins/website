import { Component, computed, inject, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  solarDangerCircleBoldDuotone,
  solarMapPointWaveBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { AuthService } from '@core/auth/auth.service';
import { DashboardPreferencesService } from '@core/services/dashboard-preferences.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { EmptyState } from '@shared/components/empty-state/empty-state';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { AppPromoService } from '@features/app-promo/app-promo.service';
import { DeliveriesService } from '@features/deliveries/deliveries.service';
import { DeliverySummary } from '@features/deliveries/deliveries.model';
import { DashboardDataService } from '@features/dashboard/dashboard-data.service';
import { ActivityRange } from '@features/dashboard/dashboard.models';
import { ActiveDeliveryCard } from '@features/dashboard/components/active-delivery-card/active-delivery-card';
import { DeliveryActivityChart } from '@features/dashboard/components/delivery-activity-chart/delivery-activity-chart';
import { ParcelSnapshotCard } from '@features/dashboard/components/parcel-snapshot-card/parcel-snapshot-card';
import { RecentParcels } from '@features/dashboard/components/recent-parcels/recent-parcels';
import { SendParcelCard } from '@features/dashboard/components/send-parcel-card/send-parcel-card';
import { ScrollRevealDirective } from '@shared/directives/scroll-reveal.directive';

const HANDED_OVER = new Set(['received', 'completed']);

@Component({
  selector: 'app-app-home',
  imports: [
    EmptyState,
    Skeleton,
    ActiveDeliveryCard,
    DeliveryActivityChart,
    ParcelSnapshotCard,
    RecentParcels,
    SendParcelCard,
    ScrollRevealDirective,
  ],
  viewProviders: [provideIcons({ solarDangerCircleBoldDuotone, solarMapPointWaveBoldDuotone })],
  templateUrl: './app-home.html',
  styleUrls: ['../../shared/styles/forms.css', './app-home.css'],
})
export class AppHome {
  private readonly deliveries = inject(DeliveriesService);
  private readonly auth = inject(AuthService);
  private readonly data = inject(DashboardDataService);
  private readonly seo = inject(SeoService);
  private readonly appPromo = inject(AppPromoService);
  protected readonly preferences = inject(DashboardPreferencesService);

  protected readonly displayName = this.auth.displayName;
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly all = signal<DeliverySummary[]>([]);
  protected readonly range = signal<ActivityRange>('this-week');
  protected readonly locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-NG';

  protected readonly dashboard = computed(() =>
    this.data.build(this.all(), 'all-time', this.locale, this.range()),
  );
  // The wireframe's three tiles. In-transit is dropped: the Active Delivery panel
  // below already answers "what is moving right now" in far more detail.
  protected readonly statMetrics = computed(() =>
    (['total', 'delivered', 'spend'] as const).flatMap(
      (key) => this.dashboard().metrics.find((m) => m.key === key) ?? [],
    ),
  );
  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { label: 'Good morning', emoji: '🌅' };
    if (hour < 17) return { label: 'Good afternoon', emoji: '☀️' };
    return { label: 'Good evening', emoji: '🌙' };
  });

  constructor() {
    this.seo.update({
      title: `Dashboard | ${SITE_NAME}`,
      description: 'Your Fardelins parcels, routes and delivery activity at a glance.',
      path: '/app',
      robots: 'noindex, nofollow',
    });
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.all.set(await this.deliveries.list());
      this.pitchApp();
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  // An empty history means this is their first landing here; a busy one earns the loyalty pitch.
  // `delivered` is out-for-delivery in this API, so a handover is `received`/`completed`.
  private pitchApp(): void {
    const total = this.all().length;
    const handedOver = this.all().some((item) => HANDED_OVER.has(item.status));
    if (!total) this.appPromo.request('first-signin');
    else if (total >= 3 || handedOver) this.appPromo.request('milestone');
  }
}
