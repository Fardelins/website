import { Component, inject, signal, viewChild } from '@angular/core';
import { ComponentConfig, ShaderBackground } from '../../components/shader-background/shader-background';
import { ContactFormMessage, ContactFormService } from '../../services/contact-form.service';
import { HapticsService } from '../../services/haptics.service';
import { SITE_NAME, SeoService } from '../../services/seo.service';
import { CONTACT_FAQS } from './contact-faq.data';

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
        children: [{ type: 'ImageTexture', props: { url: '/contact/image-960.webp', objectFit: 'cover' } }],
      },
    ],
  },
];

@Component({
  selector: 'app-contact',
  imports: [ShaderBackground],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class Contact {
  private readonly contactForm = inject(ContactFormService);
  private readonly haptics = inject(HapticsService);
  private readonly seo = inject(SeoService);
  protected readonly openFaq = signal<number | null>(null);
  protected readonly submissionState = signal<'idle' | 'submitting' | 'success' | 'error'>('idle');
  protected readonly faqs = CONTACT_FAQS;
  protected readonly contactImagePreset = CONTACT_IMAGE_PRESET;
  protected readonly imageShader = viewChild<ShaderBackground>('imageShader');
  private hoverTarget = 0;
  private hoverCurrent = 0;
  private hoverRafId: number | null = null;

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

  protected toggleFaq(index: number): void {
    this.openFaq.set(this.openFaq() === index ? null : index);
    this.haptics.selection();
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
    try {
      await this.contactForm.send(message);
      this.submissionState.set('success');
      form.reset();
      this.haptics.success();
    } catch {
      this.submissionState.set('error');
      this.haptics.error();
    }
  }

  protected setImageHover(hovered: boolean): void {
    this.hoverTarget = hovered ? 0.5 : 0;
    if (this.hoverRafId !== null) return;
    const step = (): void => {
      this.hoverCurrent += (this.hoverTarget - this.hoverCurrent) * 0.12;
      this.imageShader()?.update(CONTACT_ABERRATION_ID, { strength: this.hoverCurrent });
      this.hoverRafId = Math.abs(this.hoverTarget - this.hoverCurrent) < 0.002 ? null : requestAnimationFrame(step);
    };
    this.hoverRafId = requestAnimationFrame(step);
  }
}
