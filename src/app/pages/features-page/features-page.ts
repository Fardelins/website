import { Component, inject } from '@angular/core';
import {
  FeatureShowcase,
  FeatureShowcaseItem,
  FeatureShowcaseLayeredVisual,
} from '../../components/feature-showcase/feature-showcase';
import { ComponentConfig } from '../../components/shader-background/shader-background';
import { FaqAccordion } from '../../components/faq-accordion/faq-accordion';
import { SITE_NAME, SeoService } from '../../services/seo.service';
import { FEATURES_FAQS } from './features-faq.data';

// `sizes` for the responsive visual slots, derived from the CSS: the scene is
// `min(1280px, 100%)`; the background fills it, phone mockups sit at ~31% of it,
// and the courier desktop dashboard at ~78%.
const BG_SIZES = '(min-width: 1360px) 1280px, 100vw';
const PHONE_MOCKUP_SIZES = '(min-width: 1360px) 400px, 31vw';
const DESKTOP_MOCKUP_SIZES = '(min-width: 1360px) 1000px, 78vw';

@Component({
  selector: 'app-features-page',
  standalone: true,
  imports: [FeatureShowcase, FaqAccordion],
  templateUrl: './features-page.html',
  styleUrl: './features-page.css',
})
export class FeaturesPage {
  protected readonly faqs = FEATURES_FAQS;

  // Tracking: flowing gradient tuned to the realtime-bg palette, calm behind the mockups.
  protected readonly trackingShaderPreset: ComponentConfig[] = [
    {
      type: 'FlowingGradient',
      props: {
        colorA: '#31105b',
        colorB: '#521c99',
        colorC: '#9776c1',
        colorD: '#7b6fd0',
        colorSpace: 'oklch',
        speed: 1.9,
        distortion: 0.8,
      },
    },
  ];

  // Dispatcher: periwinkle/indigo silk echoing dispatcher-operations-bg.
  protected readonly dispatcherShaderPreset: ComponentConfig[] = [
    {
      type: 'FlowingGradient',
      props: {
        colorA: '#2a1550',
        colorB: '#521c99',
        colorC: '#7d78c8',
        colorD: '#e0b48f',
        colorSpace: 'oklch',
        speed: 1.7,
        distortion: 0.78,
      },
    },
  ];

  // Courier: pastel iridescent matching the lighter courier-management-bg.
  protected readonly courierShaderPreset: ComponentConfig[] = [
    {
      type: 'FlowingGradient',
      props: {
        colorA: '#b98a97',
        colorB: '#521c99',
        colorC: '#e0a880',
        colorD: '#8fa9cf',
        colorSpace: 'oklch',
        speed: 1.6,
        distortion: 0.82,
      },
    },
  ];

  // Merchant: muted grey-lavender matching the desaturated merchant-storefront-bg.
  protected readonly merchantShaderPreset: ComponentConfig[] = [
    {
      type: 'FlowingGradient',
      props: {
        colorA: '#7c778f',
        colorB: '#521c99',
        colorC: '#cf9f78',
        colorD: '#6f97a8',
        colorSpace: 'oklch',
        speed: 1.6,
        distortion: 0.8,
      },
    },
  ];

  // Delivery: lightest of the set, light-end brand ramp to match the pale delivery-bg.
  protected readonly deliveryShaderPreset: ComponentConfig[] = [
    {
      type: 'FlowingGradient',
      props: {
        colorA: '#cbc4dd',
        colorB: '#9776c1',
        colorC: '#efeaf7',
        colorD: '#b9a4d6',
        colorSpace: 'oklch',
        speed: 1.4,
        distortion: 0.72,
      },
    },
  ];

  protected readonly trackingVisual: FeatureShowcaseLayeredVisual = {
    variant: 'tracking',
    background: { src: '/features/realtime-bg-1600.webp', width: 1600, height: 900, smallWidth: 800, sizes: BG_SIZES },
    mockup: { src: '/features/realtime-mockup-1000.webp', width: 1000, height: 2040, smallWidth: 500, sizes: PHONE_MOCKUP_SIZES },
    firstLayer: { src: '/features/realtime-accepted-760.webp', width: 760, height: 335 },
    secondLayer: { src: '/features/realtime-details-760.webp', width: 760, height: 390 },
    thirdLayer: { src: '/features/realtime-in_transit-760.webp', width: 760, height: 335 },
    alt: 'Fardelins live delivery map with order acceptance, ETA, and in-transit updates',
  };

  protected readonly dispatcherVisual: FeatureShowcaseLayeredVisual = {
    variant: 'dispatcher',
    background: { src: '/features/dispatcher-operations-bg-1600.webp', width: 1600, height: 900, smallWidth: 800, sizes: BG_SIZES },
    mockup: { src: '/features/dispatcher-operations-mockup-1000.webp', width: 1000, height: 2039, smallWidth: 500, sizes: PHONE_MOCKUP_SIZES },
    firstLayer: { src: '/features/dispatcher-operations-order-760.webp', width: 760, height: 274 },
    secondLayer: {
      src: '/features/dispatcher-operations-delivery-760.webp',
      width: 760,
      height: 404,
    },
    thirdLayer: {
      src: '/features/dispatcher-operations-active_order-760.webp',
      width: 760,
      height: 317,
    },
    alt: 'Fardelins dispatcher view with delivery details, proof status, and active orders',
  };

