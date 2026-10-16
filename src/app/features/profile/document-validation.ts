import type { VerificationDocumentType } from './document-ocr.service';

export interface DocumentNumberRule {
  hint: string;
  maxLength: number;
  pattern: RegExp;
  invalidMessage: string;
}

const DOCUMENT_NUMBER_RULES: Record<VerificationDocumentType, DocumentNumberRule> = {
  NIN: {
    hint: '11 digits',
    maxLength: 11,
    pattern: /^\d{11}$/,
    invalidMessage: 'Enter the complete 11-digit NIN.',
  },
  Passport: {
    hint: '1 letter followed by 8 digits',
    maxLength: 9,
    pattern: /^[A-Z]\d{8}$/,
    invalidMessage: 'Enter a Nigerian passport number with 1 letter followed by 8 digits.',
  },
  "Driver's Licence": {
    hint: '12 letters or digits',
    maxLength: 12,
    pattern: /^[A-Z0-9]{12}$/,
    invalidMessage: 'Enter the 12-character driver’s licence number.',
  },
  "Voter's Card": {
    hint: '19 or 20 letters or digits',
    maxLength: 20,
    pattern: /^[A-Z0-9]{19,20}$/,
    invalidMessage: 'Enter the 19 or 20-character number on your voter’s card.',
  },
};

export function normalizeDocumentNumber(
  documentType: VerificationDocumentType,
  value: string,
): string {
  const normalized = value.toUpperCase().replace(/[\s-]+/g, '');
  return documentType === 'NIN' ? normalized.replace(/\D/g, '') : normalized;
}

export function maskDocumentNumber(value: string): string {
  const visible = value.length > 6 ? value.slice(-4) : '';
  return '•'.repeat(value.length - visible.length) + visible;
}

export function documentNumberRule(documentType: VerificationDocumentType): DocumentNumberRule {
  return DOCUMENT_NUMBER_RULES[documentType];
}

export function documentNumberError(
  documentType: VerificationDocumentType,
  value: string,
): string | null {
  const normalized = normalizeDocumentNumber(documentType, value);
  if (!normalized) return 'Enter the document number.';
  return DOCUMENT_NUMBER_RULES[documentType].pattern.test(normalized)
    ? null
    : DOCUMENT_NUMBER_RULES[documentType].invalidMessage;
}
