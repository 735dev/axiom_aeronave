import { describe, expect, it } from 'vitest';
import { pageWindow } from './PaginatedComplete';

describe('pageWindow', () => {
  it('muestra todas las páginas si son pocas', () => {
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });

  it('abrevia con huecos lejos de los extremos', () => {
    expect(pageWindow(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
  });

  it('no deja hueco cuando la actual está pegada al borde', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 'gap', 20]);
    expect(pageWindow(20, 20)).toEqual([1, 'gap', 19, 20]);
  });
});
