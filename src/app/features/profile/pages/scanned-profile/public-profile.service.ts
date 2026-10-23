import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { injectLogisticsApiUrl } from '@core/services/logistics-api.config';
import { asBag, readString } from '@features/deliveries/deliveries.model';

export interface PublicProfile {
  username: string;
  name: string;
  avatarUrl: string | null;
}

/** The shape BE accepts for a username: letters and digits, 2 to 25 characters. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9]{2,25}$/;

/** Looks a person up by @handle with BE's public recipient search, which returns no phone or address. */
@Injectable({ providedIn: 'root' })
export class PublicProfileService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = injectLogisticsApiUrl();

  /** Null when nobody has that username; throws only when the lookup itself fails. */
  async lookup(username: string): Promise<PublicProfile | null> {
    if (!USERNAME_PATTERN.test(username)) return null;
    const body = await firstValueFrom(
      this.http
        .get(this.apiUrl('/shipment/recipients/search'), { params: { username } })
        .pipe(timeout(10_000)),
    );
    const record = asBag(asBag(body)['data']);
    const handle = readString(record, ['username']);
    if (!handle) return null;
    const name = [readString(record, ['first_name']), readString(record, ['last_name'])]
      .filter(Boolean)
      .join(' ');
    return { username: handle, name: name || handle, avatarUrl: readString(record, ['avatar']) };
  }
}
