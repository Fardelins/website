import { describe, expect, it } from 'vitest';
import { documentNumberError, normalizeDocumentNumber } from './document-validation';

describe('document number validation', () => {
  it('requires an exact eleven-digit NIN', () => {
    expect(documentNumberError('NIN', '1')).toBe('Enter the complete 11-digit NIN.');
    expect(documentNumberError('NIN', '31579181253')).toBeNull();
  });

  it('validates Nigerian passport numbers', () => {
    expect(documentNumberError('Passport', 'A12647361')).toBeNull();
    expect(documentNumberError('Passport', '12647361')).not.toBeNull();
  });

  it('accepts official old and newer driver licence layouts', () => {
    expect(documentNumberError("Driver's Licence", 'CAL4914AB')).toBeNull();
    expect(documentNumberError("Driver's Licence", 'AKW06968AA2')).toBeNull();
    expect(documentNumberError("Driver's Licence", '1')).not.toBeNull();
  });

  it('accepts a full VIN or the last ten digits', () => {
    expect(documentNumberError("Voter's Card", '90F5B2C1D8E7A123456')).toBeNull();
    expect(documentNumberError("Voter's Card", '1234567890')).toBeNull();
    expect(documentNumberError("Voter's Card", '123')).not.toBeNull();
  });

  it('normalizes spaces, separators and casing', () => {
    expect(normalizeDocumentNumber('Passport', ' a-1264 7361 ')).toBe('A12647361');
  });
});
