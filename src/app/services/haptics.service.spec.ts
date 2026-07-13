import { TestBed } from '@angular/core/testing';
import { HapticsService } from './haptics.service';

describe('HapticsService', () => {
  let vibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.mocked(matchMedia).mockImplementation(
      (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }),
    );
    vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 });
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('triggers tactile feedback on touch-capable devices', async () => {
    const service = TestBed.inject(HapticsService);
    service.selection();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(vibrate).toHaveBeenCalledOnce();
  });

  it('suppresses haptics when reduced motion is requested', async () => {
    vi.mocked(matchMedia).mockImplementation(
      (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }),
    );
    const service = TestBed.inject(HapticsService);
    service.light();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('honors the stored preference and throttles rapid repeated feedback', async () => {
    const service = TestBed.inject(HapticsService);
    service.selection();
    service.selection();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(vibrate).toHaveBeenCalledOnce();

    service.setEnabled(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    service.success();
    expect(vibrate).toHaveBeenCalledOnce();
  });
});
