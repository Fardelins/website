import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QrGlyphs } from '@shared/utils/qr-glyphs';
import { QrPlate } from './qr-plate';

const glyphs = (seed: number): QrGlyphs => ({
  size: 29,
  span: 33,
  modules: Array.from({ length: 20 + seed }, (_, i) => ({
    x: 2 + (i % 20),
    y: 9 + Math.floor(i / 20),
    delay: i / 40,
  })),
  finders: [
    { x: 2, y: 2, delay: 0.78 },
    { x: 24, y: 2, delay: 0.84 },
    { x: 2, y: 24, delay: 0.81 },
  ],
});

describe('QrPlate', () => {
  let fixture: ComponentFixture<QrPlate>;

  const root = () => fixture.nativeElement as HTMLElement;
  const baseModules = () => root().querySelectorAll('.qrp__code--base .qrp__module').length;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [QrPlate] });
    fixture = TestBed.createComponent(QrPlate);
    fixture.componentRef.setInput('label', 'QR code for @ada');
  });

  afterEach(() => vi.useRealTimers());

  it('shows a skeleton while there is no code', () => {
    fixture.detectChanges();

    expect(root().querySelector('.qrp__skeleton')).not.toBeNull();
    expect(baseModules()).toBe(0);
  });

  it('holds the skeleton for a beat, then resolves the code in with all three layers', async () => {
    fixture.componentRef.setInput('glyphs', glyphs(0));
    fixture.detectChanges();
    expect(root().querySelector('.qrp__skeleton')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(700);
    fixture.detectChanges();

    expect(root().querySelector('.qrp__skeleton')).toBeNull();
    expect(baseModules()).toBe(20);
    expect(root().querySelectorAll('.qrp__code')).toHaveLength(3);
    expect(root().querySelectorAll('.qrp__code--base .qrp__finder')).toHaveLength(3);
    expect(root().querySelector('.qrp--revealing')).not.toBeNull();
    expect(root().querySelector('svg[role="img"]')?.getAttribute('aria-label')).toBe(
      'QR code for @ada',
    );
  });

  it('swaps in a new code straight away once the first has shown', async () => {
    fixture.componentRef.setInput('glyphs', glyphs(0));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(700);
    fixture.detectChanges();

    fixture.componentRef.setInput('glyphs', glyphs(5));
    fixture.detectChanges();

    expect(root().querySelector('.qrp__skeleton')).toBeNull();
    expect(baseModules()).toBe(25);
  });

  it('gives each plate its own gradient, so two on a page never share one', async () => {
    const second = TestBed.createComponent(QrPlate);
    for (const plate of [fixture, second]) {
      plate.componentRef.setInput('glyphs', glyphs(0));
      plate.detectChanges();
    }
    await vi.advanceTimersByTimeAsync(700);
    fixture.detectChanges();
    second.detectChanges();

    const ids = [fixture, second].map(
      (plate) => (plate.nativeElement as HTMLElement).querySelector('linearGradient')?.id,
    );
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });
});
