import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { SITE_NAME, SeoService } from '@core/services/seo.service';

@Component({
  selector: 'app-email-verified',
  imports: [RouterLink],
  templateUrl: './email-verified.html',
  styleUrl: './email-verified.css',
})
export class EmailVerified {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);

  private readonly query = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => ({
        status: params.get('status'),
        message: params.get('message'),
      })),
    ),
    {
      initialValue: {
        status: this.route.snapshot.queryParamMap.get('status'),
        message: this.route.snapshot.queryParamMap.get('message'),
      },
    },
  );

  protected readonly isSuccess = computed(() => this.query().status === 'success');

  protected readonly headline = computed(() =>
    this.isSuccess() ? 'Email verified' : 'Verification failed',
  );

  protected readonly description = computed(() => {
    if (this.isSuccess()) {
      return 'Your email address has been verified successfully. You can now sign in to your account.';
    }
    return this.query().message || 'This verification link is invalid or has expired.';
  });

  constructor() {
    const success = this.route.snapshot.queryParamMap.get('status') === 'success';
    this.seo.update({
      title: `${success ? 'Email Verified' : 'Verification Failed'} | ${SITE_NAME}`,
      description: success
        ? 'Your email address has been verified successfully.'
        : 'Email verification failed. The link may be invalid or expired.',
      path: '/email-verified',
      robots: 'noindex, follow',
    });
  }
}
