import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { get } from '../lib/api';
import type { Notificacao } from '../lib/tipos';
import { Carregando } from './ui';
import { SeletorIdioma } from './SeletorIdioma';
import { LinkAcessibilidade } from './Acessibilidade';
import { usePlano } from '../lib/planos';

export function Marca({ grande = false }: { grande?: boolean }) {
  return (
    <span
      className={`d-inline-flex align-items-center gap-2 fw-bold notranslate ${grande ? 'fs-4' : ''}`}
      translate="no"
    >
      <img src="/favicon.svg" alt="" width={grande ? 40 : 28} height={grande ? 40 : 28} />
      <span>
        Konektron <span className="text-primary">Research</span>
      </span>
    </span>
  );
}

/** Símbolo KoneKtron do Design System (4. Brand Icons): colorido ou monocromático para fundos escuros */
export function MarcaKonektron({
  tamanho = 200,
  variante = 'cor',
  titulo = 'KoneKtron',
  className = '',
}: {
  tamanho?: number;
  variante?: 'cor' | 'mono';
  titulo?: string;
  className?: string;
}) {
  const laranja = variante === 'mono' ? '#808080' : '#fe7d05';
  const azul = variante === 'mono' ? '#ffffff' : '#019bcd';
  return (
    <svg
      viewBox="0 0 100 100"
      width={tamanho}
      height={tamanho}
      className={className}
      role={titulo ? 'img' : undefined}
      aria-label={titulo || undefined}
      aria-hidden={titulo ? undefined : true}
    >
      <path d="M0 0H31V35H66V66H31V100H0Z" fill={laranja} />
      <path d="M35 0H100V66H70V31H35Z" fill={azul} />
      <path d="M35 70H100V100H35Z" fill={azul} />
    </svg>
  );
}

const MENU = [
  { para: '/projetos', icone: 'bi-folder2-open', texto: 'Projetos' },
  { para: '/tipos-revisao', icone: 'bi-diagram-3', texto: 'Tipos de revisão' },
  { para: '/notificacoes', icone: 'bi-bell', texto: 'Notificações' },
  { para: '/perfil', icone: 'bi-person-circle', texto: 'Perfil' },
  { para: '/planos', icone: 'bi-stars', texto: 'Planos' },
];
const MENU_ADMIN = [
  { para: '/admin/usuarios', icone: 'bi-people', texto: 'Usuários' },
  { para: '/admin/catalogos', icone: 'bi-journal-bookmark', texto: 'Catálogos' },
];

