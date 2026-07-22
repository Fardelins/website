import { Component } from '@angular/core';

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-features',
  standalone: true,
  templateUrl: './features.html',
  styleUrl: './features.css',
})
export class Features {
  protected readonly items: FeatureItem[] = [
    {
      icon: '/home/easy-delivery.svg',
      title: 'Easy Delivery Requests',
      description: 'Create pickups and deliveries in seconds without complicated steps.',
    },
    {
      icon: '/home/real-time.svg',
      title: 'Real-Time Tracking',
      description: 'Track deliveries live from pickup to drop-off with accurate progress updates.',
    },
    {
      icon: '/home/smart-delivery.svg',
      title: 'Smart Delivery Updates',
      description: 'Stay informed with notifications at every important delivery stage.',
    },
    {
      icon: '/home/store.svg',
      title: 'Storefront Integrations',
      description: 'Connect customer orders directly to your delivery workflow.',
    },
    {
      icon: '/home/courier.svg',
      title: 'Courier Coordination',
      description: 'Dispatch and manage active delivery tasks efficiently.',
    },
    {
      icon: '/home/route.svg',
      title: 'Route Visibility',
      description: 'Monitor delivery movement and progress in real time.',
    },
  ];
}
