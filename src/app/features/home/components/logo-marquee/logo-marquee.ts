import { Component } from '@angular/core';

@Component({
  selector: 'app-logo-marquee',
  standalone: true,
  templateUrl: './logo-marquee.html',
  styleUrl: './logo-marquee.css',
})
export class LogoMarquee {
  protected readonly logos = Array.from({ length: 7 });
}
