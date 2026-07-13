import { Injectable } from '@angular/core';

const FORM_ID = '285';
const CONTACT_PAGE_ID = '257';
const CONFIG_ENDPOINT = '/contact-form-config';
const EMAIL_CHECK_ENDPOINT = '/wp-json/cleantalk-antispam/v1/check_email_before_post';
const SUBMIT_ENDPOINT = '/wp-admin/admin-ajax.php';

export interface ContactFormMessage {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  subject: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ContactFormService {
  async send(message: ContactFormMessage): Promise<void> {
    const email = message.email.trim();
    await this.checkEmail(email);

    const body = await this.createSubmission(message);
    const response = await fetch(SUBMIT_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
    });
    if (!response.ok) throw new Error(`Contact request failed: ${response.status}`);

    const result = (await response.json()) as { success?: boolean; data?: { message?: string } };
    if (!result.success) {
      throw new Error(result.data?.message ?? 'The contact form was rejected');
    }
  }

  private async checkEmail(email: string): Promise<void> {
    const response = await fetch(EMAIL_CHECK_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams({ email }).toString(),
    });
    if (!response.ok) throw new Error(`Email check failed: ${response.status}`);
  }

  private async createSubmission(message: ContactFormMessage): Promise<URLSearchParams> {
    const [response, token] = await Promise.all([
      fetch(CONFIG_ENDPOINT, {
        credentials: 'same-origin',
        headers: { Accept: 'text/html' },
      }),
      this.getFreshToken(),
    ]);
    if (!response.ok) throw new Error(`Could not load contact form configuration: ${response.status}`);

    const document = new DOMParser().parseFromString(await response.text(), 'text/html');
    const form =
      document.querySelector<HTMLFormElement>(`#wpforms-form-${FORM_ID}`) ??
      document.querySelector<HTMLInputElement>(`input[name="wpforms[id]"][value="${FORM_ID}"]`)?.form;
    if (!form) throw new Error('Contact form configuration was not found');

    const body = new URLSearchParams();
    form.querySelectorAll<HTMLInputElement>('input[type="hidden"][name]').forEach((input) => {
      if (input.name && input.value) body.set(input.name, input.value);
    });

    const checkJsMatch = document.documentElement.innerHTML.match(
      /ct_checkjs_wpforms[\s\S]{0,800}?replace\([^)]*?['"](\d+)['"]\)/,
    );
    if (checkJsMatch?.[1]) body.set('ct_checkjs_wpforms', checkJsMatch[1]);

    const fullName = `${message.firstName.trim()} ${message.lastName.trim()}`.trim();
    body.set('wpforms[fields][1]', fullName);
    body.set('wpforms[fields][2]', message.company.trim());
    body.set('wpforms[fields][3]', message.email.trim());
    body.set('wpforms[fields][5]', message.subject.trim());
    body.set('wpforms[fields][4]', message.message.trim());
    body.set('wpforms[id]', FORM_ID);
    body.set('wpforms[post_id]', CONTACT_PAGE_ID);
    body.set('page_id', CONTACT_PAGE_ID);
    body.set('page_title', 'Contact');
    body.set('page_url', 'https://fardelins.com/contact/');
    body.set('url_referer', globalThis.document?.referrer || 'https://fardelins.com/');
    body.set('action', 'wpforms_submit');
    body.set('wpforms[submit]', 'wpforms-submit');
    body.set('wpforms[token]', token);
    body.set('start_timestamp', String(Math.floor(Date.now() / 1000)));
    body.set('end_timestamp', String(Math.floor(Date.now() / 1000)));
    body.set('apbct__email_id__wp_wpforms', '');
    body.set('apbct__email_id__elementor_form', '');

    return body;
  }

  private async getFreshToken(): Promise<string> {
    const response = await fetch(SUBMIT_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams({ action: 'wpforms_get_token', formId: FORM_ID }).toString(),
    });
    if (!response.ok) throw new Error(`Could not refresh the contact form token: ${response.status}`);

    const result = (await response.json()) as { success?: boolean; data?: { token?: string } };
    const token = result.data?.token;
    if (!result.success || !token) throw new Error('The contact form security token is unavailable');
    return token;
  }
}