  protected readonly courierVisual: FeatureShowcaseLayeredVisual = {
    variant: 'courier',
    background: { src: '/features/courier-management-bg-1600.webp', width: 1600, height: 900, smallWidth: 800, sizes: BG_SIZES },
    mockup: { src: '/features/courier-management-mockup-1800.webp', width: 1800, height: 1013, smallWidth: 900, sizes: DESKTOP_MOCKUP_SIZES },
    firstLayer: { src: '/features/courier-management-admin-760.webp', width: 760, height: 325 },
    secondLayer: {
      src: '/features/courier-management-dispatcher-760.webp',
      width: 760,
      height: 259,
    },
    alt: 'Fardelins courier management dashboard with admin profile and dispatcher reassignment cards',
  };

  protected readonly merchantVisual: FeatureShowcaseLayeredVisual = {
    variant: 'merchant',
    background: { src: '/features/merchant-storefront-bg-1600.webp', width: 1600, height: 900, smallWidth: 800, sizes: BG_SIZES },
    mockup: { src: '/features/merchant-storefront-mockup-1000.webp', width: 1000, height: 2040, smallWidth: 500, sizes: PHONE_MOCKUP_SIZES },
    firstLayer: { src: '/features/merchant-storefront-default-760.webp', width: 760, height: 293 },
    secondLayer: { src: '/features/merchant-storefront-setup-760.webp', width: 760, height: 317 },
    alt: 'Fardelins storefront integration showing default courier assignment and store setup',
  };

  protected readonly deliveryVisual: FeatureShowcaseLayeredVisual = {
    variant: 'delivery',
    background: { src: '/features/delivery-bg-1600.webp', width: 1600, height: 900, smallWidth: 800, sizes: BG_SIZES },
    mockup: { src: '/features/delivery-mockup-1000.webp', width: 1000, height: 2039, smallWidth: 500, sizes: PHONE_MOCKUP_SIZES },
    firstLayer: { src: '/features/delivery-proof-760.webp', width: 760, height: 1059 },
    alt: 'Fardelins proof-of-delivery confirmation with a delivery photo and confirm action',
  };

  protected readonly trackingFeatures: readonly FeatureShowcaseItem[] = [
    {
      title: 'Live Delivery Tracking',
      description: 'Track deliveries from pickup to completion with real-time location updates.',
    },
    {
      title: 'Accurate ETAs',
      description: 'Keep customers informed with estimated arrival times and delivery progress.',
    },
    {
      title: 'Delivery Timeline',
      description: 'View every step of the delivery journey from assignment to completion.',
    },
    {
      title: 'Proof of Delivery',
      description: 'Access delivery confirmations, timestamps, and completion records.',
    },
  ];

  protected readonly dispatcherFeatures: readonly FeatureShowcaseItem[] = [
    {
      title: 'Delivery Visibility',
      description: 'Monitor active deliveries from a single operational view.',
    },
    {
      title: 'Status Management',
      description: 'Update delivery progress and keep operations moving smoothly.',
    },
    {
      title: 'Issue Resolution',
      description: 'Quickly identify and resolve delivery issues as they occur.',
    },
    {
      title: 'Route Oversight',
      description: 'Track routes and delivery activity in real time.',
    },
  ];

  protected readonly courierFeatures: readonly FeatureShowcaseItem[] = [
    {
      title: 'Courier Assignment',
      description: 'Assign deliveries efficiently based on availability and workload.',
    },
    {
      title: 'Workforce Visibility',
      description: 'See which couriers are active and currently handling deliveries.',
    },
    {
      title: 'Delivery Coordination',
      description: 'Keep riders and dispatch teams aligned throughout the delivery process.',
    },
    {
      title: 'Operational Control',
      description: 'Manage delivery activity with greater transparency and accountability.',
    },
  ];

  protected readonly merchantFeatures: readonly FeatureShowcaseItem[] = [
    {
      title: 'Order Fulfillment',
      description: 'Turn customer orders into trackable deliveries.',
    },
    {
      title: 'Delivery Coordination',
      description: 'Manage fulfillment and delivery operations from one workflow.',
    },
    {
      title: 'Customer Visibility',
      description: 'Give customers greater transparency into delivery progress.',
    },
    {
      title: 'Scalable Operations',
      description: 'Support growing delivery volumes with streamlined processes.',
    },
  ];

  protected readonly deliveryFeatures: readonly FeatureShowcaseItem[] = [
    {
      title: 'Delivery Verification',
      description: 'Capture evidence that deliveries were completed successfully.',
    },
    {
      title: 'Photo Confirmation',
      description: 'Record delivery completion with visual proof.',
    },
    {
      title: 'Timestamp Records',
      description: 'Maintain accurate records for completed deliveries.',
    },
    {
      title: 'Operational Accountability',
      description: 'Improve trust between businesses, couriers, and customers.',
    },
  ];

  constructor() {
    inject(SeoService).update({
      title: `Features | ${SITE_NAME}`,
      description:
        'Explore the Fardelins tools for delivery requests, real-time tracking, dispatch operations, and connected delivery management.',
      path: '/features',
      type: 'website',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FEATURES_FAQS.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: { '@type': 'Answer', text: faq.answer },
          })),
        },
      ],
    });
  }
}
