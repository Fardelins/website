import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Directive, ElementRef, OnInit, PLATFORM_ID, Renderer2, inject } from '@angular/core';

/** Re-parents the host under <app-app-shell> so a fixed overlay isn't clipped by an overflow:hidden ancestor, keeping the shell's :host-scoped tokens that document.body would lose. */
@Directive({
  selector: '[appPortalToShell]',
  standalone: true,
})
export class PortalToShellDirective implements OnInit {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  ngOnInit(): void {
    if (!this.isBrowser) return;
    const target = this.document.querySelector('app-app-shell') ?? this.document.body;
    this.renderer.appendChild(target, this.host.nativeElement);
  }
}
