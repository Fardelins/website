import { Component, signal, viewChild } from '@angular/core';
import { ComponentConfig, ShaderBackground } from '../../components/shader-background/shader-background';
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
        children: [{ type: 'ImageTexture', props: { url: '/contact/image.png', objectFit: 'cover' } }],
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
  protected readonly openFaq = signal<number | null>(null);
  protected readonly submitted = signal(false);
  protected readonly faqs = CONTACT_FAQS;
  protected readonly contactImagePreset = CONTACT_IMAGE_PRESET;
  protected readonly imageShader = viewChild<ShaderBackground>('imageShader');
  private hoverTarget = 0;
  private hoverCurrent = 0;
  private hoverRafId: number | null = null;

  protected toggleFaq(index: number): void {
    this.openFaq.set(this.openFaq() === index ? null : index);
  }

  protected submitForm(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
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
