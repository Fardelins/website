import { Injectable } from '@angular/core';
import type { OcrResultItem, PaddleOCR } from '@paddleocr/paddleocr-js';

export type VerificationDocumentType = 'NIN' | 'Passport' | "Driver's Licence" | "Voter's Card";

export interface DocumentScanResult {
  detectedType: VerificationDocumentType | null;
  identifier: string | null;
}

type OcrEngine = Awaited<ReturnType<typeof PaddleOCR.create>>;

const MODEL_BASE_URL = 'https://huggingface.co/LunarOilRig/paddleocr-onnx/resolve/main/';

@Injectable({ providedIn: 'root' })
export class DocumentOcrService {
  private engine: Promise<OcrEngine> | null = null;

  async warmUp(): Promise<void> {
    await this.getEngine();
  }

  async scanDocument(
    file: File,
    selectedType: VerificationDocumentType,
  ): Promise<DocumentScanResult> {
    const source =
      file.type === 'application/pdf'
        ? await this.renderFirstPdfPage(file)
        : await this.prepareImage(file);
    const engine = await this.getEngine();
    const [result] = await engine.predict(source, {
      textDetLimitSideLen: 1280,
      textDetLimitType: 'max',
      textDetMaxSideLimit: 1600,
      textRecScoreThresh: 0.35,
    });
    const items = result?.items ?? [];
    const detectedType = detectDocumentType(items);
    return {
      detectedType,
      identifier: findDocumentIdentifier(items, detectedType ?? selectedType),
    };
  }

  private getEngine(): Promise<OcrEngine> {
    if (!this.engine) {
      this.engine = this.createEngine().catch((error) => {
        this.engine = null;
        throw error;
      });
    }
    return this.engine;
  }

  private async createEngine(): Promise<OcrEngine> {
    const { PaddleOCR } = await import('@paddleocr/paddleocr-js');
    const wasmPaths = new URL('ort/', document.baseURI).href;
    const workerUrl = new URL('paddleocr/worker-entry-C9UNuyOJ.js', document.baseURI);
    return PaddleOCR.create({
      textDetectionModelName: 'PP-OCRv6_tiny_det',
      textRecognitionModelName: 'PP-OCRv6_tiny_rec',
      textDetectionModelAsset: {
        url: `${MODEL_BASE_URL}PP-OCRv6_tiny_det_onnx_infer.tar`,
      },
      textRecognitionModelAsset: {
        url: `${MODEL_BASE_URL}PP-OCRv6_tiny_rec_onnx_infer.tar`,
      },
      worker: {
        createWorker: () => new Worker(workerUrl, { type: 'module' }),
      },
      ortOptions: { backend: 'wasm', wasmPaths, numThreads: 1, simd: true },
    });
  }

  private async renderFirstPdfPage(file: File): Promise<HTMLCanvasElement> {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs/pdf.worker.min.mjs',
      document.baseURI,
    ).href;
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await loadingTask.promise;
    try {
      const page = await pdf.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2.4, 1800 / Math.max(baseViewport.width, baseViewport.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      page.cleanup();
      return canvas;
    } finally {
      await loadingTask.destroy();
    }
  }

  private async prepareImage(file: File): Promise<File | HTMLCanvasElement> {
    if (typeof createImageBitmap !== 'function') return file;
    try {
      const bitmap = await createImageBitmap(file);
      const longestSide = Math.max(bitmap.width, bitmap.height);
      const scale = Math.min(3, Math.max(1, 1280 / longestSide));
      if (scale === 1) {
        bitmap.close();
        return file;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext('2d');
      if (!context) {
        bitmap.close();
        return file;
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.filter = 'grayscale(1) contrast(1.2)';
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      return canvas;
    } catch (error) {
      console.warn('[Document OCR] Image preparation failed, using the original file.', error);
      return file;
    }
  }
}

export function findDocumentIdentifier(
  items: ReadonlyArray<Pick<OcrResultItem, 'text' | 'poly'>>,
  documentType: string,
): string | null {
  const lines = [...items]
    .sort((a, b) => (a.poly[0]?.[1] ?? 0) - (b.poly[0]?.[1] ?? 0))
    .map((item) => item.text.trim())
    .filter(Boolean);
  const text = lines.join('\n').toUpperCase();

  if (documentType === 'NIN') {
    return findNigerianIdentityNumber(lines);
  }
  if (documentType === 'Passport') {
    return findPassportNumber(lines, text);
  }
  if (documentType === "Driver's Licence") {
    return findLabelledValue(text, /(?:DRIVER'?S?\s+LICEN[CS]E|LICEN[CS]E|DL)\s*(?:NO|NUMBER|#)?/);
  }
  if (documentType === "Voter's Card") {
    return findLabelledValue(text, /(?:VIN|VOTER(?:'?S)?\s+(?:ID|NUMBER|IDENTIFICATION NUMBER))/);
  }
  return null;
}

export function detectDocumentType(
  items: ReadonlyArray<Pick<OcrResultItem, 'text' | 'poly'>>,
): VerificationDocumentType | null {
  const text = items
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join('\n')
    .toUpperCase();

  if (/\b(?:NIMC|NATIONAL IDENTITY MANAGEMENT|NATIONAL IDENTIFICATION NUMBER|NIN)\b/.test(text)) {
    return 'NIN';
  }
  if (/\b(?:INEC|PERMANENT VOTER|VOTER IDENTIFICATION|VOTER'?S? CARD|VIN)\b/.test(text)) {
    return "Voter's Card";
  }
  if (/\b(?:FRSC|FEDERAL ROAD SAFETY|DRIVER'?S? LICEN[CS]E|L\/NO)\b/.test(text)) {
    return "Driver's Licence";
  }
  if (/\bPASSPORT\b|P<NGA/.test(text)) return 'Passport';
  return null;
}

function findNigerianIdentityNumber(lines: string[]): string | null {
  return findDigitsByLength(lines, 11);
}

function findDigitsByLength(lines: string[], length: number): string | null {
  for (const line of lines) {
    const candidate = findDigitRun(line, length, length);
    if (candidate) return candidate;
  }
  return null;
}

function findDigitRun(text: string, minimumLength: number, maximumLength: number): string | null {
  const candidates = text.match(/\d(?:[ \t-]*\d){7,17}/g) ?? [];
  return (
    candidates
      .map((candidate) => candidate.replace(/\D/g, ''))
      .find(
        (candidate) => candidate.length >= minimumLength && candidate.length <= maximumLength,
      ) ?? null
  );
}

function findPassportNumber(lines: string[], text: string): string | null {
  for (const line of lines) {
    const mrz = line.toUpperCase().replace(/[^A-Z0-9<]/g, '');
    if (mrz.length >= 40 && /^[A-Z0-9<]{9}[0-9<]/.test(mrz)) {
      const number = mrz.slice(0, 9).replace(/</g, '');
      if (number.length >= 6) return number;
    }
  }
  return findLabelledValue(text, /(?:PASSPORT|DOCUMENT)\s*(?:NO|NUMBER|#)?/);
}

function findLabelledValue(text: string, label: RegExp): string | null {
  const match = text.match(new RegExp(`${label.source}\\s*[:.-]?\\s*([A-Z0-9][A-Z0-9 -]{5,24})`));
  if (!match?.[1]) return null;
  const candidate = match[1].split('\n')[0].replace(/[\s-]+/g, '');
  return candidate.length >= 6 ? candidate : null;
}
