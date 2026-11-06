import { Link } from 'react-router-dom';
import { EMAIL_ORKNEYTECH, linkPedidoCadastro, SITE_ORKNEYTECH } from '../../lib/contato';
import { LayoutPublico } from './LayoutPublico';

const DADOS = [
  'Nome completo',
  'E-mail que será usado para entrar',
  'Instituição',
  'ORCID (opcional)',
  'Finalidade de uso: pesquisa, grupo ou disciplina',
];

/** O cadastro não é aberto: o botão "Cadastrar" traz para cá, com o contato da OrkneyTech */
export function Cadastro() {
  return (
    <LayoutPublico>
      <div className="container-xl px-3 py-5">
        <div className="card shadow-sm mx-auto k-pub-cartao" style={{ maxWidth: 720 }}>
          <div className="k-pub-cartao-topo" />
          <div className="card-body p-4 p-md-5">
            <div className="d-flex align-items-center gap-3 mb-3">
              <span className="k-home-icone mb-0" aria-hidden="true">
                <i className="bi bi-person-plus" />
              </span>
              <h1 className="h2 mb-0">Cadastro de novos usuários</h1>
            </div>
            <p className="text-large">
              O Konektron Research não tem cadastro aberto. As contas de acesso são criadas pela equipe da{' '}
              <strong>OrkneyTech</strong>.
            </p>
            <p>
              Para solicitar o seu acesso, entre em contato com a OrkneyTech pelo e-mail{' '}
              <a href={`mailto:${EMAIL_ORKNEYTECH}`}>{EMAIL_ORKNEYTECH}</a> informando:
            </p>
            <ul className="mb-4">
              {DADOS.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <p className="small text-secondary">
              Depois que a conta for criada, você receberá por e-mail as instruções para confirmar o endereço e entrar
              no sistema.
            </p>
            <div className="d-flex flex-wrap gap-2 mt-4">
              <a href={linkPedidoCadastro()} className="btn btn-primary">
                <i className="bi bi-envelope me-1" aria-hidden="true" />
                Solicitar cadastro por e-mail
              </a>
              <a
                href={`https://${SITE_ORKNEYTECH}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline-primary"
              >
                <i className="bi bi-box-arrow-up-right me-1" aria-hidden="true" />
                Site da OrkneyTech
                <span className="visually-hidden"> (abre em nova aba)</span>
              </a>
            </div>
            <hr className="my-4" />
            <div className="d-flex flex-wrap justify-content-between gap-2 small">
              <Link to="/">
                <i className="bi bi-arrow-left me-1" aria-hidden="true" />
                Voltar ao início
              </Link>
              <span>
                Já tem conta? <Link to="/login">Entrar</Link>
              </span>
            </div>
          </div>
        </div>
      </div>
    </LayoutPublico>
  );
}
