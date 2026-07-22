import { Component, inject } from '@angular/core';
import { HapticsService } from '@core/services/haptics.service';
import { ComponentConfig, ShaderBackground } from '../shader-background/shader-background';

@Component({
  selector: 'app-hero-liquid-background',
  standalone: true,
  imports: [ShaderBackground],
  templateUrl: './hero-liquid-background.html',
  styleUrl: './hero-liquid-background.css',
})
export class HeroLiquidBackground {
  private readonly haptics = inject(HapticsService);

  protected readonly preset: ComponentConfig[] = [
    {
      type: 'CursorRipples',
      props: {
        intensity: 16,
        decay: 5.5,
        radius: 0.88,
        chromaticSplit: 0.12,
        edges: 'mirror',
      },
      children: [
        {
          type: 'WaveDistortion',
          props: {
            strength: 0.58,
            frequency: 2.1,
            speed: 2.2,
            angle: -18,
            waveType: 'sine',
            edges: 'mirror',
          },
          children: [
            {
              type: 'LinearGradient',
              props: {
                colorA: '#31105b',
                colorB: '#8a38f5',
                start: { x: 0.08, y: 0.92 },
                end: { x: 0.94, y: 0.08 },
                angle: -12,
                edges: 'mirror',
                colorSpace: 'oklch',
              },
            },
          ],
        },
      ],
    },
  ];

  protected ripplePressed(event: PointerEvent): void {
    this.haptics.heroRipple(event);
  }
}
