import { TestBed } from '@angular/core/testing';
import { ContactFormService } from './contact-form.service';

const message = {
  firstName: 'Testboss',
  lastName: 'Product',
  company: 'Fardelins Test',
  email: 'product@example.com',
  subject: 'Partnership',
  message: 'Test by Bami',
};

const formHtml = `
  <form id="wpforms-form-285">
    <input type="hidden" name="wpforms[id]" value="285">
    <input type="hidden" name="ct_checkjs_wpforms" value="0">
  </form>
  <script>value.replace(value, '872415159')</script>`;

describe('ContactFormService', () => {
  let service: ContactFormService;

  beforeEach(() => {
    service = TestBed.inject(ContactFormService);
  });

  afterEach(() => vi.restoreAllMocks());

  it('checks the email, loads fresh form tokens, and submits the WPForms field mapping', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue(formHtml) } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: { token: 'fresh-token' } }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      } as unknown as Response);

    await service.send(message);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/wp-json/cleantalk-antispam/v1/check_email_before_post',
      '/contact-form-config',
      '/wp-admin/admin-ajax.php',
      '/wp-admin/admin-ajax.php',
    ]);
    expect(fetchMock.mock.calls[0][1]?.body).toBe('email=product%40example.com');

    expect(fetchMock.mock.calls[2][1]?.body).toBe('action=wpforms_get_token&formId=285');
    const payload = new URLSearchParams(String(fetchMock.mock.calls[3][1]?.body));
    expect(payload.get('wpforms[fields][1]')).toBe('Testboss Product');
    expect(payload.get('wpforms[fields][2]')).toBe('Fardelins Test');
    expect(payload.get('wpforms[fields][3]')).toBe('product@example.com');
    expect(payload.get('wpforms[fields][5]')).toBe('Partnership');
    expect(payload.get('wpforms[fields][4]')).toBe('Test by Bami');
    expect(payload.get('wpforms[token]')).toBe('fresh-token');
    expect(payload.get('ct_checkjs_wpforms')).toBe('872415159');
    expect(payload.get('action')).toBe('wpforms_submit');
  });

  it('does not submit when the anti-spam email check fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(service.send(message)).rejects.toThrow('Email check failed');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects a token refresh without a fresh security token', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue('<form id="wpforms-form-285"></form>'),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: false }),
      } as unknown as Response);
    await expect(service.send(message)).rejects.toThrow('security token');
  });
});
