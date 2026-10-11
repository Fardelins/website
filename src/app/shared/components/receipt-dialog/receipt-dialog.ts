import { Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarCheckCircleBoldDuotone,
  solarClockCircleBoldDuotone,
  solarCloseCircleBoldDuotone,
  solarDownloadMinimalisticBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { toPng } from 'html-to-image';
import { HapticsService } from '@core/services/haptics.service';
import { ToastService } from '@core/services/toast.service';
import { Transaction } from '@features/profile/profile.service';
import { Logo } from '../logo/logo';
import { StatusPill } from '../status-pill/status-pill';
import { TrackingCopy } from '../tracking-copy/tracking-copy';

/** The paper receipt for one payment, with a PNG download. Shown from the parcel page. */
@Component({
  selector: 'app-receipt-dialog',
  imports: [NgIcon, StatusPill, Logo, TrackingCopy],
  viewProviders: [
    provideIcons({
      solarCheckCircleBoldDuotone,
      solarClockCircleBoldDuotone,
      solarCloseCircleBoldDuotone,
      solarDownloadMinimalisticBoldDuotone,
    }),
  ],
  templateUrl: './receipt-dialog.html',
  styleUrl: './receipt-dialog.css',
})
export class ReceiptDialog {
  private readonly haptics = inject(HapticsService);
  private readonly toast = inject(ToastService);
  private readonly receiptCard = viewChild<ElementRef<HTMLElement>>('receiptCard');

  readonly transaction = input.required<Transaction>();
  readonly closed = output<void>();

  protected readonly downloadingReceipt = signal(false);
  /** One diagonal line through the card's center, the label repeated a few times across it. */
  protected readonly watermarkRepeats = Array.from({ length: 3 });

  protected close(): void {
    this.closed.emit();
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
    const item = this.transaction();
    if (!el || this.downloadingReceipt()) return;

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

  /** html-to-image drops a nested <svg>, so the logo is exported as an <img> of an SVG data URI. */
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
   * Freezes computed styles inline and swaps in export-safe pieces: the grain texture turns the
   * PNG solid black, and CSS variables and nested SVG do not survive html-to-image. Returns the undo.
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
