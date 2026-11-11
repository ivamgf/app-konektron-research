import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const auth = vi.hoisted(() => ({
  usuario: null as null | { nome: string; email: string; perfilGlobal: string },
  carregando: false,
  entrar: vi.fn(),
  sair: vi.fn(),
}));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => auth }));
const post = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock('../lib/api', async (original) => ({ ...(await original<typeof import('../lib/api')>()), post }));
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
  auth.entrar.mockReset();
  post.mockClear();
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

  it('leva o visitante ao login e ao cadastro grátis', () => {
    abrir('/');
    const hero = screen.getByRole('region', { name: /Pesquisa científica/ });
    expect(within(hero).getByRole('link', { name: /Entrar/ })).toHaveAttribute('href', '/login');
    expect(within(hero).getByRole('link', { name: 'Criar conta grátis' })).toHaveAttribute(
      'href',
      '/registrar?plano=FREE',
    );
  });

  it('apresenta os planos com o cadastro de cada um, no ciclo escolhido', async () => {
    abrir('/');
    const planos = screen.getByRole('region', { name: 'Planos' });
    expect(within(planos).getByRole('heading', { name: 'Free' })).toBeInTheDocument();
    expect(within(planos).getByRole('heading', { name: 'Institucional' })).toBeInTheDocument();
    expect(within(planos).getByText('R$ 49,90')).toBeInTheDocument();
    expect(within(planos).getByRole('link', { name: 'Cadastrar grátis' })).toHaveAttribute(
      'href',
      '/registrar?plano=FREE&ciclo=MENSAL',
    );
    await userEvent.click(within(planos).getByRole('button', { name: /Anual/ }));
    expect(within(planos).getByText('R$ 999,00')).toBeInTheDocument();
    expect(within(planos).getByRole('link', { name: 'Cadastrar e assinar o Master' })).toHaveAttribute(
      'href',
      '/registrar?plano=MASTER&ciclo=ANUAL',
    );
  });

  it('mostra o atalho para os projetos a quem já está logado', () => {
    auth.usuario = { nome: 'Ana Souza', email: 'ana@example.com', perfilGlobal: 'USUARIO' };
    abrir('/');
    expect(screen.getByRole('link', { name: /Ir para meus projetos/ })).toHaveAttribute('href', '/projetos');
    expect(screen.queryByRole('link', { name: /Cadastrar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Assinar o Master' })).toHaveAttribute(
      'href',
      '/planos?assinar=MASTER&ciclo=MENSAL',
    );
    expect(screen.getByText('Bem-vindo de volta, Ana')).toBeInTheDocument();
  });
});

describe('Cadastro', () => {
  it('formulário aberto: valida, cria a conta, entra e segue para a assinatura do plano escolhido', async () => {
    abrir('/registrar?plano=MASTER&ciclo=ANUAL');
    expect(screen.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeInTheDocument();
    expect(screen.getByText(/Plano escolhido:/)).toHaveTextContent('Master · R$ 999,00/ano');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta e ir para o pagamento' }));
    expect(await screen.findByText('Informe o nome completo')).toBeInTheDocument();
    expect(screen.getByText('É preciso aceitar o tratamento dos dados')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'segredo123');
    await userEvent.type(screen.getByLabelText('Confirme a senha'), 'segredo124');
    await userEvent.click(screen.getByLabelText(/Concordo com o tratamento/));
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta e ir para o pagamento' }));
    expect(await screen.findByText('As senhas não conferem')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Confirme a senha'));
    await userEvent.type(screen.getByLabelText('Confirme a senha'), 'segredo123');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta e ir para o pagamento' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/auth/registrar', {
        nome: 'Ana Souza',
        email: 'ana@example.com',
        senha: 'segredo123',
        consentimentoLgpd: true,
      }),
    );
    await waitFor(() => expect(auth.entrar).toHaveBeenCalledWith('ana@example.com', 'segredo123'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Planos' })).toBeInTheDocument();
  });

  it('o endereço /cadastro leva à mesma página, no plano Free', async () => {
    abrir('/cadastro');
    expect(screen.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar conta grátis' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Standard' }));
    expect(screen.getByRole('button', { name: 'Criar conta e ir para o pagamento' })).toBeInTheDocument();
  });
});

describe('Login', () => {
  it('o link de cadastro aponta para o formulário', () => {
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

  it('enquanto retoma a sessão, mostra a tela de carregamento centralizada', () => {
    auth.carregando = true;
    abrir('/projetos');
    const tela = screen.getByText('Abrindo o Konektron Research…').closest('[role="status"]') as HTMLElement;
    expect(tela).toHaveTextContent('Abrindo o Konektron Research…');
    expect(tela).toHaveClass('min-vh-100', 'justify-content-center', 'align-items-center');
    expect(tela.querySelector('.spinner-border')).not.toBeNull();
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument();
  });
});
