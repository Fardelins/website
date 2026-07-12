import { Component, ElementRef, viewChild } from '@angular/core';
import { Card } from '../card/card';

interface AudienceItem {
  image: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-audience',
  standalone: true,
  imports: [Card],
  templateUrl: './audience.html',
  styleUrl: './audience.css',
})
export class Audience {
  protected readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  protected readonly items: AudienceItem[] = [
    {
      image: '/home/everyday-customer.png',
      title: 'Everyday Customers',
      description:
        'People who need to send packages, documents, food items, gifts, or personal deliveries across the city.',
    },
    {
      image: '/home/online-store.png',
      title: 'Online Stores',
      description:
        'Instagram vendors, Shopify stores, small e-commerce brands, and sellers who need reliable delivery after checkout.',
    },
    {
      image: '/home/retail-business.png',
      title: 'Retail Businesses',
      description:
        'Physical stores that want to offer delivery to customers without manually coordinating every order.',
    },
    {
      image: '/home/restaurants-food.png',
      title: 'Restaurants & Vendors',
      description: 'Food businesses that need fast pickup, delivery tracking, and customer updates.',
    },
    {
      image: '/home/courier-companies.png',
      title: 'Courier Companies',
      description:
        'Delivery businesses that need more customer demand, better order visibility, and smoother dispatch operations.',
    },
    {
      image: '/home/dispatch-riders.png',
      title: 'Dispatch Riders',
      description: 'Riders who receive delivery tasks, follow routes, update statuses, and complete deliveries.',
    },
  ];

  protected scrollByAmount(direction: 1 | -1): void {
    const el = this.track().nativeElement;
    const cardWidth = el.querySelector<HTMLElement>('.audience__item')?.offsetWidth ?? 400;
    const gap = 40;
    el.scrollBy({ left: direction * (cardWidth + gap), behavior: 'smooth' });
  }
}
