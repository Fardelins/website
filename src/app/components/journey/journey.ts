import { Component } from '@angular/core';
import { StoreBadges } from '../store-badges/store-badges';
import { TiltDirective } from '../../directives/tilt.directive';

interface JourneyPanel {
  theme: 'purple' | 'dark' | 'blue';
  textTone: 'light' | 'dark';
  chip: string;
  title: string;
  description: string;
  phone: string;
  phoneSide: 'left' | 'right';
  cta: 'badges' | 'button';
  ctaLabel?: string;
}

@Component({
  selector: 'app-journey',
  standalone: true,
  imports: [StoreBadges, TiltDirective],
  templateUrl: './journey.html',
  styleUrl: './journey.css',
})
export class Journey {
  protected readonly panels: JourneyPanel[] = [
    {
      theme: 'purple',
      textTone: 'light',
      chip: 'Customers',
      title: 'Send, track, and manage deliveries from one simple app.',
      description:
        'Request pickups, follow deliveries live, receive status updates, and view your delivery history without calling back and forth.',
      phone: '/home/customer-phone.png',
      phoneSide: 'right',
      cta: 'badges',
    },
    {
      theme: 'dark',
      textTone: 'light',
      chip: 'Storefront',
      title: 'Turn customer orders into smooth deliveries.',
      description:
        'Connect your store, manage fulfillment, and give customers real-time visibility from checkout to delivery.',
      phone: '/home/storefront-phone.png',
      phoneSide: 'left',
      cta: 'badges',
    },
    {
      theme: 'blue',
      textTone: 'dark',
      chip: 'Courier & Dispatchers',
      title: 'Coordinate deliveries with better visibility.',
      description:
        'Assign deliveries, monitor active routes, update delivery progress, and keep teams aligned in real time.',
      phone: '/home/courier-phone.png',
      phoneSide: 'right',
      cta: 'button',
      ctaLabel: 'Join as a Courier',
    },
  ];
}
