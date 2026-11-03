import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HapticsService } from '@core/services/haptics.service';
import { ToastService } from '@core/services/toast.service';
import { Transaction } from '@features/profile/profile.service';
import { ReceiptDialog } from './receipt-dialog';

const payment = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: '1',
  reference: 'T605068487173815',
  trackingId: 'FDL-3476635659977',
  method: 'paystack',
  description: 'Delivery Payment · Phone case',
  amount: 7800,
  amountLabel: '₦7,800',
  dateLabel: 'Oct 9, 2026',
  timeLabel: '8:34 PM',
  status: 'paid',
  credit: false,
  ...overrides,
});

describe('ReceiptDialog', () => {
  let fixture: ComponentFixture<ReceiptDialog>;
  let root: HTMLElement;

  async function render(transaction: Transaction) {
    fixture = TestBed.createComponent(ReceiptDialog);
    fixture.componentRef.setInput('transaction', transaction);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ReceiptDialog],
      providers: [
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: HapticsService, useValue: { light: vi.fn(), success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('shows a paid receipt with the reference, type, item and tracking number', async () => {
    await render(payment());
    const text = root.textContent ?? '';
    expect(text).toContain('Amount Paid');
    expect(text).toContain('₦7,800');
    expect(text).toContain('T605068487173815');
    expect(text).toContain('Delivery Payment');
    expect(text).toContain('Phone case');
    expect(text).toContain('FDL-3476635659977');
    expect(root.textContent).toContain('Download Receipt');
  });

  it('names who issued it and who it is billed to, and what was bought', async () => {
    fixture = TestBed.createComponent(ReceiptDialog);
    fixture.componentRef.setInput('transaction', payment());
    fixture.componentRef.setInput('customer', {
      id: 'u1',
      firstName: 'Ada',
      lastName: 'Obi',
      email: 'ada@example.com',
      phone: '+2348012345678',
      emailVerified: true,
    });
    fixture.componentRef.setInput('detail', {
      title: 'Phone case',
      quantity: 2,
      pickupAddress: 'Wuse, Abuja',
      dropOffAddress: 'Ikeja, Lagos',
      courierName: 'BlueArrow Logistics',
    });
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();

    const text = root.textContent ?? '';
    expect(text).toContain('Issued by');
    expect(text).toContain('hello@fardelins.com');
    expect(text).toContain('Billed to');
    expect(text).toContain('Ada Obi');
    expect(text).toContain('ada@example.com');
    expect(text).toContain('Wuse, Abuja to Ikeja, Lagos');
    expect(text).toContain('Carried by BlueArrow Logistics');
    expect(root.querySelector('.receipt__items-row')?.textContent).toContain('2');
    expect(text).toContain('Payment method');
    expect(text).toContain('Paystack');
    expect(text).not.toContain('VAT');
  });

  it('does not say Paid for a payment that has not cleared', async () => {
    await render(payment({ status: 'pending' }));
    expect(root.textContent).toContain('Amount Due');
    expect(root.textContent).not.toContain('Amount Paid');
  });

  it('asks its owner to close it from the close button and from the backdrop', async () => {
    await render(payment());
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    root.querySelector<HTMLButtonElement>('.receipt-close')!.click();
    root.querySelector<HTMLElement>('.receipt-backdrop')!.click();
    expect(closed).toHaveBeenCalledTimes(2);
  });
});