/** Área autenticada: barra lateral + conteúdo. Sem sessão, manda para o login. */
export function Layout() {
  const { usuario, carregando, sair } = useAuth();
  const local = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  // menu lateral no celular: Esc fecha e devolve o foco ao botão que o abriu
  useEffect(() => {
    if (!menuAberto) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenuAberto(false);
      document.getElementById('botao-menu')?.focus();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [menuAberto]);
  const naoLidas = useQuery({
    queryKey: ['notificacoes', 'nao-lidas'],
    queryFn: () => get<Notificacao[]>('/notificacoes', { naoLidas: true }),
    enabled: !!usuario,
    refetchInterval: 60_000,
  });

  const plano = usePlano(!!usuario);

  if (carregando) return <Carregando texto="Abrindo o Konektron Research…" />;
  if (!usuario) return <Navigate to="/login" replace state={{ de: local.pathname + local.search }} />;

  const qtd = naoLidas.data?.length ?? 0;
  const link = (m: (typeof MENU)[number]) => (
    <li className="nav-item" key={m.para}>
      <NavLink to={m.para} className="nav-link d-flex align-items-center gap-2" onClick={() => setMenuAberto(false)}>
        <i className={`bi ${m.icone}`} aria-hidden="true" />
        {m.texto}
        {m.para === '/notificacoes' && qtd > 0 && (
          <span className="badge rounded-pill text-bg-warning ms-auto">
            {qtd}
            <span className="visually-hidden"> não lidas</span>
          </span>
        )}
      </NavLink>
    </li>
  );

  return (
    <div className="k-shell">
      <a href="#conteudo" className="visually-hidden-focusable position-absolute p-2">
        Pular para o conteúdo
      </a>
      <LinkAcessibilidade />
      {menuAberto && (
        <div className="k-sidebar-fundo d-md-none" aria-hidden="true" onClick={() => setMenuAberto(false)} />
      )}
      <nav
        id="menu-principal"
        className={`k-sidebar p-3 d-flex flex-column ${menuAberto ? 'aberta' : ''}`}
        aria-label="Menu principal"
      >
        <Link to="/projetos" className="text-decoration-none text-reset mb-4">
          <Marca />
        </Link>
        <ul className="nav flex-column gap-1">{MENU.map(link)}</ul>
        {usuario.perfilGlobal === 'ADMIN' && (
          <>
            <div className="k-label text-secondary mt-4 mb-2">Administração</div>
            <ul className="nav flex-column gap-1">{MENU_ADMIN.map(link)}</ul>
          </>
        )}
        <div className="mt-auto pt-4 small">
          <SeletorIdioma className="mb-3" />
          <div className="fw-bold text-truncate notranslate" translate="no">
            {usuario.nome}
          </div>
          <div className="text-secondary text-truncate mb-2">{usuario.email}</div>
          <button className="btn btn-outline-secondary btn-sm w-100" onClick={sair}>
            <i className="bi bi-box-arrow-right me-1" aria-hidden="true" />
            Sair
          </button>
        </div>
      </nav>
      <div className="k-main">
        <header className="d-md-none d-flex align-items-center justify-content-between border-bottom p-2 bg-body">
          <button
            id="botao-menu"
            type="button"
            className="btn btn-outline-secondary btn-sm"
            aria-label="Menu"
            aria-expanded={menuAberto}
            aria-controls="menu-principal"
            onClick={() => setMenuAberto((v) => !v)}
          >
            <i className="bi bi-list" aria-hidden="true" />
          </button>
          <Marca />
          <SeletorIdioma />
          <Link
            to="/notificacoes"
            className="btn btn-outline-secondary btn-sm position-relative"
            aria-label={qtd > 0 ? `Notificações: ${qtd} não lidas` : 'Notificações'}
          >
            <i className="bi bi-bell" aria-hidden="true" />
            {qtd > 0 && (
              <span
                className="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-warning"
                aria-hidden="true"
              >
                {qtd}
              </span>
            )}
          </Link>
        </header>
        <main id="conteudo" tabIndex={-1} className="container-fluid p-3 p-lg-4">
          {/* plano gratuito expirado: só o perfil e as notificações continuam abertos até o upgrade */}
          {plano.data?.bloqueado && !['/perfil', '/notificacoes'].includes(local.pathname) ? (
            <ContaBloqueada />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}

/** Fim dos 3 meses do plano gratuito: projetos removidos e acesso só ao upgrade */
function ContaBloqueada() {
  return (
    <div
      className="card border-0 bg-body-tertiary text-center p-4 p-md-5 mx-auto"
      style={{ maxWidth: 640 }}
      role="alert"
    >
      <i className="bi bi-lock-fill fs-1 text-secondary mb-2" aria-hidden="true" />
      <h1 className="h4">O período do plano gratuito terminou</h1>
      <p className="text-secondary">
        Os projetos do plano Free ficam 3 meses no sistema depois de atingido o limite de projetos. Esse prazo terminou
        e sua conta está bloqueada. Faça o upgrade em até 30 dias para recuperar seus projetos.
      </p>
      <div>
        <Link to="/planos" className="btn btn-primary btn-lg">
          <i className="bi bi-stars me-1" aria-hidden="true" />
          Ver planos e fazer upgrade
        </Link>
      </div>
    </div>
  );
}

export function RequerAdmin() {
  const { usuario } = useAuth();
  if (usuario?.perfilGlobal !== 'ADMIN') return <Navigate to="/projetos" replace />;
  return <Outlet />;
}
