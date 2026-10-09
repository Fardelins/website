export type AppPromoTrigger =
  'first-signin' | 'order-success' | 'profile-saved' | 'milestone' | 'manual';

export interface AppPromoCopy {
  eyebrow: string;
  title: string;
  body: string;
}

/** Fire at most once per account, whatever the cadence window allows. */
export const ONE_SHOT_TRIGGERS: ReadonlySet<AppPromoTrigger> = new Set<AppPromoTrigger>([
  'first-signin',
  'milestone',
]);

/** `firstName` personalises the greeting where one exists; every trigger degrades cleanly without it. */
export function appPromoCopy(trigger: AppPromoTrigger, firstName: string | null): AppPromoCopy {
  switch (trigger) {
    case 'first-signin':
      return {
        eyebrow: firstName ? `Welcome, ${firstName}` : 'Welcome in',
        title: 'Fardelins fits in your pocket',
        body: 'Book a courier, watch the route and get a nudge at every status change, without opening another device.',
      };
    case 'order-success':
      return {
        eyebrow: 'Your parcel is booked',
        title: 'Follow this parcel from your phone',
        body: 'Push alerts the moment it is picked up, on the move, or handed over. No refreshing a tab.',
      };
    case 'profile-saved':
      return {
        eyebrow: 'We got you',
        title: 'One less thing to remember',
        body: 'Your saved addresses and documents are right where you left them. Open the app and your next delivery takes seconds.',
      };
    case 'milestone':
      return {
        eyebrow: firstName
          ? `${firstName}, you're one of our regulars`
          : "You're one of our regulars",
        title: "You've clearly got the hang of this",
        body: 'Reuse a saved address, repeat a past delivery and track it all from your phone.',
      };
    case 'manual':
      return {
        eyebrow: 'Fardelins mobile app',
        title: 'Take Fardelins with you',
        body: 'Book, track and review every delivery from your phone, wherever the day takes you.',
      };
  }
}
