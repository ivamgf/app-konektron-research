import { beforeEach, describe, expect, it } from 'vitest';
import * as fila from '../pages/analise/filaOffline';

describe('fila offline das respostas (UC12 4a)', () => {
  beforeEach(() => localStorage.clear());

  it('junta pendências e mantém a resposta mais nova de cada questão', () => {
    fila.guardar('a:d', {
      url: '/x',
      em: '1',
      corpo: {
        respostas: [
          { questaoAnaliseId: 'q1', texto: 'v1' },
          { questaoAnaliseId: 'q2', texto: 'b' },
        ],
      },
    });
    fila.guardar('a:d', {
      url: '/x',
      em: '2',
      corpo: { respostas: [{ questaoAnaliseId: 'q1', texto: 'v2' }], observacoes: 'obs' },
    });
    const p = fila.ler('a:d')!;
    expect(p.em).toBe('2');
    expect(p.corpo.observacoes).toBe('obs');
    expect(p.corpo.respostas).toEqual([
      { questaoAnaliseId: 'q1', texto: 'v2' },
      { questaoAnaliseId: 'q2', texto: 'b' },
    ]);
    expect(fila.todos().map(([k]) => k)).toEqual(['a:d']);
    fila.remover('a:d');
    expect(fila.ler('a:d')).toBeNull();
  });
});
