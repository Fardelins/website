import { Component } from '@angular/core';
import { Hero } from '../../components/hero/hero';
import { LogoMarquee } from '../../components/logo-marquee/logo-marquee';
import { Audience } from '../../components/audience/audience';
import { Features } from '../../components/features/features';
import { About } from '../../components/about/about';
import { Journey } from '../../components/journey/journey';

@Component({
  selector: 'app-home',
  imports: [Hero, LogoMarquee, Audience, Features, About, Journey],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {}
