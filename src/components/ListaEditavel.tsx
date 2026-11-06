import type { ReactNode } from 'react';

/** Lista editável com adicionar, remover e reordenar (setas, acessível pelo teclado) */
export function ListaEditavel<T>({
  itens,
  aoMudar,
  novo,
  render,
  rotuloItem,
  somenteLeitura,
  textoAdicionar = 'Adicionar',
  max = 100,
}: {
  itens: T[];
  aoMudar: (itens: T[]) => void;
  novo: () => T;
  render: (item: T, alterar: (parcial: Partial<T>) => void, indice: number) => ReactNode;
  rotuloItem: (indice: number) => string;
  somenteLeitura?: boolean;
  textoAdicionar?: string;
  max?: number;
}) {
  const mover = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= itens.length) return;
    const copia = [...itens];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    aoMudar(copia);
  };
  return (
    <div>
      <ol className="list-unstyled mb-2">
        {itens.map((item, i) => (
          <li key={i} className="d-flex gap-2 align-items-start mb-2">
            <span className="badge text-bg-light border mt-2" aria-hidden="true">
              {i + 1}
            </span>
            <div className="flex-grow-1" role="group" aria-label={rotuloItem(i)}>
              {render(item, (parcial) => aoMudar(itens.map((x, k) => (k === i ? { ...x, ...parcial } : x))), i)}
            </div>
            {!somenteLeitura && (
              <div className="btn-group btn-group-sm mt-1">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  aria-label={`Subir ${rotuloItem(i)}`}
                  disabled={i === 0}
                  onClick={() => mover(i, -1)}
                >
                  <i className="bi bi-arrow-up" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  aria-label={`Descer ${rotuloItem(i)}`}
                  disabled={i === itens.length - 1}
                  onClick={() => mover(i, 1)}
                >
                  <i className="bi bi-arrow-down" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  aria-label={`Remover ${rotuloItem(i)}`}
                  onClick={() => aoMudar(itens.filter((_, k) => k !== i))}
                >
                  <i className="bi bi-trash" aria-hidden="true" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {itens.length === 0 && <div className="small text-secondary mb-2">Nenhum item.</div>}
      {!somenteLeitura && itens.length < max && (
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => aoMudar([...itens, novo()])}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          {textoAdicionar}
        </button>
      )}
    </div>
  );
}
