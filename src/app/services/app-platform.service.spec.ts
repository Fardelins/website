import { TestBed } from '@angular/core/testing';
import { AppPlatformService } from './app-platform.service';

describe('AppPlatformService', () => {
  const setNavigator = (userAgent: string, platform = '', maxTouchPoints = 0): void => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent });
    Object.defineProperty(navigator, 'platform', { configurable: true, value: platform });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: maxTouchPoints,
    });
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('selects Google Play for Android devices', () => {
    setNavigator('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36');
    const service = TestBed.inject(AppPlatformService);

    expect(service.platform).toBe('android');
    expect(service.preferredStore?.name).toBe('Google Play');
  });

  it('selects the App Store for iPhone and modern iPad devices', () => {
    setNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    expect(TestBed.inject(AppPlatformService).platform).toBe('ios');

    TestBed.resetTestingModule();
    setNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 'MacIntel', 5);
    expect(TestBed.inject(AppPlatformService).platform).toBe('ios');
  });

  it('shows both stores on desktop and falls back to the download route until URLs are set', () => {
    setNavigator('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32');
    const service = TestBed.inject(AppPlatformService);

    expect(service.platform).toBe('other');
    expect(service.visibleStores.map((store) => store.name)).toEqual(['App Store', 'Google Play']);
    expect(service.hrefFor()).toBe('/download');
  });
});
