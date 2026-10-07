import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarBillListBoldDuotone,
  solarCheckCircleBoldDuotone,
  solarClockCircleBoldDuotone,
  solarCloseCircleBoldDuotone,
  solarDangerCircleBoldDuotone,
  solarDownloadMinimalisticBoldDuotone,
  solarUndoLeftRoundBoldDuotone,
  solarWalletMoneyBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { toPng } from 'html-to-image';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { HapticsService } from '@core/services/haptics.service';
import { ToastService } from '@core/services/toast.service';
import { EmptyState } from '@shared/components/empty-state/empty-state';
import { Logo } from '@shared/components/logo/logo';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatusPill } from '@shared/components/status-pill/status-pill';
import { TrackingCopy } from '@shared/components/tracking-copy/tracking-copy';
import { ProfileService, Transaction } from '@features/profile/profile.service';

type TransactionFilter = 'all' | 'credit' | 'debit';

@Component({
  selector: 'app-transactions',
  imports: [NgIcon, StatusPill, EmptyState, Skeleton, Logo, TrackingCopy],
  viewProviders: [
    provideIcons({
      solarBillListBoldDuotone,
      solarCheckCircleBoldDuotone,
      solarClockCircleBoldDuotone,
      solarCloseCircleBoldDuotone,
      solarDangerCircleBoldDuotone,
      solarDownloadMinimalisticBoldDuotone,
      solarUndoLeftRoundBoldDuotone,
      solarWalletMoneyBoldDuotone,
    }),
  ],
  templateUrl: './transactions.html',
  styleUrls: ['../../../../shared/styles/forms.css', './transactions.css'],
})
export class Transactions {
  private readonly profile = inject(ProfileService);
  private readonly seo = inject(SeoService);
  private readonly haptics = inject(HapticsService);
  private readonly toast = inject(ToastService);
  private readonly receiptCard = viewChild<ElementRef<HTMLElement>>('receiptCard');

