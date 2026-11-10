import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const auth = vi.hoisted(() => ({
  usuario: { id: 'u1', nome: 'Ana Silva', email: 'ana@exemplo.org', perfilGlobal: 'USUARIO' } as null | Record<
    string,
    string
  >,
  carregando: false,
  entrar: vi.fn(),
  sair: vi.fn(),
}));
const respostas = vi.hoisted(() => ({ plano: {} as Record<string, unknown>, projeto: {} as Record<string, unknown> }));
const get = vi.hoisted(() =>
  vi.fn(async (url: string) => {
    if (url === '/me/plano') return respostas.plano;
    if (url === '/planos/assinatura')
      return {
        cobrancaAtiva: true,
        sandbox: true,
        cpfCnpj: null,
        descontoEstudante: false,
        precos: { STANDARD: { MENSAL: 49.9, ANUAL: 499 }, MASTER: { MENSAL: 99.9, ANUAL: 999 } },
        assinatura: null,
        pagamentos: [],
      };
    if (url === '/projetos') return [];
    if (url === '/notificacoes') return [];
    if (url.startsWith('/projetos/')) return respostas.projeto;
    return [];
  }),
);
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => auth }));
const post = vi.hoisted(() => vi.fn(async () => ({ linkFatura: 'https://sandbox.asaas.com/i/abc123' })));
const abrirFatura = vi.hoisted(() => vi.fn());
vi.mock('../lib/api', async (original) => ({ ...(await original<typeof import('../lib/api')>()), get, post }));
vi.mock('../lib/assinatura', async (original) => ({
  ...(await original<typeof import('../lib/assinatura')>()),
  abrirFatura,
}));
const { App } = await import('../App');

const abrir = (rota: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[rota]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const planoFree = {
  plano: 'FREE',
  limiteProjetos: 3,
  projetosUsados: 3,
  podeCriarProjeto: false,
  expiraEm: '2027-02-10T12:00:00.000Z',
  bloqueado: false,
  recursos: [],
};

beforeEach(() => {
  respostas.plano = planoFree;
  respostas.projeto = {
    id: '00000000-0000-0000-0000-0000000000a1',
    titulo: 'Projeto Standard',
    papel: 'RESPONSAVEL',
    status: 'ATIVO',
    recursos: [],
  };
});

describe('Planos', () => {
  it('Free no limite: botão Novo projeto desabilitado e convite ao upgrade com a data de remoção', async () => {
    abrir('/projetos');
    expect(await screen.findByText(/Você usou os 3 projetos do plano Free/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Novo projeto/ })).toBeDisabled();
    expect(screen.getByText(/Seus projetos ficam disponíveis até/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Fazer upgrade/ })).toHaveAttribute('href', '/planos');
  });

  it('abaixo do limite o botão fica habilitado e mostra o uso', async () => {
    respostas.plano = { ...planoFree, projetosUsados: 1, podeCriarProjeto: true, expiraEm: null };
    abrir('/projetos');
    expect(await screen.findByText(/1 de 3 projetos usados/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Novo projeto/ })).toBeEnabled();
  });

  it('projeto sem os recursos do Master: abas travadas e aviso de upgrade na rota', async () => {
    abrir('/projetos/00000000-0000-0000-0000-0000000000a1/artigo');
    expect(await screen.findByRole('heading', { name: 'Gerador de artigo' })).toBeInTheDocument();
    expect(screen.getByText(/faz parte do plano/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Questões$/ })).not.toBeInTheDocument();
    expect(screen.getByText('Questões').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('link', { name: /Documentos/ })).toBeInTheDocument();
  });

  it('conta bloqueada pelo fim do plano gratuito vê só a tela de upgrade', async () => {
    respostas.plano = { ...planoFree, bloqueado: true };
    abrir('/projetos');
    expect(await screen.findByRole('heading', { name: /O período do plano gratuito terminou/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Novo projeto/ })).not.toBeInTheDocument();
  });

  it('página de planos: preços, plano atual e assinatura com CPF/CNPJ levando à fatura do Asaas', async () => {
    abrir('/planos');
    expect(await screen.findByText(/Seu plano atual/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Standard' })).toBeInTheDocument();
    expect(screen.getByText('R$ 49,90')).toBeInTheDocument();
    expect(screen.getByText('R$ 99,90')).toBeInTheDocument();
    // assinar: CPF/CNPJ no formulário, chamada à API e ida para a fatura do Asaas
    await userEvent.click(screen.getByRole('button', { name: 'Assinar o Master' }));
    expect(await screen.findByText(/Ambiente de testes \(sandbox\)/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('CPF ou CNPJ para a cobrança'), '52998224724');
    await userEvent.click(screen.getByRole('button', { name: /Ir para o pagamento/ }));
    expect(await screen.findByText('Informe um CPF ou CNPJ válido.')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('CPF ou CNPJ para a cobrança'));
    await userEvent.type(screen.getByLabelText('CPF ou CNPJ para a cobrança'), '52998224725');
    expect(screen.getByLabelText('CPF ou CNPJ para a cobrança')).toHaveValue('529.982.247-25');
    await userEvent.click(screen.getByRole('button', { name: /Ir para o pagamento/ }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/planos/assinar', {
        plano: 'MASTER',
        ciclo: 'MENSAL',
        cpfCnpj: '52998224725',
      }),
    );
    await waitFor(() => expect(abrirFatura).toHaveBeenCalledWith('https://sandbox.asaas.com/i/abc123'));
  });
});
