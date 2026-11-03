/** Who is named as the seller on a receipt. Fill in what the company has; empty fields stay off the receipt. */
export interface ReceiptIssuer {
  name: string;
  website: string;
  email: string;
  /** One line per entry, for example ["12 Example Street", "Ikeja, Lagos", "Nigeria"]. */
  address: string[];
  /** Company registration, VAT or tax number, shown as `${taxIdLabel} ${taxId}`. */
  taxId: string;
  taxIdLabel: string;
  /** Shown as a tax-included line only when set; never guessed. */
  vatRatePercent: number | null;
}

export const RECEIPT_ISSUER: ReceiptIssuer = {
  name: 'Fardelins',
  website: 'www.fardelins.com',
  email: 'hello@fardelins.com',
  address: [],
  taxId: '',
  taxIdLabel: 'Tax ID',
  vatRatePercent: null,
};
