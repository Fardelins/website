import { ChangeDetectionStrategy, Component, OnDestroy, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { solarArrowRightBoldDuotone } from '@ng-icons/solar-icons/bold-duotone';
import {
  ComponentConfig,
  ShaderBackground,
} from '@shared/components/shader-background/shader-background';
import { TiltDirective } from '@shared/directives/tilt.directive';
import { SendCardStage } from '../send-card-stage/send-card-stage';

// Same pattern as the home page's about.ts image treatment: feed the art into
// the shader as a texture so GridDistortion (an "Interactive" shader) can warp
// it under the real cursor, with a chromatic-aberration pop layered on hover.
const ART_ABERRATION_ID = 'send-card-art-aberration';
const ART_HOVER_STRENGTH = 0.5;
const HOVER_EASE = 0.12;

@Component({
  selector: 'app-send-parcel-card',
  imports: [RouterLink, NgIcon, SendCardStage, ShaderBackground, TiltDirective],
  viewProviders: [provideIcons({ solarArrowRightBoldDuotone })],
  templateUrl: './send-parcel-card.html',
  styleUrl: './send-parcel-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendParcelCard implements OnDestroy {
  readonly firstParcel = input(false);

  protected readonly artPreset: ComponentConfig[] = [
    {
      type: 'ChromaticAberration',
      id: ART_ABERRATION_ID,
      props: { strength: 0, angle: 0 },
      children: [
        {
          type: 'GridDistortion',
          props: { intensity: 2.2, decay: 4, radius: 2.2, gridSize: 22, edges: 'stretch' },
          children: [
            {
              type: 'ImageTexture',
              props: { url: '/app/package-box-wings-350.webp', objectFit: 'contain' },
            },
          ],
        },
      ],
    },
  ];

  private readonly artShader = viewChild<ShaderBackground>('artShader');
  private readonly artHover = { target: 0, current: 0, rafId: null as number | null };

  protected setArtHover(hovered: boolean): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.artHover.target = hovered ? ART_HOVER_STRENGTH : 0;
    this.startArtHoverLoop();
  }

  ngOnDestroy(): void {
    if (this.artHover.rafId !== null) cancelAnimationFrame(this.artHover.rafId);
  }

  private startArtHoverLoop(): void {
    if (this.artHover.rafId !== null) return;
    const step = (): void => {
      this.artHover.current += (this.artHover.target - this.artHover.current) * HOVER_EASE;
      this.artShader()?.update(ART_ABERRATION_ID, { strength: this.artHover.current });

      const settled = Math.abs(this.artHover.target - this.artHover.current) < 0.002;
      this.artHover.rafId = settled ? null : requestAnimationFrame(step);
    };
    this.artHover.rafId = requestAnimationFrame(step);
  }
}
