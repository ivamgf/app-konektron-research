import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const refs = [
  {
    id: 'r1',
    documentoId: 'd1',
    documentoTitulo: 'Doc 1',
    abnt: 'SILVA, A. Título. 2020.',
    apa: 'Silva, A. (2020). Título.',
    observacao: null,
  },
  { id: 'r2', documentoId: null, abnt: 'ALMEIDA, B. Livro. 2019.', apa: null, observacao: 'manual' },
];
const get = vi.fn(async () => refs);
const post = vi.fn(async () => ({ importadas: 3, jaExistiam: 1 }));
vi.mock('../lib/api', async (original) => ({ ...(await original<typeof import('../lib/api')>()), get, post }));
vi.mock('../pages/projeto/ProjetoLayout', () => ({
  useProjetoAtual: () => ({ projeto: { id: 'p1' }, papel: 'RESPONSAVEL', edita: true, dono: true }),
}));
const { default: Referencias, listaDaNorma } = await import('../pages/projeto/Referencias');

const montar = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Referencias />
    </QueryClientProvider>,
  );

describe('Referências do projeto', () => {
  it('listaDaNorma ordena e ignora quem não tem texto na norma', () => {
    expect(listaDaNorma(refs, 'abnt')).toEqual(['ALMEIDA, B. Livro. 2019.', 'SILVA, A. Título. 2020.']);
    expect(listaDaNorma(refs, 'apa')).toEqual(['Silva, A. (2020). Título.']);
  });

  it('mostra a lista em ABNT, troca para APA e traz as referências dos documentos incluídos', async () => {
    montar();
    const lista = await screen.findByRole('list', { name: /ABNT/ });
    const itens = within(lista).getAllByRole('listitem');
    expect(itens[0]).toHaveTextContent('ALMEIDA, B.');
    await userEvent.click(screen.getByRole('button', { name: 'APA' }));
    expect(await screen.findByText(/Sem texto em APA/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Trazer dos incluídos/ }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/projetos/p1/referencias/importar', { fonte: 'INCLUIDOS' }));
    expect(await screen.findByText(/3 referência\(s\) trazida\(s\)/)).toBeInTheDocument();
  });

  it('nova referência exige ABNT ou APA', async () => {
    montar();
    await userEvent.click(await screen.findByRole('button', { name: /Nova referência/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/Informe a referência em ABNT, em APA/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('APA (7ª edição)'), 'Costa, C. (2021). Artigo.');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/projetos/p1/referencias', {
        abnt: null,
        apa: 'Costa, C. (2021). Artigo.',
        observacao: null,
      }),
    );
  });
});
