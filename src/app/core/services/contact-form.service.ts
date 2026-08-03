import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { injectLogisticsApiUrl } from './logistics-api.config';

export interface ContactFormMessage {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  subject: string;
  message: string;
}

/** A 400 from the API's field validation, distinct from a real send failure. */
export class ContactFormValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join(' '));
  }
}

/** Submits the contact form to the Fardelins logistics API. */
@Injectable({ providedIn: 'root' })
export class ContactFormService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = injectLogisticsApiUrl();

  async send(message: ContactFormMessage): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(this.apiUrl('/public/contact-us'), {
          first_name: message.firstName.trim(),
          last_name: message.lastName.trim(),
          email: message.email.trim(),
          company_name: message.company.trim() || undefined,
          subject: message.subject.trim(),
          message: message.message.trim(),
        }),
      );
    } catch (error) {
      throw this.toDisplayError(error);
    }
  }

  private toDisplayError(error: unknown): unknown {
    if (!(error instanceof HttpErrorResponse) || error.status !== 400) return error;

    const body = error.error as { message?: string | string[] } | null;
    const issues = Array.isArray(body?.message)
      ? body.message
      : body?.message
        ? [body.message]
        : [];
    return issues.length ? new ContactFormValidationError(issues) : error;
  }
}
