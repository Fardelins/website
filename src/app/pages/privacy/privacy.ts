import { afterNextRender, Component, computed, ElementRef, inject, OnDestroy, signal, viewChildren } from '@angular/core';
import { HapticsService } from '../../services/haptics.service';
import { SITE_NAME, SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-privacy',
  imports: [],
  templateUrl: './privacy.html',
  styleUrl: './privacy.css',
})
export class Privacy implements OnDestroy {
  private readonly haptics = inject(HapticsService);
  private readonly seo = inject(SeoService);
  protected readonly sections = [
    { id: 'information-we-collect', label: 'Information We Collect' },
    { id: 'personal-information', label: 'Personal Information' },
    { id: 'delivery-information', label: 'Delivery Information' },
    { id: 'device-information', label: 'Device Information' },
    { id: 'location-information', label: 'Location Information' },
    { id: 'how-we-use-information', label: 'How We Use Your Information' },
    { id: 'notifications', label: 'Notifications and Communications' },
    { id: 'sharing-information', label: 'Sharing Information' },
    { id: 'delivery-partners', label: 'Delivery Partners' },
    { id: 'service-providers', label: 'Service Providers' },
    { id: 'legal-requirements', label: 'Legal Requirements' },
    { id: 'data-retention', label: 'Data Retention' },
    { id: 'data-security', label: 'Data Security' },
    { id: 'privacy-rights', label: 'Your Privacy Rights' },
    { id: 'cookies', label: 'Cookies and Similar Technologies' },
    { id: 'third-party-services', label: 'Third-Party Services' },
    { id: 'childrens-privacy', label: "Children's Privacy" },
    { id: 'international-transfers', label: 'International Data Transfers' },
    { id: 'policy-changes', label: 'Changes to This Privacy Policy' },
    { id: 'contact-us', label: 'Contact Us' },
  ];

  protected readonly activeSection = signal(0);
  protected readonly readingProgress = computed(() =>
    this.sections.length > 1 ? this.activeSection() / (this.sections.length - 1) : 0,
  );
  private readonly sectionElements = viewChildren<ElementRef<HTMLElement>>('privacySection');
  private observer?: IntersectionObserver;

  constructor() {
    this.seo.update({
      title: `Privacy Policy | ${SITE_NAME}`,
      description: 'How Fardelins collects, uses, stores, and protects your personal information across our platform and services.',
      path: '/privacy',
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
    window.history.pushState(null, '', `/privacy#${id}`);
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  private observeSections(): void {
    this.observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (!visible.length) return;
      const index = this.sectionElements().findIndex(item => item.nativeElement === visible[0].target);
      if (index >= 0) this.activeSection.set(index);
    }, { rootMargin: '-20% 0px -65% 0px', threshold: 0 });
    this.sectionElements().forEach(item => this.observer?.observe(item.nativeElement));
  }

  ngOnDestroy(): void { this.observer?.disconnect(); }
}
