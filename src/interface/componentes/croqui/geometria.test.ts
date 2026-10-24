import { describe, expect, it } from 'vitest';
import { coordenadaRelativa, enquadrar, MAX_ZOOM, MIN_ZOOM } from './geometria';
describe('coordenadas do croqui', () => {
  it('marca no mesmo lugar relativo com zoom e pan', () => {
    expect(coordenadaRelativa(350, 500, { left: 100, top: 200, width: 1000, height: 600 })).toEqual({ x_percent: .25, y_percent: .5 });
    expect(coordenadaRelativa(375, 350, { left: -125, top: -250, width: 2000, height: 1200 })).toEqual({ x_percent: .25, y_percent: .5 });
  });
  it('restringe arraste às bordas da página', () => expect(coordenadaRelativa(-50, 400, { left: 0, top: 0, width: 200, height: 200 })).toEqual({ x_percent: 0, y_percent: 1 }));
  it('enquadra a página toda com margem e centralização', () => expect(enquadrar({ width: 1000, height: 500 }, { width: 1048, height: 548 })).toEqual({ scale: 1, x: 24, y: 24 }));
  it('respeita limites em folhas e janelas extremas', () => {
    expect(enquadrar({ width: 1, height: 1 }, { width: 1000, height: 1000 }).scale).toBe(MAX_ZOOM);
    expect(enquadrar({ width: 100000, height: 100000 }, { width: 300, height: 500 }).scale).toBe(MIN_ZOOM);
  });
});
