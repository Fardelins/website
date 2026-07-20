import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactFormService } from '../../services/contact-form.service';
import { Contact } from './contact';

describe('Contact form', () => {
  let fixture: ComponentFixture<Contact>;
  let send: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    send = vi.fn();
    await TestBed.configureTestingModule({
      imports: [Contact],
      providers: [{ provide: ContactFormService, useValue: { send } }],
    }).compileComponents();
    fixture = TestBed.createComponent(Contact);
    fixture.detectChanges();
  });

  function fillForm(): HTMLFormElement {
    const form = (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>(
      '.contact-form',
    )!;
    const values: Record<string, string> = {
      firstName: 'Bami',
      lastName: 'Boss',
      company: 'Fardelins',
      email: 'bami@example.com',
      subject: 'Partnership',
      message: 'Hello team',
    };
    Object.entries(values).forEach(([name, value]) => {
      (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement).value = value;
    });
    return form;
  }

  it('disables duplicate submission and shows success after sending', async () => {
    let resolve!: () => void;
    send.mockReturnValue(new Promise<void>((done) => (resolve = done)));
    const form = fillForm();

    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(form.querySelector('button')?.disabled).toBe(true);
    expect(form.querySelector('button')?.textContent).toContain('Sending');

    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    expect(send).toHaveBeenCalledOnce();
    resolve();
    await new Promise((done) => setTimeout(done, 0));
    fixture.detectChanges();

    expect(send).toHaveBeenCalledWith({
      firstName: 'Bami',
      lastName: 'Boss',
      company: 'Fardelins',
      email: 'bami@example.com',
      subject: 'Partnership',
      message: 'Hello team',
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('message has been sent');
  });

  it('preserves entered values and allows retry after failure', async () => {
    send.mockRejectedValue(new Error('offline'));
    const form = fillForm();
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await new Promise((done) => setTimeout(done, 0));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain("couldn't send");
    expect((form.elements.namedItem('email') as HTMLInputElement).value).toBe('bami@example.com');
    expect(form.querySelector('button')?.disabled).toBe(false);
  });
});
