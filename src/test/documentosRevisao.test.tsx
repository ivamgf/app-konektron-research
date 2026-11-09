import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const docs = [
  {
    id: 'rd1',
    documentoId: 'd1',
    origem: 'INTEGRADO',
    situacao: 'INCLUIDO',
    duplicadoDeId: null,
    titulo: 'Cloudy, increasingly FAIR',
    autores: null,
    ano: 2017,
    doi: null,
    baseNome: null,
    categoriaNome: null,
  },
  {
    id: 'rd2',
    documentoId: 'd2',
    origem: 'BUSCA',
    situacao: 'INCLUIDO',
    duplicadoDeId: null,
    titulo: 'Da busca',
    autores: null,
    ano: 2020,
    doi: null,
    baseNome: 'Scopus',
    categoriaNome: null,
  },
];
const get = vi.fn(async (url: string) => {
  if (url.endsWith('/documentos') && url.startsWith('/revisoes/')) return docs;
  if (url.endsWith('/categorias')) return [];
  if (url === '/documentos/d1') return { id: 'd1', titulo: 'Cloudy, increasingly FAIR', temas: [] };
  return [];
});
const remover = vi.fn(async () => ({ data: { documentoApagado: true } }));
vi.mock('../lib/api', async (original) => {
  const real = await original<typeof import('../lib/api')>();
  return { ...real, get, api: { ...real.api, delete: remover } };
});
vi.mock('../pages/projeto/ProjetoLayout', () => ({
  useProjetoAtual: () => ({ projeto: { id: 'p1' }, papel: 'RESPONSAVEL', edita: true, dono: true }),
}));
vi.mock('../pages/projeto/Documentos', () => ({
  FormDocumento: ({ inicial }: { inicial: { titulo: string } }) => <div>Formulário de {inicial.titulo}</div>,
}));
const { DocumentosDaRevisao } = await import('../pages/revisao/DocumentosDaRevisao');

const montar = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <DocumentosDaRevisao revisaoId="r1" situacaoFixa="INCLUIDO" acoes />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('DocumentosDaRevisao com ações (inclusão de revisão anterior e integrados)', () => {
  it('Editar abre o formulário do documento', async () => {
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Cloudy, increasingly FAIR' }));
    expect(await screen.findByText('Formulário de Cloudy, increasingly FAIR')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/documentos/d1');
  });

  it('Excluir pede confirmação e remove da revisão; documento de busca não pode ser excluído aqui', async () => {
    montar();
    expect(await screen.findByRole('button', { name: /Excluir Da busca/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Cloudy, increasingly FAIR' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() =>
      expect(remover).toHaveBeenCalledWith('/revisoes/r1/documentos/rd1', { params: { apagarDocumento: true } }),
    );
  });
});
