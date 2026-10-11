import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarHome2BoldDuotone,
  solarLogout2BoldDuotone,
  solarBoxBoldDuotone,
  solarUserRoundedBoldDuotone,
  solarQuestionCircleBoldDuotone,
  solarSidebarMinimalisticBoldDuotone,
  solarSunBoldDuotone,
  solarMoonBoldDuotone,
  solarHeadphonesRoundBoldDuotone,
  solarAltArrowRightBoldDuotone,
  solarArrowLeftBoldDuotone,
  solarArrowRightUpBoldDuotone,
  solarMagniferBoldDuotone,
  solarBellBingBoldDuotone,
  solarCloseCircleBoldDuotone,
  solarSmartphoneBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { AuthService } from '@core/auth/auth.service';
import { HapticsService } from '@core/services/haptics.service';
import { DashboardPreferencesService } from '@core/services/dashboard-preferences.service';
import { Logo } from '@shared/components/logo/logo';
import { Toaster } from '@shared/components/toaster/toaster';
import { RatingPrompt } from '@features/deliveries/components/rating-prompt/rating-prompt';
import { RatingPromptService } from '@features/deliveries/rating-prompt.service';
import { CommandPalette } from '@features/search/command-palette/command-palette';
import { AppPromoService } from '@features/app-promo/app-promo.service';
import { AppPromoModal } from '@features/app-promo/components/app-promo-modal/app-promo-modal';
import { DeliveriesService } from '@features/deliveries/deliveries.service';
import { statusLabel } from '@features/tracking/tracking.model';

/** Terminal states, matching the deliveries list's own DONE set. */
const DONE_STATUSES = new Set(['received', 'completed', 'cancelled']);

// No backend endpoint tracks read state per notification, so it's kept client-side,
// genuine per-viewer state, same trade-off as a "seen" flag any inbox UI keeps locally.
const NOTIFICATIONS_READ_KEY = 'fardelins.notifications.read';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  exact: boolean;
}

interface DeliveryNotification {
  id: string;
  title: string;
  copy: string;
  imageUrl: string | null;
  createdAt: string | null;
  read: boolean;
}

interface NotificationGroup {
  label: string;
  items: DeliveryNotification[];
}

// Pushed screens are tasks, not destinations: they hide the tab bar so you can't wander out of a half-finished flow (parcel detail is a destination, so it keeps it).
const TASK_ROUTES = [/^\/app\/send/];

// The topbar owns the page title, so pages don't repeat it. Ordered most specific first.
const PAGE_TITLES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/app$/, 'Dashboard'],
  [/^\/app\/deliveries\/[^/]+$/, 'Parcel details'],
  [/^\/app\/deliveries/, 'Parcels'],
  [/^\/app\/profile/, 'Settings'],
  [/^\/app\/send\/[^/]+\/success/, 'Delivery booked'],
  [/^\/app\/send/, 'New delivery'],
  [/^\/app\/help/, 'Help center'],
];

