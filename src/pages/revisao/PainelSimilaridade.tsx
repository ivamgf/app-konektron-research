import { useState } from 'react';
import { faixaNota, LIMIAR_SUGESTAO, textoDoPerfil, type Similaridade, type TrechoPerfil } from './similaridade';

const chavePerfil = (projetoId: string) => `konektron:perfil-similaridade:${projetoId}`;

/** Perfil ajustado pelo usuário (fica neste navegador); null = o calculado do protocolo */
export function lerPerfilAjustado(projetoId: string): string | null {
  try {
    return localStorage.getItem(chavePerfil(projetoId));
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

export const formatarNota = (n: number) => n.toFixed(2).replace('.', ',');

/** Nota de similaridade no item da lista: verde só a partir de 0,70 (sugestão de seleção) */
export function NotaSimilaridade({ s }: { s: Similaridade }) {
  const alta = faixaNota(s.nota) === 'alta';
  const classe = alta ? 'text-bg-success' : 'bg-body-secondary text-body-secondary border';
  return (
    <span
      className={`badge ${classe}`}
      title={
        alta
          ? 'Similaridade com o tema ≥ 0,70: sugerido para seleção'
          : 'Similaridade com o tema abaixo de 0,70: sem sugestão'
      }
    >
      <i className="bi bi-bullseye me-1" aria-hidden="true" />
      <span className="visually-hidden">Similaridade </span>
      {formatarNota(s.nota)}
    </span>
  );
}

/** Ferramenta de comparação com o protocolo (fases 1 e 2): resumo usado, limiar e ações */
export function PainelSimilaridade({
  projetoId,
  etapaId,
  perfilAuto,
  perfilAjustado,
  aoAjustarPerfil,
  total,
  acima,
  ordenar,
  aoOrdenar,
  soSimilares,
  aoSoSimilares,
  aoMarcar,
}: {
  projetoId: string;
  etapaId: string;
  perfilAuto: TrechoPerfil[];
  perfilAjustado: string | null;
  aoAjustarPerfil: (v: string | null) => void;
  total: number;
  acima: number;
  ordenar: boolean;
  aoOrdenar: (v: boolean) => void;
  soSimilares: boolean;
  aoSoSimilares: (v: boolean) => void;
  aoMarcar?: () => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const semPerfil = !perfilAuto.length && !perfilAjustado?.trim();
  if (semPerfil)
    return (
      <div className="border rounded p-2 mb-2 small bg-body text-secondary">
        <i className="bi bi-bullseye me-1" aria-hidden="true" />
        Preencha o tema, a questão, os objetivos, as palavras-chave ou o resumo do protocolo para comparar os documentos
        com o tema da pesquisa.
      </div>
    );
  return (
    <div className="border rounded p-2 mb-2 small bg-body" aria-label="Similaridade com o tema">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <i className="bi bi-bullseye text-success" aria-hidden="true" />
        <span className="me-auto" role="status">
          <strong>{acima}</strong> de {total} com similaridade ≥ {formatarNota(LIMIAR_SUGESTAO)} com o tema (sugeridos
          para seleção)
        </span>
        {aoMarcar && acima > 0 && (
          <button type="button" className="btn btn-outline-success btn-sm py-0" onClick={aoMarcar}>
            Marcar similares pendentes
          </button>
        )}
      </div>
      <div className="d-flex flex-wrap align-items-center gap-3 mt-1">
        <div className="form-check mb-0">
          <input
            id={`ordenar-sim-${etapaId}`}
            type="checkbox"
            className="form-check-input"
            checked={ordenar}
            onChange={(e) => aoOrdenar(e.target.checked)}
          />
          <label className="form-check-label" htmlFor={`ordenar-sim-${etapaId}`}>
            Ordenar por similaridade
          </label>
        </div>
        <div className="form-check mb-0">
          <input
            id={`so-similares-${etapaId}`}
            type="checkbox"
            className="form-check-input"
            checked={soSimilares}
            onChange={(e) => aoSoSimilares(e.target.checked)}
          />
          <label className="form-check-label" htmlFor={`so-similares-${etapaId}`}>
            Só os com nota ≥ {formatarNota(LIMIAR_SUGESTAO)}
          </label>
        </div>
      </div>
      <p className="text-secondary mt-1 mb-0">
        <i className="bi bi-info-circle me-1" aria-hidden="true" />
        Só são sugeridos os documentos com nota ≥ {formatarNota(LIMIAR_SUGESTAO)}. A sugestão não decide nada: você pode
        selecionar ou excluir qualquer documento pelo seu julgamento, inclusive os de nota menor.
      </p>
      <details className="mt-1">
        <summary>Resumo do protocolo usado na comparação{perfilAjustado !== null ? ' (ajustado)' : ''}</summary>
        <p className="text-secondary mt-1 mb-1">
          Cada documento (título, resumo e palavras-chave) é comparado com este resumo pela similaridade do cosseno
          entre vetores TF-IDF, calculada aqui no navegador, sem custo. A nota vai de 0 a 1; a partir de 0,70 fica em
          verde e o documento é sugerido. É só uma sugestão: a decisão é do revisor.
        </p>
        {editando !== null ? (
          <>
            <label className="visually-hidden" htmlFor={`perfil-${etapaId}`}>
              Resumo do protocolo para a comparação
            </label>
            <textarea
              id={`perfil-${etapaId}`}
              className="form-control form-control-sm"
              rows={8}
              value={editando}
              onChange={(e) => setEditando(e.target.value)}
            />
            <div className="d-flex gap-2 mt-1">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  aoAjustarPerfil(editando);
                  gravar(chavePerfil(projetoId), editando);
                  setEditando(null);
                }}
              >
                Usar este resumo
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setEditando(null)}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className="border rounded p-2 bg-body-tertiary k-leitura"
              style={{ whiteSpace: 'pre-line', maxHeight: 220, overflow: 'auto' }}
            >
              {perfilAjustado ?? textoDoPerfil(perfilAuto)}
            </div>
            <div className="d-flex gap-2 mt-1">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm py-0"
                onClick={() => setEditando(perfilAjustado ?? textoDoPerfil(perfilAuto))}
              >
                <i className="bi bi-pencil me-1" aria-hidden="true" />
                Ajustar
              </button>
              {perfilAjustado !== null && (
                <button
                  type="button"
                  className="btn btn-link btn-sm py-0"
                  onClick={() => {
                    aoAjustarPerfil(null);
                    gravar(chavePerfil(projetoId), null);
                  }}
                >
                  Voltar ao resumo do protocolo
                </button>
              )}
            </div>
          </>
        )}
      </details>
    </div>
  );
}
