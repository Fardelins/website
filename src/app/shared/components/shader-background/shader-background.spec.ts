import { TestBed } from '@angular/core/testing';
import { ShaderBackground } from './shader-background';

describe('ShaderBackground responsive canvas', () => {
  it('keeps percentage canvas dimensions and observes its host across tablet resizing', () => {
    const observe = vi.spyOn(ResizeObserver.prototype, 'observe');
    const fixture = TestBed.createComponent(ShaderBackground);
    fixture.componentRef.setInput('preset', []);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
    expect(observe).toHaveBeenCalledWith(fixture.nativeElement);
    fixture.destroy();
    observe.mockRestore();
  });
});
