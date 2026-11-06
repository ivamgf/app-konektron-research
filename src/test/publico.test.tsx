import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EMAIL_ORKNEYTECH, linkPedidoCadastro } from '../lib/contato';

const auth = vi.hoisted(() => ({
  usuario: null as null | { nome: string; email: string; perfilGlobal: string },
  carregando: false,
  entrar: vi.fn(),
  sair: vi.fn(),
}));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => auth }));
const { App } = await import('../App');

function abrir(rota: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[rota]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth.usuario = null;
  auth.carregando = false;
});

describe('Página inicial', () => {
  it('apresenta o software sem exigir login', () => {
    abrir('/');
    expect(screen.getByRole('heading', { level: 1, name: /Pesquisa científica/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Como funciona' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recursos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Protocolo de pesquisa' })).toBeInTheDocument();
    // não redireciona para o login
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();
  });

  it('leva o visitante ao login e o botão de cadastro à página de contato', () => {
    abrir('/');
    const hero = screen.getByRole('region', { name: /Pesquisa científica/ });
    expect(within(hero).getByRole('link', { name: /Entrar/ })).toHaveAttribute('href', '/login');
    expect(within(hero).getByRole('link', { name: 'Cadastrar' })).toHaveAttribute('href', '/registrar');
    expect(screen.getByRole('link', { name: 'Como obter acesso' })).toHaveAttribute('href', '/registrar');
  });

  it('mostra o atalho para os projetos a quem já está logado', () => {
    auth.usuario = { nome: 'Ana Souza', email: 'ana@example.com', perfilGlobal: 'USUARIO' };
    abrir('/');
    expect(screen.getByRole('link', { name: /Ir para meus projetos/ })).toHaveAttribute('href', '/projetos');
    expect(screen.queryByRole('link', { name: 'Cadastrar' })).not.toBeInTheDocument();
    expect(screen.getByText('Bem-vindo de volta, Ana')).toBeInTheDocument();
  });
});

describe('Cadastro', () => {
  it('não oferece formulário: orienta a falar com a OrkneyTech', () => {
    abrir('/registrar');
    expect(screen.getByRole('heading', { level: 1, name: 'Cadastro de novos usuários' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Criar conta/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/OrkneyTech/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Solicitar cadastro por e-mail/ })).toHaveAttribute(
      'href',
      linkPedidoCadastro(),
    );
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
  });

  it('o endereço /cadastro leva à mesma página', () => {
    abrir('/cadastro');
    expect(screen.getByRole('heading', { level: 1, name: 'Cadastro de novos usuários' })).toBeInTheDocument();
  });

  it('o e-mail de pedido vai para a OrkneyTech com os dados necessários', () => {
    const link = linkPedidoCadastro();
    expect(link.startsWith(`mailto:${EMAIL_ORKNEYTECH}?`)).toBe(true);
    const corpo = decodeURIComponent(new URL(link).searchParams.get('body') ?? '');
    expect(corpo).toContain('Nome completo:');
    expect(corpo).toContain('Instituição:');
  });
});

describe('Login', () => {
  it('o link de cadastro aponta para a página de contato', () => {
    abrir('/login');
    expect(screen.getByRole('link', { name: 'Cadastrar' })).toHaveAttribute('href', '/registrar');
    expect(screen.getByRole('link', { name: /Voltar ao início/ })).toHaveAttribute('href', '/');
  });
});

describe('Área logada', () => {
  it('sem sessão, as telas internas continuam exigindo login', () => {
    abrir('/projetos');
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });
});
