import { Injectable } from '@angular/core';
import { saveFile } from '@shared/utils/save-file';
import { CardImageInput, renderProfileCardImage } from './render-card-image';

/** Draws the profile card picture and hands it to the browser; a seam so tests need no canvas. */
@Injectable({ providedIn: 'root' })
export class CardImageService {
  render(input: CardImageInput): Promise<Blob> {
    return renderProfileCardImage(input);
  }

  save(blob: Blob, filename: string): void {
    saveFile(blob, filename);
  }
}