  protected readonly items = signal<Transaction[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly activeFilter = signal<TransactionFilter>('all');
  protected readonly receipt = signal<Transaction | null>(null);
  protected readonly downloadingReceipt = signal(false);
  /** One diagonal line through the card's center, the label repeated a few times across it. */
  protected readonly watermarkRepeats = Array.from({ length: 3 });

  protected readonly filteredItems = computed(() => {
    const filter = this.activeFilter();
    if (filter === 'all') return this.items();
    return this.items().filter((item) => (filter === 'credit' ? item.credit : !item.credit));
  });

  constructor() {
    this.seo.update({
      title: `Transactions | ${SITE_NAME}`,
      description: 'Your Fardelins payment history.',
      path: '/app/transactions',
      robots: 'noindex, nofollow',
    });
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.items.set(await this.profile.transactions());
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  /** Top-ups feed the wallet, refunds reverse a payment, everything else is a plain receipt. */
  protected txnIcon(item: Transaction): string {
    if (/top-?up/i.test(item.description)) return 'solarWalletMoneyBoldDuotone';
    if (/refund/i.test(item.description)) return 'solarUndoLeftRoundBoldDuotone';
    return 'solarBillListBoldDuotone';
  }

  protected openReceipt(item: Transaction): void {
    this.haptics.selection();
    this.receipt.set(item);
  }

  protected closeReceipt(): void {
    this.receipt.set(null);
  }

  protected receiptTone(item: Transaction): 'success' | 'pending' | 'failed' {
    const status = item.status.trim().toLowerCase();
    if (/^(paid|success|successful|completed)$/.test(status)) return 'success';
    if (/^(failed|declined|abandoned|reversed|cancel)/.test(status)) return 'failed';
    return 'pending';
  }

  /** A payment that has not cleared must not read "Paid". */
  protected receiptHeading(item: Transaction): string {
    const tone = this.receiptTone(item);
    if (item.credit) return tone === 'success' ? 'Amount Received' : 'Amount Expected';
    if (tone === 'success') return 'Amount Paid';
    return tone === 'failed' ? 'Payment Failed' : 'Amount Due';
  }

  protected receiptIcon(item: Transaction): string {
    const tone = this.receiptTone(item);
    if (tone === 'success') return 'solarCheckCircleBoldDuotone';
    if (tone === 'failed') return 'solarCloseCircleBoldDuotone';
    return 'solarClockCircleBoldDuotone';
  }

  /** Our descriptions are authored as "Payment Type · Item or Source" (top-ups have no detail). */
  protected receiptParts(item: Transaction): { type: string; detail: string | null } {
    const [type, detail] = item.description.split(' · ');
    return { type, detail: detail ?? null };
  }

  protected receiptItemLabel(item: Transaction): string {
    return /delivery/i.test(item.description) ? 'Item' : 'Source';
  }

  protected async downloadReceipt(): Promise<void> {
    const el = this.receiptCard()?.nativeElement;
    const item = this.receipt();
    if (!el || !item || this.downloadingReceipt()) return;

    this.downloadingReceipt.set(true);
    this.haptics.light();
    const restore = this.prepareReceiptCapture(el);
    try {
      const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `fardelins-receipt-${item.reference}.png`;
      link.click();
      this.toast.success('Receipt downloaded', { description: link.download });
      this.haptics.success();
    } catch {
      this.toast.error("Couldn't download the receipt", {
        actions: [{ label: 'Try again', run: () => void this.downloadReceipt() }],
      });
      this.haptics.error();
    } finally {
      restore();
      this.downloadingReceipt.set(false);
    }
  }

  /**
   * The real brand mark as a rasterizable <img>, not the inline <svg> the component renders.
   * html-to-image draws the node via `<svg><foreignObject>`, and a nested <svg> inside that
   * foreignObject hits a browser ceiling and silently fails to draw, but an <img> pointed at
   * an SVG data URI is just an ordinary image resource and renders fine. Computed `fill` is
   * copied onto each cloned path inline, since the logo's colors come from CSS custom
   * properties set on its host (--logo-ink etc.) that the clone's detached markup can't
   * resolve on its own.
   */
  private buildLogoDataUrl(logoHost: HTMLElement): string | null {
    const svg = logoHost.querySelector('svg');
    if (!svg) return null;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const originalPaths = svg.querySelectorAll('path');
    const clonedPaths = clone.querySelectorAll('path');
    originalPaths.forEach((path, i) => {
      clonedPaths[i]?.setAttribute('fill', getComputedStyle(path).fill);
    });
    const serialized = new XMLSerializer().serializeToString(clone);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
  }

  /**
   * html-to-image renders the node into an `<svg><foreignObject>`, so it hits a real
   * limitation we have to route around, not just a style quirk: our fibre-grain texture is an
   * inline SVG data URI used as a background-image, SVG-in-data-URI-in-HTML-in-foreignObject-
   * in-SVG is one nesting too many, and the whole canvas rendered solid black rather than
   * throwing (confirmed by sampling the exported pixels, then bisecting by stripping
   * properties one at a time). Nulled for the capture only, every OTHER background-image
   * (the torn-edge gradients, which depend on --receipt-paper resolving) is instead frozen to
   * its already-computed, var()-free value so it survives the clone.
   * Also freezes every descendant's computed color/background/border onto inline styles
   * (custom properties don't reliably survive the clone either), swaps the logo for a
   * rasterized <img> (see buildLogoDataUrl), reveals the (otherwise screen-hidden) diagonal
   * watermark, and pins --receipt-paper as a literal. Everything here is a visual no-op on
   * screen, it only matters for the capture, and is reverted in the caller's finally block.
   */
  private prepareReceiptCapture(root: HTMLElement): () => void {
    const paper = getComputedStyle(root).getPropertyValue('--receipt-paper').trim();
    const rootPaperBefore = root.style.getPropertyValue('--receipt-paper');
    if (paper) root.style.setProperty('--receipt-paper', paper);

    const elements = [root, ...root.querySelectorAll<HTMLElement>('*')];
    const snapshots = elements.map((element): [HTMLElement, string] => [
      element,
      element.style.cssText,
    ]);
    for (const element of elements) {
      const computed = getComputedStyle(element);
      element.style.color = computed.color;
      element.style.backgroundColor = computed.backgroundColor;
      element.style.borderColor = computed.borderColor;
      element.style.backgroundImage = computed.backgroundImage.includes('feTurbulence')
        ? 'none'
        : computed.backgroundImage;
    }

    const logo = root.querySelector<HTMLElement>('.receipt__footer-logo');
    const wordmark = root.querySelector<HTMLElement>('.receipt__footer-wordmark');
    const watermark = root.querySelector<HTMLElement>('.receipt__watermark');
    const logoDataUrl = logo ? this.buildLogoDataUrl(logo) : null;
    let logoImg: HTMLImageElement | null = null;
    if (logo && logoDataUrl) {
      logoImg = document.createElement('img');
      logoImg.src = logoDataUrl;
      logoImg.alt = 'Fardelins';
      logoImg.style.height = '22px';
      logoImg.style.width = 'auto';
      logoImg.style.opacity = getComputedStyle(logo).opacity;
      logo.insertAdjacentElement('afterend', logoImg);
      logo.style.setProperty('display', 'none');
    } else {
      logo?.style.setProperty('display', 'none');
      if (wordmark) wordmark.hidden = false;
    }
    if (watermark) watermark.hidden = false;

    return () => {
      logoImg?.remove();
      if (wordmark) wordmark.hidden = true;
      if (watermark) watermark.hidden = true;
      // Restores original cssText for every element, including logo's display override above.
      for (const [element, cssText] of snapshots) element.style.cssText = cssText;
      root.style.setProperty('--receipt-paper', rootPaperBefore);
    };
  }
}
