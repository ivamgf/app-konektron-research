import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { NOME_RECURSO, temRecurso, type Recurso } from '../lib/planos';
import { useProjetoAtual } from '../pages/projeto/ProjetoLayout';

/** Aviso de recurso fora do plano do projeto, com o caminho do upgrade */
export function RecursoBloqueado({ recurso, compacto = false }: { recurso: Recurso; compacto?: boolean }) {
  if (compacto)
    return (
      <div className="border rounded p-2 mb-2 small bg-body-tertiary text-secondary" role="note">
        <i className="bi bi-lock-fill me-1" aria-hidden="true" />
        {NOME_RECURSO[recurso]}: disponível no plano <strong>Master</strong>. <Link to="/planos">Fazer upgrade</Link>
      </div>
    );
  return (
    <div className="card border-0 bg-body-tertiary text-center p-4 p-md-5" role="note">
      <i className="bi bi-lock-fill fs-1 text-secondary mb-2" aria-hidden="true" />
      <h2 className="h5">{NOME_RECURSO[recurso]}</h2>
      <p className="text-secondary mb-3">
        Este recurso não está incluído no plano deste projeto. Ele faz parte do plano <strong>Master</strong>.
      </p>
      <div>
        <Link to="/planos" className="btn btn-primary">
          <i className="bi bi-stars me-1" aria-hidden="true" />
          Ver planos e fazer upgrade
        </Link>
      </div>
    </div>
  );
}

/** Rota de um recurso do projeto: mostra o conteúdo só se o plano do projeto o inclui */
export function ExigeRecurso({ recurso, children }: { recurso: Recurso; children: ReactNode }) {
  const { projeto } = useProjetoAtual();
  return temRecurso(projeto, recurso) ? <>{children}</> : <RecursoBloqueado recurso={recurso} />;
}
