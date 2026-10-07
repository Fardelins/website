import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HapticsService } from '@core/services/haptics.service';
import { TrackingCopy } from './tracking-copy';

describe('TrackingCopy', () => {
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

  it('copies the tracking number and keeps the confirmation inside the control', async () => {
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    button.click();
    await Promise.resolve();
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
    await Promise.resolve();
    fixture.detectChanges();
    expect(button.textContent).toContain('Copied');

    fixture.componentRef.setInput('trackingId', 'FDL987654');
    fixture.detectChanges();

    expect(button.textContent).toContain('FDL987654');
  });
});
