import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import boring from 'boring-avatars-vanilla';

const PALETTE = ['#521c99', '#7449ad', '#9776c1', '#b9a4d6', '#dcd1ea'];

@Component({
  selector: 'app-store-avatar',
  template: `<span class="avatar" role="img" [attr.aria-label]="name() + ' avatar'" [innerHTML]="svg()"></span>`,
  styles: `
    :host {
      display: block;
      overflow: hidden;
      border-radius: 12px;
    }
    .avatar,
    .avatar ::ng-deep svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreAvatar {
  private readonly sanitizer = inject(DomSanitizer);
  readonly name = input.required<string>();

  // Generated locally from our own palette and a hash of the name, so the markup is safe to trust.
  protected readonly svg = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(
      boring({ name: this.name().trim() || 'Store', variant: 'beam', size: '100%', square: true, colors: PALETTE }),
    ),
  );
}
