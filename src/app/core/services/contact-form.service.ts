import { HttpClient } from '@angular/common/http';
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

/** Submits the contact form to the Fardelins logistics API. */
@Injectable({ providedIn: 'root' })
export class ContactFormService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = injectLogisticsApiUrl();

  async send(message: ContactFormMessage): Promise<void> {
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
  }
}
