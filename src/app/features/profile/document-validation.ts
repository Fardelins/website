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
    hint: 'For example, CAL4914AB or AKW06968AA2',
    maxLength: 11,
    pattern: /^(?:[A-Z]{3}\d{4}[A-Z]{2}|[A-Z]{3}\d{5}[A-Z]{2}\d)$/,
    invalidMessage: 'Enter a valid Nigerian driver’s licence number.',
  },
  "Voter's Card": {
    hint: 'Full 19-character VIN or its last 10 digits',
    maxLength: 19,
    pattern: /^(?:[A-Z0-9]{19}|\d{10})$/,
    invalidMessage: 'Enter the full 19-character VIN or its last 10 digits.',
  },
};

export function normalizeDocumentNumber(
  documentType: VerificationDocumentType,
  value: string,
): string {
  const normalized = value.toUpperCase().replace(/[\s-]+/g, '');
  return documentType === 'NIN' ? normalized.replace(/\D/g, '') : normalized;
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
