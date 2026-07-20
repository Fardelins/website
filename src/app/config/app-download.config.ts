export type AppPlatform = 'android' | 'ios' | 'other';

export interface AppStoreLink {
  platform: Exclude<AppPlatform, 'other'>;
  name: string;
  shortName: string;
  url: string;
  icon: string;
}

/**
 * Update the two URLs here when the store listings are live. Every app badge,
 * device-aware CTA, and the sticky install prompt reads from this config.
 */
export const APP_DOWNLOAD_CONFIG = {
  route: '/download',
  appName: 'Fardelins',
  stores: {
    android: {
      platform: 'android',
      name: 'Google Play',
      shortName: 'Android',
      url: '',
      icon: '/home/google-play logo.svg',
    },
    ios: {
      platform: 'ios',
      name: 'App Store',
      shortName: 'iPhone',
      url: '',
      icon: '/home/apple-logo.svg',
    },
  } satisfies Record<'android' | 'ios', AppStoreLink>,
} as const;
