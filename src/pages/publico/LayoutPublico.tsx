import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { Marca, MarcaKonektron } from '../../components/Layout';
import { SeletorIdioma } from '../../components/SeletorIdioma';
import { LinkAcessibilidade } from '../../components/Acessibilidade';
import { EMAIL_ORKNEYTECH, SITE_ORKNEYTECH } from '../../lib/contato';

/** Páginas abertas (antes do login): cabeçalho com acesso e rodapé KoneKtron · OrkneyTech */
export function LayoutPublico({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  return (
    <div className="k-publico">
      <a href="#conteudo" className="visually-hidden-focusable position-absolute p-2">
        Pular para o conteúdo
      </a>
      <LinkAcessibilidade />
      <header className="k-pub-header border-bottom bg-body">
        <nav className="container-xl px-3 d-flex align-items-center gap-3" aria-label="Navegação principal">
          <Link to="/" className="text-decoration-none text-reset me-auto">
            <Marca />
          </Link>
          <Link to="/planos" className="btn btn-link btn-sm text-decoration-none">
            Planos
          </Link>
          <SeletorIdioma />
          {usuario ? (
            <Link to="/projetos" className="btn btn-primary btn-sm">
              Meus projetos
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline-primary btn-sm">
                Entrar
              </Link>
              <Link to="/registrar" className="btn btn-primary btn-sm d-none d-sm-inline-block">
                Cadastrar
              </Link>
            </>
          )}
        </nav>
      </header>
      <main id="conteudo" tabIndex={-1} className="k-pub-main">
        {children}
      </main>
      <RodapePublico />
    </div>
  );
}

function RodapePublico() {
  return (
    <footer className="k-pub-footer">
      <div className="container-xl px-3 d-flex flex-wrap align-items-center justify-content-between gap-4">
        <div className="d-flex flex-wrap align-items-center gap-4">
          <div>
            <p className="mb-2">
              <a href={`https://${SITE_ORKNEYTECH}`} target="_blank" rel="noopener noreferrer">
                {SITE_ORKNEYTECH}
                <span className="visually-hidden"> (abre em nova aba)</span>
              </a>
            </p>
            <p className="mb-0">
              <a href={`mailto:${EMAIL_ORKNEYTECH}`}>{EMAIL_ORKNEYTECH}</a>
            </p>
          </div>
          <div className="k-pub-footer-divisor d-none d-md-block" />
          <div className="d-flex gap-4">
            <div className="k-pub-footer-logo">
              <MarcaKonektron tamanho={64} variante="mono" titulo="" />
              KoneKtron
            </div>
            <div className="k-pub-footer-logo">
              <img src="/brand/orkneytech.png" alt="" width={64} height={64} className="rounded-circle" />
              OrkneyTech
            </div>
          </div>
        </div>
        <div className="k-pub-creditos">
          <p className="mb-2">Desenvolvedor: Ivam Galvão Filho</p>
          <p className="mb-2">Design UX/UI: Ivam Galvão Filho</p>
          <p className="mb-0">Logo KoneKtron: J. James Alves</p>
        </div>
      </div>
    </footer>
  );
}
