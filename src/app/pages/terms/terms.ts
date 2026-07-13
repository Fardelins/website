import { afterNextRender, Component, computed, ElementRef, inject, OnDestroy, signal, viewChildren } from '@angular/core';
import { HapticsService } from '../../services/haptics.service';
import { SITE_NAME, SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-terms',
  imports: [],
  templateUrl: './terms.html',
  styleUrl: './terms.css',
})
export class Terms implements OnDestroy {
  private readonly haptics = inject(HapticsService);
  private readonly seo = inject(SeoService);
  protected readonly sections = [
    { id: 'about-fardelins', label: 'About Fardelins' },
    { id: 'eligibility', label: 'Eligibility' },
    { id: 'user-accounts', label: 'User Accounts' },
    { id: 'delivery-services', label: 'Delivery Services' },
    { id: 'prohibited-activities', label: 'Prohibited Activities' },
    { id: 'payments-and-fees', label: 'Payments and Fees' },
    { id: 'user-content', label: 'User Content' },
    { id: 'privacy', label: 'Privacy' },
    { id: 'intellectual-property', label: 'Intellectual Property' },
    { id: 'service-availability', label: 'Service Availability' },
    { id: 'limitation-of-liability', label: 'Limitation of Liability' },
    { id: 'indemnification', label: 'Indemnification' },
    { id: 'changes-to-terms', label: 'Changes to These Terms' },
    { id: 'termination', label: 'Termination' },
    { id: 'contact-information', label: 'Contact Information' },
  ];

  protected readonly activeSection = signal(0);
  protected readonly readingProgress = computed(() =>
    this.sections.length > 1 ? this.activeSection() / (this.sections.length - 1) : 0,
  );
  private readonly sectionElements = viewChildren<ElementRef<HTMLElement>>('termSection');
  private observer?: IntersectionObserver;

  constructor() {
    this.seo.update({
      title: `Terms and Conditions | ${SITE_NAME}`,
      description: 'The terms and conditions governing your access to and use of the Fardelins platform and services.',
      path: '/terms',
      type: 'website',
    });
    afterNextRender(() => this.observeSections());
  }

  protected selectSection(event: MouseEvent, id: string, index: number): void {
    event.preventDefault();
    this.activeSection.set(index);
    this.haptics.selection();

    const target = document.getElementById(id);
    if (!target) return;

    window.history.pushState(null, '', `/terms#${id}`);
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  private observeSections(): void {
    this.observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length) {
          const index = this.sectionElements().findIndex(item => item.nativeElement === visible[0].target);
          if (index >= 0) this.activeSection.set(index);
        }
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 },
    );

    this.sectionElements().forEach(item => this.observer?.observe(item.nativeElement));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
