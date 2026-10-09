import { Location } from '@angular/common';
import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { solarAltArrowLeftBoldDuotone } from '@ng-icons/solar-icons/bold-duotone';
import { HapticsService } from '@core/services/haptics.service';
import { AuthArt, AuthPanel } from '../auth-panel/auth-panel';

const PANEL_BREAKPOINT = '(min-width: 1024px)';

@Component({
  selector: 'app-auth-shell',
  imports: [RouterLink, NgIcon, AuthPanel],
  viewProviders: [provideIcons({ solarAltArrowLeftBoldDuotone })],
  templateUrl: './auth-shell.html',
  styleUrl: './auth-shell.css',
})
export class AuthShell {
  private readonly location = inject(Location);
  private readonly haptics = inject(HapticsService);

  readonly heading = input.required<string>();
  readonly subheading = input<string>('');
  /** Only the recovery screens earn a back control; entry screens link out instead. */
  readonly showBack = input<boolean>(false);

  readonly art = input.required<AuthArt>();
  readonly panelLead = input.required<string>();
  readonly panelAccent = input<string>('Fardelins');
  readonly panelTail = input<string>('');
  readonly panelProof = input<string>('');

  // Gates the panel out entirely below the breakpoint, so phones never request
  // the shader chunk for a decoration they don't render.
  protected readonly wide = signal(false);

  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  constructor() {
    afterNextRender(() => {
      const query = matchMedia(PANEL_BREAKPOINT);
      this.wide.set(query.matches);
      query.addEventListener('change', (event) => this.wide.set(event.matches));
      this.playEntrance();
    });
  }

  // Every auth route is its own lazy component, so this plays fresh on each switch,
  // the same fade-up spring the login/QR pane toggle uses, reused as a page entrance.
  private playEntrance(): void {
    const element = this.body()?.nativeElement;
    if (!element) return;

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.style.opacity = '1';
      element.style.transform = 'none';
      return;
    }

    void import('motion/mini').then(({ animate }) =>
      animate(
        element,
        { opacity: 1, transform: 'translateY(0px)' },
        { type: 'spring', stiffness: 320, damping: 30, mass: 0.8 },
      ),
    );
  }

  protected goBack(): void {
    this.haptics.light();
    this.location.back();
  }
}
