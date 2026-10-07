import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject } from '@angular/core';
import {
  ComponentConfig,
  ShaderBackground,
} from '@shared/components/shader-background/shader-background';

@Component({
  selector: 'app-send-card-stage',
  imports: [ShaderBackground],
  templateUrl: './send-card-stage.html',
  styleUrl: './send-card-stage.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendCardStage {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly reducedMotion =
    this.isBrowser && matchMedia('(prefers-reduced-motion: reduce)').matches;

  protected readonly preset: ComponentConfig[] = [
    {
      type: 'CursorRipples',
      props: {
        intensity: 9,
        decay: 6.5,
        radius: 0.6,
        chromaticSplit: 0.35,
        edges: 'stretch',
      },
      children: [
        {
          type: 'FlowingGradient',
          props: {
            colorA: '#3a1370',
            colorB: '#6d28d9',
            colorC: '#a855f7',
            colorD: '#4c1d95',
            colorSpace: 'oklch',
            speed: this.reducedMotion ? 0 : 0.35,
            distortion: 0.45,
            seed: 4,
          },
        },
      ],
    },
  ];
}
