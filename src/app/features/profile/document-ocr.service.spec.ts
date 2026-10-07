import { describe, expect, it } from 'vitest';
import { detectDocumentType, findDocumentIdentifier } from './document-ocr.service';

const item = (text: string, y = 0) => ({
  text,
  poly: [
    [0, y],
    [1, y],
    [1, y + 1],
    [0, y + 1],
  ] as [number, number][],
});

describe('findDocumentIdentifier', () => {
  it('extracts an eleven digit NIN with OCR spacing', () => {
    expect(findDocumentIdentifier([item('NIN 1234 567 8901')], 'NIN')).toBe('12345678901');
  });

  it('does not mistake legacy card and document numbers for an eleven digit NIN', () => {
    expect(
      findDocumentIdentifier(
        [item('5394 2678 4245 0618'), item('DOCUMENT-NUMBER', 1), item('4812640614', 2)],
        'NIN',
      ),
    ).toBeNull();
  });

  it('extracts a passport number from an MRZ line', () => {
    expect(
      findDocumentIdentifier(
        [
          item('P<NGADOE<<JANE<<<<<<<<<<<<<<<<<<<<'),
          item('A12345678<4NGA9001011F3001012<<<<<<<<<<<<<<02', 1),
        ],
        'Passport',
      ),
    ).toBe('A12345678');
  });

  it('extracts labelled licence and voter identifiers', () => {
    expect(findDocumentIdentifier([item('Licence No: ABJ-123456-AA')], "Driver's Licence")).toBe(
      'ABJ123456AA',
    );
    expect(findDocumentIdentifier([item('VIN: 90F5B2C1D8E7A123456')], "Voter's Card")).toBe(
      '90F5B2C1D8E7A123456',
    );
  });

  it('returns null when it cannot identify a supported number', () => {
    expect(findDocumentIdentifier([item('Federal Republic of Nigeria')], 'NIN')).toBeNull();
  });

  it('detects each supported document from its issuing marks', () => {
    expect(detectDocumentType([item('National Identity Management System'), item('NIN')])).toBe(
      'NIN',
    );
    expect(detectDocumentType([item('Federal Republic of Nigeria'), item('PASSPORT')])).toBe(
      'Passport',
    );
    expect(detectDocumentType([item('Federal Road Safety Corps'), item("Driver's Licence")])).toBe(
      "Driver's Licence",
    );
    expect(detectDocumentType([item('INEC Permanent Voter Card'), item('VIN')])).toBe(
      "Voter's Card",
    );
  });
});
