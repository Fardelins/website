import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AsYouType,
  CountryCode,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
} from 'libphonenumber-js';
import mobileExamples from 'libphonenumber-js/examples.mobile.json';

export interface CountryOption {
  iso2: CountryCode;
  name: string;
  callingCode: string;
}

const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

/** Every dialable country, once, every phone field in the app reads from this list. */
export const COUNTRIES: CountryOption[] = getCountries()
  .map((iso2) => ({
    iso2,
    name: REGION_NAMES.of(iso2) ?? iso2,
    callingCode: `+${getCountryCallingCode(iso2)}`,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * The flag + calling-code picker and formatted number field used across signup and
 * anywhere else that needs a phone number. `[(country)]`/`[(value)]` are two-way, 
 * `value` is the national number only, live-formatted as you type.
 */
@Component({
  selector: 'app-phone-input',
  templateUrl: './phone-input.html',
  styleUrl: './phone-input.css',
})
export class PhoneInput {
  readonly country = input<CountryCode>('NG');
  readonly countryChange = output<CountryCode>();
  readonly value = input('');
  readonly valueChange = output<string>();
  readonly name = input('phone');
  readonly required = input(true);

  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly countries = COUNTRIES;
  protected readonly selectedCountry = computed(
    () => this.countries.find((item) => item.iso2 === this.country()) ?? this.countries[0],
  );
  protected readonly menuOpen = signal(false);
  protected readonly query = signal('');
  protected readonly filteredCountries = computed(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) return this.countries;
    return this.countries.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.callingCode.includes(term) ||
        item.iso2.toLowerCase().includes(term),
    );
  });
  protected readonly placeholder = computed(() => {
    const example = getExampleNumber(this.country(), mobileExamples)?.formatNational();
    return `e.g. ${(example ?? '555 123 4567').replace(/^0[\s-]*/, '')}`;
  });

  protected flagUrl(iso2: CountryCode): string {
    return `https://flagcdn.com/${iso2.toLowerCase()}.svg`;
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
    this.query.set('');
  }

  protected selectCountry(iso2: CountryCode): void {
    this.countryChange.emit(iso2);
    this.valueChange.emit(this.formatPhone(this.value(), iso2));
    this.menuOpen.set(false);
    this.query.set('');
  }

  protected onPhoneInput(input: HTMLInputElement): void {
    const formatted = this.formatPhone(input.value, this.country());
    this.valueChange.emit(formatted);
    input.value = formatted;
  }

  @HostListener('document:pointerdown', ['$event'])
  protected closeOnOutsideClick(event: PointerEvent): void {
    if (!this.menuOpen()) return;
    const picker = this.host.nativeElement.querySelector('.phone__country');
    if (event.target instanceof Node && !picker?.contains(event.target)) {
      this.menuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    this.menuOpen.set(false);
  }

  private formatPhone(value: string, country: CountryCode): string {
    const nationalNumber = value.replace(/\D/g, '').replace(/^0+/, '');
    return nationalNumber ? new AsYouType(country).input(nationalNumber) : '';
  }
}
