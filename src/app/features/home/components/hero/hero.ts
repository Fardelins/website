import { Component } from '@angular/core';
import { StoreBadges } from '@shared/components/store-badges/store-badges';
import { TiltDirective } from '@shared/directives/tilt.directive';
import { HeroLiquidBackground } from '@shared/components/hero-liquid-background/hero-liquid-background';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [StoreBadges, HeroLiquidBackground, TiltDirective],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {}
