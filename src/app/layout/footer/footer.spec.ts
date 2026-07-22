import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Footer } from './footer';
import { ShaderBackground } from '../shader-background/shader-background';

@Component({
  selector: 'app-shader-background',
  standalone: true,
  template: '',
})
class ShaderBackgroundStub {
  readonly preset = input.required<unknown[]>();
  update(): void {}
}

describe('Footer', () => {
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [provideRouter([])],
    })
      .overrideComponent(Footer, {
        remove: { imports: [ShaderBackground] },
        add: { imports: [ShaderBackgroundStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();
  });

  afterEach(() => vi.restoreAllMocks());

  it('routes company links within the Angular application', () => {
    const element = fixture.nativeElement as HTMLElement;
    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('.footer__nav-link')).map(
      (link) => ({ label: link.textContent?.trim(), href: link.getAttribute('href') }),
    );

    expect(links).toEqual([
      { label: 'Features', href: '/features' },
      { label: 'Blogs', href: '/blogs' },
      { label: 'Download the App', href: '/download' },
      { label: 'Contact Us', href: '/contact' },
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
    ]);
  });

  it('uses safe external social links', () => {
    const element = fixture.nativeElement as HTMLElement;
    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('.footer__social-link'));
    expect(links).toHaveLength(4);
    links.forEach((link) => {
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
      expect(link.href).toMatch(/^https:\/\//);
    });
  });

  it('shows submitting and success states and resets the newsletter form', async () => {
    let resolveRequest!: (response: Response) => void;
    const request = new Promise<Response>((resolve) => (resolveRequest = resolve));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValue(request);
    const element = fixture.nativeElement as HTMLElement;
    const form = element.querySelector<HTMLFormElement>('.footer__subscribe')!;
    const input = form.querySelector<HTMLInputElement>('input')!;
    input.value = ' reader@example.com ';

    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(form.querySelector('button')?.textContent).toContain('Subscribing');
    expect(form.querySelector('button')?.disabled).toBe(true);

    resolveRequest({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: 'subscribed' }),
    } as unknown as Response);
    await request;
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1]?.body).toContain('reader%2540example.com');
    expect(element.querySelector('.footer__subscribe-status')?.textContent).toContain(
      'successfully subscribed',
    );
    expect(input.value).toBe('');
  });

  it('shows a recoverable error when the newsletter request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const element = fixture.nativeElement as HTMLElement;
    const form = element.querySelector<HTMLFormElement>('.footer__subscribe')!;
    form.querySelector<HTMLInputElement>('input')!.value = 'reader@example.com';

    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('.footer__subscribe-status')?.textContent).toContain(
      'Please try again',
    );
    expect(form.querySelector('button')?.disabled).toBe(false);
  });
});
