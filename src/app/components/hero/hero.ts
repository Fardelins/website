import { Component } from '@angular/core';
import { StoreBadges } from '../store-badges/store-badges';
import { TiltDirective } from '../../directives/tilt.directive';
import { HeroLiquidBackground } from '../hero-liquid-background/hero-liquid-background';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [StoreBadges, HeroLiquidBackground, TiltDirective],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {}
