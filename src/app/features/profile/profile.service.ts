import { HttpClient } from '@angular/common/http';
import { Injectable, inject, isDevMode } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { injectLogisticsApiUrl } from '@core/services/logistics-api.config';
import { parseApiError, parseUser } from '@core/auth/auth.models';
import { TokenStore } from '@core/auth/token-store';
import { DEV_USER } from '@core/auth/dev-mock';
import {
  asBag,
  formatDate,
  formatMoney,
  formatTime,
  hasNextPage,
  readList,
  readString,
} from '@features/deliveries/deliveries.model';
import { MOCK_TRANSACTIONS } from '@features/transactions/transactions.mock';

const TRANSACTION_PAGE_SIZE = 100;
const MAX_TRANSACTION_PAGES = 10;

function createdTime(record: Record<string, unknown>): number {
  return Date.parse(String(record['created_at'] ?? record['createdAt'] ?? '')) || 0;
}

export interface Transaction {
  id: string;
  reference: string;
  trackingId: string | null;
  description: string;
  amount: number;
  amountLabel: string;
  dateLabel: string;
  timeLabel: string;
  status: string;
  credit: boolean;
}

export interface VerificationDoc {
  id: string;
  type: string;
  status: string;
  uploadedLabel: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = injectLogisticsApiUrl();
  private readonly store = inject(TokenStore);
  private readonly mockDocuments: VerificationDoc[] = [];

  async update(patch: Record<string, unknown>): Promise<void> {
    if (this.isMockSession()) {
      const current = this.store.user();
      if (current) {
        this.store.setUser({
          ...current,
          firstName: String(patch['first_name'] ?? current.firstName),
          lastName: String(patch['last_name'] ?? current.lastName),
          phone: String(patch['phone'] ?? current.phone ?? ''),
        });
      }
      return;
    }

    try {
      const body = await firstValueFrom(this.http.patch(this.apiUrl('/user/me'), patch));
      const user = parseUser(asBag(body)['data'] ?? body, this.store.user()?.emailVerified ?? true);
      if (user) this.store.setUser(user);
    } catch (error) {
      throw new Error(parseApiError(error, "We couldn't save those changes."));
    }
  }

  async uploadAvatar(file: File): Promise<void> {
    if (this.isMockSession()) return;

    const form = new FormData();
    form.append('image', file, file.name);
    try {
      const body = await firstValueFrom(this.http.post(this.apiUrl('/upload/avatar'), form));
      const data = asBag(body)['data'] ?? body;
      const user = parseUser(data);
      if (user) {
        this.store.setUser(user);
      } else if (typeof data === 'string' && this.store.user()) {
        this.store.setUser({ ...this.store.user()!, avatarUrl: data });
      }
    } catch (error) {
      throw new Error(parseApiError(error, "We couldn't upload that photo."));
    }
  }

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (this.isMockSession()) return;

    try {
      await firstValueFrom(
        this.http.patch(this.apiUrl('/user/update-password'), {
          old_password: currentPassword,
          password: newPassword,
        }),
      );
    } catch (error) {
      throw new Error(parseApiError(error, "We couldn't change your password."));
    }
  }

  async transactions(): Promise<Transaction[]> {
    if (this.isMockSession()) return MOCK_TRANSACTIONS;

    return (await this.fetchTransactionRows()).map((item) => {
      const record = asBag(item);
      // BE rows are payments for shipments: { id, payment_method, amount, admin_fee, status, mode,
      // shipment_id, created_at, transaction }. `transaction` (the gateway record, with the
      // reference) is null until the payment has actually been attempted.
      const gateway = asBag(record['transaction']);
      const paysShipment = Boolean(readString(record, ['shipment_id', 'shipmentId']));
      const amount = Number(record['amount'] ?? record['value'] ?? 0);
      const type = readString(record, ['type', 'direction', 'entry']) ?? '';
      const timestamp = record['created_at'] ?? record['createdAt'] ?? record['date'];
      const id = readString(record, ['id', '_id']) ?? '';
      return {
        id,
        reference:
          readString(gateway, ['transaction_id', 'reference', 'ref', 'transaction_ref']) ??
          readString(record, ['reference', 'ref', 'transaction_ref']) ??
          id,
        // BE returns shipment_id, not the tracking code, so there is nothing to link to yet.
        trackingId: readString(record, [
          'tracking_id',
          'trackingId',
          'delivery_tracking_id',
          'parcel_tracking_id',
        ]),
        description:
          readString(record, ['description', 'narration', 'title', 'purpose']) ??
          (paysShipment ? 'Delivery Payment' : 'Transaction'),
        amount: Math.abs(amount),
        amountLabel:
          formatMoney(amount, readString(record, ['currency', 'currency_code']) ?? undefined) ??
          '—',
        dateLabel: formatDate(timestamp),
        timeLabel: formatTime(timestamp),
        status: readString(record, ['status', 'state']) ?? 'pending',
        // Paying for a shipment is money out even though BE stores the amount as positive.
        credit: !paysShipment && (/credit|\bin\b|deposit|refund/i.test(type) || amount > 0),
      };
    });
  }

  /** Follows BE's has_next_page so a long history isn't cut off, capped at 1,000 rows. */
  private async fetchTransactionRows(): Promise<unknown[]> {
    const rows: unknown[] = [];
    for (let page = 1; page <= MAX_TRANSACTION_PAGES; page++) {
      const body = await firstValueFrom(
        this.http.get(this.apiUrl('/user/transactions'), {
          params: { page: String(page), limit: String(TRANSACTION_PAGE_SIZE) },
        }),
      );
      rows.push(...readList(body));
      if (!hasNextPage(body)) break;
    }
    return rows;
  }

  async documents(): Promise<VerificationDoc[]> {
    if (this.isMockSession()) return [...this.mockDocuments];

    try {
      // Not /verification-document/customer-documents: that one serves the accepted-ID-types
      // catalog (name/country/url, no id or status), not the signed-in user's own submissions.
      const body = await firstValueFrom(this.http.get(this.apiUrl('/verification-document')));
      return readList(body)
        .map((item) => asBag(item))
        .filter((record) => readString(record, ['id', '_id', 'status', 'state']))
        .sort((a, b) => createdTime(b) - createdTime(a))
        .map((record) => ({
          id: readString(record, ['id', '_id']) ?? '',
          // `type` is BE's own bucket ("domestic"), `name` is the ID type the customer picked.
          type: readString(record, ['name', 'document_type', 'type']) ?? 'Document',
          status: readString(record, ['status', 'state']) ?? 'pending',
          uploadedLabel: formatDate(record['created_at'] ?? record['createdAt']),
        }));
    } catch {
      return [];
    }
  }

  async uploadDocument(file: File, type: string, uniqueIdentifier: string): Promise<void> {
    if (this.isMockSession()) {
      this.mockDocuments.unshift({
        id: `mock-document-${Date.now()}`,
        type,
        status: 'pending',
        uploadedLabel: new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date()),
      });
      return;
    }

    const form = new FormData();
    form.append('name', type);
    form.append('unique_identifier', uniqueIdentifier);
    form.append('document', file, file.name);
    try {
      // BE only accepts `user` or `courier` here (Swagger lists no values); `customer` is a 400.
      await firstValueFrom(this.http.post(this.apiUrl('/verification-document/upload/user'), form));
    } catch (error) {
      throw new Error(parseApiError(error, "We couldn't upload that document."));
    }
  }

  private isMockSession(): boolean {
    return isDevMode() && this.store.user()?.id === DEV_USER.id;
  }
}