@Component({
  selector: 'app-app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NgIcon,
    Logo,
    CommandPalette,
    AppPromoModal,
    Toaster,
    RatingPrompt,
  ],
  viewProviders: [
    provideIcons({
      solarHome2BoldDuotone,
      solarBoxBoldDuotone,
      solarUserRoundedBoldDuotone,
      solarLogout2BoldDuotone,
      solarQuestionCircleBoldDuotone,
      solarSidebarMinimalisticBoldDuotone,
      solarSunBoldDuotone,
      solarMoonBoldDuotone,
      solarHeadphonesRoundBoldDuotone,
      solarAltArrowRightBoldDuotone,
      solarArrowLeftBoldDuotone,
      solarArrowRightUpBoldDuotone,
      solarMagniferBoldDuotone,
      solarBellBingBoldDuotone,
      solarCloseCircleBoldDuotone,
      solarSmartphoneBoldDuotone,
    }),
  ],
  templateUrl: './app-shell.html',
  styleUrls: ['../../shared/styles/forms.css', './app-shell.css', './app-shell-notifications.css'],
})
export class AppShell {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly haptics = inject(HapticsService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly deliveries = inject(DeliveriesService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly preferences = inject(DashboardPreferencesService);
  protected readonly appPromo = inject(AppPromoService);
  protected readonly ratingPrompt = inject(RatingPromptService);
  private readonly notificationsList = viewChild<ElementRef<HTMLElement>>('notificationsList');
  private readonly notificationsMenu = viewChild<ElementRef<HTMLElement>>('notificationsMenu');
  private readonly notificationsTrigger =
    viewChild<ElementRef<HTMLButtonElement>>('notificationsTrigger');
  private scrollFadeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    if (this.isBrowser) void this.ratingPrompt.check();
    void this.loadNotifications();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.scrollFadeTimer));
  }

  protected readonly user = this.auth.user;
  protected readonly displayName = this.auth.displayName;
  protected readonly signingOut = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly notificationsOpen = signal(false);
  protected readonly paletteOpen = signal(false);
  protected readonly bodyScrolling = signal(false);
  protected readonly searchHint = /mac|iphone|ipad/i.test(globalThis.navigator?.platform ?? '')
    ? '⌘K'
    : 'Ctrl K';

  private readonly activeParcels = signal<DeliveryNotification[]>([]);
  protected readonly notificationsFilter = signal<'all' | 'unread'>('all');
  protected readonly notificationsAtEnd = signal(true);
  protected readonly unreadCount = computed(
    () => this.activeParcels().filter((item) => !item.read).length,
  );
  protected readonly notificationGroups = computed<NotificationGroup[]>(() => {
    const items = this.activeParcels();
    const visible =
      this.notificationsFilter() === 'unread' ? items.filter((item) => !item.read) : items;
    return this.groupByDay(visible);
  });

  protected readonly navItems: NavItem[] = [
    { label: 'Home', path: '/app', icon: 'solarHome2BoldDuotone', exact: true },
    { label: 'Parcels', path: '/app/deliveries', icon: 'solarBoxBoldDuotone', exact: false },
  ];
  // Profile has no sidebar row, it lives in the account menu, but it still earns a mobile tab.
  protected readonly tabs: NavItem[] = [
    ...this.navItems,
    { label: 'Profile', path: '/app/profile', icon: 'solarUserRoundedBoldDuotone', exact: false },
  ];

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.split(/[?#]/, 1)[0]),
    ),
    { initialValue: this.router.url.split(/[?#]/, 1)[0] },
  );
  protected readonly isTaskRoute = computed(() => TASK_ROUTES.some((rx) => rx.test(this.url())));
  protected readonly isParcelsList = computed(() => this.url() === '/app/deliveries');

  protected readonly pageTitle = computed(() => {
    const url = this.url();
    return PAGE_TITLES.find(([pattern]) => pattern.test(url))?.[1] ?? 'Dashboard';
  });
  // Parcel detail swaps the topbar title for a back link instead of duplicating back-navigation in the page.
  protected readonly isParcelDetail = computed(() => /^\/app\/deliveries\/[^/]+$/.test(this.url()));

  protected backToParcels(): void {
    this.haptics.light();
  }

  // Ctrl/Cmd+K is the shortcut people already expect for search.
  @HostListener('document:keydown', ['$event'])
  protected onShortcut(event: KeyboardEvent): void {
    if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    this.openPalette();
  }

  protected openPalette(): void {
    this.haptics.light();
    this.paletteOpen.set(true);
  }

  protected onBodyScroll(): void {
    this.bodyScrolling.set(true);
    clearTimeout(this.scrollFadeTimer);
    this.scrollFadeTimer = setTimeout(() => this.bodyScrolling.set(false), 800);
  }

  private async loadNotifications(): Promise<void> {
    try {
      const all = await this.deliveries.list();
      const readIds = this.readNotificationIds();
      this.activeParcels.set(
        all
          .filter((item) => !DONE_STATUSES.has(item.status))
          .sort((a, b) => this.time(b.createdAt) - this.time(a.createdAt))
          .map((item) => ({
            id: item.trackingId,
            title: `${item.title} is ${statusLabel(item.status).toLowerCase()}`,
            copy: [item.receiverName, item.dropOff].filter(Boolean).join(' · '),
            imageUrl: item.imageUrl ?? null,
            createdAt: item.createdAt ?? null,
            read: readIds.has(item.trackingId),
          })),
      );
    } catch {
      this.activeParcels.set([]);
    }
  }

  protected toggleNotifications(): void {
    const opening = !this.notificationsOpen();
    this.notificationsOpen.set(opening);
    this.menuOpen.set(false);
    if (opening) {
      this.haptics.light();
      queueMicrotask(() => {
        this.checkNotificationsOverflow();
        if (this.isBrowser && matchMedia('(max-width: 900px)').matches) {
          this.notificationsMenu()
            ?.nativeElement.querySelector<HTMLButtonElement>('.notifications__close')
            ?.focus();
        }
      });
    }
  }

  protected closeNotifications(restoreFocus = true): void {
    if (!this.notificationsOpen()) return;
    this.notificationsOpen.set(false);
    if (restoreFocus) queueMicrotask(() => this.notificationsTrigger()?.nativeElement.focus());
  }

  protected setNotificationsFilter(filter: 'all' | 'unread'): void {
    if (this.notificationsFilter() === filter) return;
    this.haptics.selection();
    this.notificationsFilter.set(filter);
    queueMicrotask(() => this.checkNotificationsOverflow());
  }

  protected markAsRead(id: string): void {
    const item = this.activeParcels().find((n) => n.id === id);
    if (!item || item.read) return;
    this.activeParcels.update((items) =>
      items.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    this.persistReadNotificationIds();
  }

  protected markAllAsRead(): void {
    if (!this.unreadCount()) return;
    this.haptics.selection();
    this.activeParcels.update((items) => items.map((n) => ({ ...n, read: true })));
    this.persistReadNotificationIds();
  }

  protected onNotificationsScroll(): void {
    this.checkNotificationsOverflow();
  }

  /** Relative-time label for a real timestamp, never a guess when the date is missing. */
  protected relativeTime(value: string | null): string {
    const date = this.parseDate(value);
    if (!date) return '';
    const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private checkNotificationsOverflow(): void {
    const el = this.notificationsList()?.nativeElement;
    if (!el) return;
    this.notificationsAtEnd.set(el.scrollHeight - el.scrollTop - el.clientHeight < 4);
  }

  private groupByDay(items: DeliveryNotification[]): NotificationGroup[] {
    const groups = new Map<string, DeliveryNotification[]>();
    for (const item of items) {
      const key = this.dayKey(item.createdAt);
      const group = groups.get(key);
      if (group) group.push(item);
      else groups.set(key, [item]);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, groupItems]) => ({ label: this.dayLabel(key), items: groupItems }));
  }

  private dayKey(value: string | null): string {
    return this.parseDate(value)?.toISOString().slice(0, 10) ?? '0000-00-00';
  }

  private dayLabel(key: string): string {
    if (key === '0000-00-00') return 'Earlier';
    const date = new Date(`${key}T00:00:00`);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (this.sameDay(date, today)) return 'Today';
    if (this.sameDay(date, yesterday)) return 'Yesterday';
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private sameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private parseDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private time(value: string | null | undefined): number {
    return this.parseDate(value)?.getTime() ?? 0;
  }

  private persistReadNotificationIds(): void {
    if (!this.isBrowser) return;
    const ids = this.activeParcels()
      .filter((item) => item.read)
      .map((item) => item.id);
    try {
      localStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify(ids));
    } catch {
      // Private mode / quota, read state just won't persist this session.
    }
  }

  private readNotificationIds(): Set<string> {
    if (!this.isBrowser) return new Set();
    try {
      const raw = localStorage.getItem(NOTIFICATIONS_READ_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  }

  protected readonly initials = computed(() => {
    const user = this.user();
    if (!user) return '';
    const letters = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.trim();
    return (letters || user.email.charAt(0)).toUpperCase();
  });

  protected setTheme(theme: 'light' | 'dark'): void {
    if (this.preferences.effectiveTheme() === theme) return;
    this.haptics.selection();
    this.preferences.setTheme(theme);
  }

  protected toggleTheme(): void {
    this.setTheme(this.preferences.effectiveTheme() === 'dark' ? 'light' : 'dark');
  }

  protected toggleSidebar(): void {
    this.haptics.selection();
    this.menuOpen.set(false);
    this.preferences.toggleSidebar();
  }

  protected openAppPromo(): void {
    this.menuOpen.set(false);
    this.haptics.light();
    this.appPromo.open();
  }

  protected toggleMenu(): void {
    this.haptics.selection();
    this.menuOpen.update((open) => !open);
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: PointerEvent): void {
    const target = event.target as Node;
    const host = this.host.nativeElement as HTMLElement;
    if (this.menuOpen() && !host.querySelector('.account')?.contains(target)) {
      this.menuOpen.set(false);
    }
    if (this.notificationsOpen() && !host.querySelector('.notifications')?.contains(target)) {
      this.closeNotifications(false);
    }
  }

  @HostListener('document:keydown.tab', ['$event'])
  protected trapNotificationsFocus(event: Event): void {
    if (!this.notificationsOpen() || !this.isBrowser || !matchMedia('(max-width: 900px)').matches)
      return;
    const keyboardEvent = event as KeyboardEvent;
    const menu = this.notificationsMenu()?.nativeElement;
    if (!menu) return;
    const focusable = Array.from(
      menu.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    const active = document.activeElement;
    if (keyboardEvent.shiftKey && (active === first || !menu.contains(active))) {
      keyboardEvent.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && (active === last || !menu.contains(active))) {
      keyboardEvent.preventDefault();
      first.focus();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.menuOpen.set(false);
    this.closeNotifications();
  }

  protected async signOut(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    this.menuOpen.set(false);
    this.haptics.light();
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
