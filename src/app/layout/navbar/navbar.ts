import { Component, ElementRef, HostListener, ViewChild, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { HapticsService } from '@core/services/haptics.service';

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
  private readonly auth = inject(AuthService);

  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly displayName = this.auth.displayName;
  protected readonly avatarUrl = computed(() => this.auth.user()?.avatarUrl ?? null);
  protected readonly initials = computed(() => {
    const user = this.auth.user();
    if (!user) return '';
    return (
      `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.trim() || user.email.charAt(0)
    ).toUpperCase();
  });
  protected isMenuOpen = false;
  protected isScrolled = false;
  protected get isDownloadPage(): boolean {
    return this.router.url.split(/[?#]/, 1)[0] === '/download';
  }
  protected get isFeaturesPage(): boolean {
    return this.router.url.split(/[?#]/, 1)[0] === '/features';
  }
  protected get isTrackPage(): boolean {
    const path = this.router.url.split(/[?#]/, 1)[0];
    return path === '/track' || path.startsWith('/track/');
  }
  protected get useLightNavigation(): boolean {
    return (this.isFeaturesPage || this.isTrackPage) && !this.isScrolled && !this.isMenuOpen;
  }

  protected readonly navLinks = [
    { label: 'Features', path: '/features', fragment: undefined },
    { label: 'Blogs', path: '/blogs', fragment: undefined },
    { label: 'Track Order', path: '/track', fragment: undefined },
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
