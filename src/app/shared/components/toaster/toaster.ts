import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarCheckCircleBoldDuotone,
  solarDangerCircleBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { Toast, ToastAction, ToastService } from '@core/services/toast.service';

const STACK_GAP = 10;
const SWIPE_DISTANCE = 60;
// px per ms; a quick flick dismisses even when it travels less than SWIPE_DISTANCE.
const SWIPE_VELOCITY = 0.11;

interface Drag {
  id: number;
  el: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  startedAt: number;
  axis: 'x' | 'y' | null;
}

@Component({
  selector: 'app-toaster',
  imports: [NgIcon],
  viewProviders: [provideIcons({ solarCheckCircleBoldDuotone, solarDangerCircleBoldDuotone })],
  templateUrl: './toaster.html',
  styleUrl: './toaster.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toaster {
  private readonly service = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly inners = viewChildren<ElementRef<HTMLElement>>('inner');
  private readonly heights = signal<ReadonlyMap<number, number>>(new Map());
  private readonly hovered = signal(false);
  private readonly focused = signal(false);
  private readonly tabHidden = signal(false);
  private drag: Drag | null = null;

  /** Lifts the stack above the mobile tab bar. */
  readonly raised = input(false);

  protected readonly toasts = computed(() => [...this.service.toasts()].reverse());
  protected readonly expanded = computed(() => this.hovered() || this.focused());
  protected readonly frontHeight = computed(() => {
    const front = this.toasts().find((toast) => !toast.leaving);
    return front ? (this.heights().get(front.id) ?? 0) : 0;
  });
  protected readonly stackHeight = computed(() => {
    const live = this.toasts().filter((toast) => !toast.leaving);
    const total = live.reduce((sum, toast) => sum + (this.heights().get(toast.id) ?? 0), 0);
    return total + Math.max(live.length - 1, 0) * STACK_GAP;
  });
  private readonly offsets = computed(() => {
    const offsets = new Map<number, { index: number; offset: number }>();
    let index = 0;
    let offset = 0;
    for (const toast of this.toasts()) {
      offsets.set(toast.id, { index, offset });
      if (toast.leaving) continue;
      index += 1;
      offset += (this.heights().get(toast.id) ?? 0) + STACK_GAP;
    }
    return offsets;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    if (!this.isBrowser) return;

    const observer = new ResizeObserver((entries) => {
      this.heights.update((current) => {
        const next = new Map(current);
        for (const entry of entries) {
          const id = Number((entry.target as HTMLElement).dataset['toastId']);
          next.set(id, (entry.target as HTMLElement).offsetHeight);
        }
        return next;
      });
    });
    effect(() => {
      observer.disconnect();
      for (const inner of this.inners()) observer.observe(inner.nativeElement);
    });

    const onVisibility = () => this.tabHidden.set(this.document.visibilityState === 'hidden');
    this.document.addEventListener('visibilitychange', onVisibility);
    effect(() => {
      if (this.expanded() || this.tabHidden()) this.service.pause();
      else this.service.resume();
    });

    destroyRef.onDestroy(() => {
      observer.disconnect();
      this.document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  protected index(toast: Toast): number {
    return this.offsets().get(toast.id)?.index ?? 0;
  }

  protected offset(toast: Toast): number {
    return this.offsets().get(toast.id)?.offset ?? 0;
  }

  protected height(toast: Toast): number {
    return this.heights().get(toast.id) ?? 0;
  }

  protected dismiss(toast: Toast): void {
    this.service.dismiss(toast.id);
  }

  protected runAction(toast: Toast, action: ToastAction): void {
    action.run();
    this.service.dismiss(toast.id);
  }

  protected setHovered(value: boolean): void {
    this.hovered.set(value);
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !(event.currentTarget as HTMLElement).contains(next)) this.focused.set(false);
  }

  protected onFocusIn(): void {
    this.focused.set(true);
  }

  protected onPointerDown(event: PointerEvent, toast: Toast): void {
    if (this.drag || toast.leaving || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button')) return;
    const el = event.currentTarget as HTMLElement;
    el.setPointerCapture(event.pointerId);
    this.drag = {
      id: toast.id,
      el,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      axis: null,
    };
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.axis) {
      if (Math.hypot(dx, dy) < 4) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      drag.el.classList.add('toast--dragging');
    }
    const amount = drag.axis === 'x' ? dx : dy;
    // Only right or down dismiss; the other way gets friction instead of a hard stop.
    const moved = amount > 0 ? amount : -Math.sqrt(-amount) * 2;
    drag.el.style.translate = drag.axis === 'x' ? `${moved}px 0` : `0 ${moved}px`;
  }

  protected onPointerUp(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    this.drag = null;
    drag.el.classList.remove('toast--dragging');
    if (!drag.axis) return;

    const amount = drag.axis === 'x' ? event.clientX - drag.startX : event.clientY - drag.startY;
    const velocity = amount / Math.max(performance.now() - drag.startedAt, 1);
    if (amount >= SWIPE_DISTANCE || velocity > SWIPE_VELOCITY) {
      drag.el.style.translate = drag.axis === 'x' ? '110% 0' : '0 110%';
      this.service.dismiss(drag.id);
    } else {
      drag.el.style.translate = '';
    }
  }
}
