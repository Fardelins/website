import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { HapticsService } from '../../services/haptics.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  @ViewChild('menuToggle', { read: ElementRef })
  private menuToggle?: ElementRef<HTMLButtonElement>;

  private readonly haptics = inject(HapticsService);
  private readonly router = inject(Router);
  protected isMenuOpen = false;
  protected isScrolled = false;
  protected get isDownloadPage(): boolean {
    return this.router.url.split(/[?#]/, 1)[0] === '/download';
  }
  protected get isFeaturesPage(): boolean {
    return this.router.url.split(/[?#]/, 1)[0] === '/features';
  }
  protected get useLightNavigation(): boolean {
    return this.isFeaturesPage && !this.isScrolled && !this.isMenuOpen;
  }

  protected readonly navLinks = [
    { label: 'Features', path: '/features', fragment: undefined },
    { label: 'Blogs', path: '/blogs', fragment: undefined },
    { label: 'Contact Us', path: '/contact', fragment: undefined },
  ];

  protected toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    this.haptics.selection();
  }

  protected closeMenu(restoreFocus = false): void {
    if (this.isMenuOpen) this.haptics.light();
    this.isMenuOpen = false;
    if (restoreFocus) queueMicrotask(() => this.menuToggle?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (!this.isMenuOpen) return;
    event.preventDefault();
    this.closeMenu(true);
  }

  @HostListener('window:scroll')
  protected onWindowScroll(): void {
    this.isScrolled = window.scrollY > 12;
  }
}
