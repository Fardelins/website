import { Component, HostListener, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HapticsService } from '../../services/haptics.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly haptics = inject(HapticsService);
  protected isMenuOpen = false;
  protected isScrolled = false;

  protected readonly navLinks = [
    { label: 'Features', path: '/', fragment: 'features' },
    { label: 'Blogs', path: '/blogs', fragment: undefined },
    { label: 'Contact Us', path: '/contact', fragment: undefined },
  ];

  protected toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    this.haptics.selection();
  }

  protected closeMenu(): void {
    if (this.isMenuOpen) this.haptics.light();
    this.isMenuOpen = false;
  }

  @HostListener('window:scroll')
  protected onWindowScroll(): void { this.isScrolled = window.scrollY > 12; }
}
