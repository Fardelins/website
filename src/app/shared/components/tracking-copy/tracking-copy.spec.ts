import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HapticsService } from '@core/services/haptics.service';
import { TrackingCopy } from './tracking-copy';

describe('TrackingCopy', () => {
  const settle = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };
  let fixture: ComponentFixture<TrackingCopy>;
  let writeText: ReturnType<typeof vi.fn>;
  const haptics = { selection: vi.fn() };

  beforeEach(async () => {
    vi.useFakeTimers();
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    await TestBed.configureTestingModule({
      imports: [TrackingCopy],
      providers: [{ provide: HapticsService, useValue: haptics }],
    }).compileComponents();

    fixture = TestBed.createComponent(TrackingCopy);
    fixture.componentRef.setInput('trackingId', 'FDL123456');
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    haptics.selection.mockClear();
  });

  it('falls back to selecting and copying when the async clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    button.click();
    await settle();
    fixture.detectChanges();

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(button.textContent).toContain('Copied');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('copies the tracking number and keeps the confirmation inside the control', async () => {
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    button.click();
    await settle();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith('FDL123456');
    expect(haptics.selection).toHaveBeenCalledOnce();
    expect(button.textContent).toContain('Copied');
    expect(button.getAttribute('aria-label')).toBe('Tracking number copied');

    vi.advanceTimersByTime(1600);
    fixture.detectChanges();
    expect(button.textContent).toContain('FDL123456');
  });

  it('shows a new tracking number immediately when the input changes', async () => {
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    await settle();
    fixture.detectChanges();
    expect(button.textContent).toContain('Copied');

    fixture.componentRef.setInput('trackingId', 'FDL987654');
    fixture.detectChanges();

    expect(button.textContent).toContain('FDL987654');
  });
});
