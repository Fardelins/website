import { Component, inject, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideCircleCheck } from '@ng-icons/lucide';
import {
  ComponentConfig,
  ShaderBackground,
} from '@shared/components/shader-background/shader-background';
import { FaqAccordion } from '@shared/components/faq-accordion/faq-accordion';
import { TiltDirective } from '@shared/directives/tilt.directive';
import {
  ContactFormMessage,
  ContactFormService,
  ContactFormValidationError,
} from '@core/services/contact-form.service';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { CONTACT_FAQS } from './contact-faq.data';

// contact-us can take minutes to respond (synchronous email send) — reassure in two stages.
const HINT_STAGE_1_MS = 8000;
const HINT_STAGE_2_MS = 60000;

const CONTACT_ABERRATION_ID = 'contact-aberration';
const CONTACT_IMAGE_PRESET: ComponentConfig[] = [
  {
    type: 'ChromaticAberration',
    id: CONTACT_ABERRATION_ID,
    props: { strength: 0, angle: 0 },
    children: [
      {
        type: 'GridDistortion',
        props: { intensity: 2.5, decay: 4, radius: 2.4, gridSize: 24, edges: 'stretch' },
        children: [
          { type: 'ImageTexture', props: { url: '/contact/image-960.webp', objectFit: 'cover' } },
        ],
      },
    ],
  },
];

@Component({
  selector: 'app-contact',
  imports: [ShaderBackground, TiltDirective, FaqAccordion, NgIcon],
  viewProviders: [provideIcons({ lucideCircleCheck, lucideCircleAlert })],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class Contact {
  private readonly contactForm = inject(ContactFormService);
  private readonly haptics = inject(HapticsService);
  private readonly seo = inject(SeoService);
  protected readonly submissionState = signal<'idle' | 'submitting' | 'success' | 'error'>('idle');
  protected readonly hintStage = signal<0 | 1 | 2>(0);
  protected readonly validationIssues = signal<string[] | null>(null);
  protected readonly faqs = CONTACT_FAQS;
  protected readonly contactImagePreset = CONTACT_IMAGE_PRESET;
  protected readonly imageShader = viewChild<ShaderBackground>('imageShader');
  private hoverTarget = 0;
  private hoverCurrent = 0;
  private hoverRafId: number | null = null;
  private hintTimers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    this.seo.update({
      title: `Contact ${SITE_NAME} | Support and Partnerships`,
      description:
        'Contact the Fardelins team about deliveries, partnerships, or support. We usually respond within 24 business hours.',
      path: '/contact',
      type: 'website',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          name: `Contact ${SITE_NAME}`,
          url: 'https://fardelins.com/contact',
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: CONTACT_FAQS.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: { '@type': 'Answer', text: faq.answer },
          })),
        },
      ],
    });
  }

  protected async submitForm(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.submissionState() === 'submitting') return;

    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    this.haptics.light();

    const values = new FormData(form);
    const message: ContactFormMessage = {
      firstName: String(values.get('firstName') ?? ''),
      lastName: String(values.get('lastName') ?? ''),
      company: String(values.get('company') ?? ''),
      email: String(values.get('email') ?? ''),
      subject: String(values.get('subject') ?? ''),
      message: String(values.get('message') ?? ''),
    };

    this.submissionState.set('submitting');
    this.hintStage.set(0);
    this.validationIssues.set(null);
    this.hintTimers.push(
      setTimeout(() => this.hintStage.set(1), HINT_STAGE_1_MS),
      setTimeout(() => this.hintStage.set(2), HINT_STAGE_2_MS),
    );
    try {
      await this.contactForm.send(message);
      this.submissionState.set('success');
      form.reset();
      this.haptics.success();
    } catch (error) {
      this.submissionState.set('error');
      if (error instanceof ContactFormValidationError) this.validationIssues.set(error.issues);
      this.haptics.error();
    } finally {
      this.hintTimers.forEach(clearTimeout);
      this.hintTimers = [];
      this.hintStage.set(0);
    }
  }

  protected setMessageValidity(el: HTMLTextAreaElement): void {
    if (!el.validity.tooShort) return;
    el.setCustomValidity(
      `You need at least ${el.minLength} characters. Character count: ${el.value.length}.`,
    );
  }

  protected formatIssues(issues: string[]): string {
    return `${issues.map((issue) => issue.charAt(0).toUpperCase() + issue.slice(1)).join('. ')}.`;
  }

  protected setImageHover(hovered: boolean): void {
    this.hoverTarget = hovered ? 0.5 : 0;
    if (this.hoverRafId !== null) return;
    const step = (): void => {
      this.hoverCurrent += (this.hoverTarget - this.hoverCurrent) * 0.12;
      this.imageShader()?.update(CONTACT_ABERRATION_ID, { strength: this.hoverCurrent });
      this.hoverRafId =
        Math.abs(this.hoverTarget - this.hoverCurrent) < 0.002 ? null : requestAnimationFrame(step);
    };
    this.hoverRafId = requestAnimationFrame(step);
  }
}
