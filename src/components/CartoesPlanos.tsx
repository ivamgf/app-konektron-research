import type { ReactNode } from 'react';
import type { Ciclo } from '../lib/assinatura';
import { EMAIL_ORKNEYTECH } from '../lib/contato';
import { NOME_RECURSO, PLANOS, preco, type Plano } from '../lib/planos';

type InfoPlano = (typeof PLANOS)[number];

/** Botões Mensal / Anual dos preços */
export function SeletorCiclo({ ciclo, aoMudar }: { ciclo: Ciclo; aoMudar: (c: Ciclo) => void }) {
  return (
    <div className="btn-group" role="group" aria-label="Ciclo de pagamento">
      {(['MENSAL', 'ANUAL'] as const).map((c) => (
        <button
          key={c}
          type="button"
          className={`btn ${ciclo === c ? 'btn-primary' : 'btn-outline-primary'}`}
          aria-pressed={ciclo === c}
          onClick={() => aoMudar(c)}
        >
          {c === 'MENSAL' ? 'Mensal' : 'Anual (2 meses grátis)'}
        </button>
      ))}
    </div>
  );
}

/**
 * Cartões dos planos Free, Standard, Master e Institucional (página inicial e página de planos).
 * `acao` monta o botão de cada plano: cadastro para visitantes, assinatura para quem está logado.
 */
export function CartoesPlanos({
  ciclo,
  acao,
  valorDe = (_id, base) => base,
  planoAtual,
  nivelTitulo = 2,
}: {
  ciclo: Ciclo;
  acao: (p: InfoPlano) => ReactNode;
  /** preço com desconto da conta (estudante), quando houver */
  valorDe?: (id: Plano, base: number | null) => number | null;
  planoAtual?: Plano;
  nivelTitulo?: 2 | 3;
}) {
  const Titulo = `h${nivelTitulo}` as const;
  return (
    <ul className="row g-4 list-unstyled mb-4">
      {PLANOS.map((p) => {
        const cheio = ciclo === 'MENSAL' ? p.mensal : p.anual;
        const valor = valorDe(p.id, cheio);
        return (
          <li className="col-md-6 col-xl-3" key={p.id}>
            <div className={`card h-100 shadow-sm ${p.destaque ? 'border-primary border-2' : ''}`}>
              <div className="card-body d-flex flex-column p-4">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <Titulo className="h4 mb-0">{p.nome}</Titulo>
                  {p.destaque && <span className="badge text-bg-primary">Completo</span>}
                  {planoAtual === p.id && <span className="badge text-bg-success ms-auto">Seu plano</span>}
                </div>
                <p className="text-secondary small">{p.resumo}</p>
                <div className="mb-3">
                  {valor === null ? (
                    <span className="fs-2 fw-bold">Grátis</span>
                  ) : (
                    <>
                      {cheio !== null && valor < cheio && (
                        <div className="small text-secondary text-decoration-line-through">{preco(cheio)}</div>
                      )}
                      <span className="fs-2 fw-bold">{preco(valor)}</span>
                      <span className="text-secondary">/{ciclo === 'MENSAL' ? 'mês' : 'ano'}</span>
                      {ciclo === 'ANUAL' && (
                        <div className="small text-secondary">equivale a {preco(valor / 12)}/mês</div>
                      )}
                    </>
                  )}
                </div>
                <ul className="list-unstyled small mb-3">
                  {p.inclui.map((t) => (
                    <li key={t} className="d-flex gap-2 mb-1">
                      <i className="bi bi-check-lg text-success" aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                  {p.naoInclui.map((r) => (
                    <li key={r} className="d-flex gap-2 mb-1 text-secondary">
                      <i className="bi bi-x-lg" aria-hidden="true" />
                      <span>
                        <span className="visually-hidden">Não inclui: </span>
                        {NOME_RECURSO[r]}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">{acao(p)}</div>
              </div>
            </div>
          </li>
        );
      })}
      <li className="col-md-6 col-xl-3">
        <div className="card h-100 shadow-sm bg-body-tertiary">
          <div className="card-body d-flex flex-column p-4">
            <Titulo className="h4 mb-1">Institucional</Titulo>
            <p className="text-secondary small">Para laboratórios, grupos de pesquisa e programas de pós.</p>
            <div className="mb-3">
              <span className="fs-4 fw-bold">Sob consulta</span>
            </div>
            <ul className="list-unstyled small mb-3">
              {[
                'Várias contas Master num só contrato',
                'Cobrança anual por instituição, com nota fiscal',
                'Implantação e treinamento da equipe',
              ].map((t) => (
                <li key={t} className="d-flex gap-2 mb-1">
                  <i className="bi bi-check-lg text-success" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
            <a
              className="btn btn-outline-primary w-100 mt-auto"
              href={`mailto:${EMAIL_ORKNEYTECH}?subject=${encodeURIComponent('Plano Institucional do Konektron Research')}`}
            >
              Falar com a equipe
            </a>
          </div>
        </div>
      </li>
    </ul>
  );
}
