import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { EtapaRevisao, Revisao } from '../lib/tipos';

// API falsa: dois documentos pendentes e critérios de exclusão no protocolo
const chamadas: { metodo: string; url: string; corpo?: unknown }[] = [];
vi.mock('../lib/api', async (original) => {
  const real = await original<typeof import('../lib/api')>();
  const documentos = [
    {
      revisaoDocumentoId: 'rd1',
      documentoId: 'd1',
      titulo: 'Ontologia de domínio',
      resumo: 'Resumo 1',
      decisaoFinal: null,
      conflito: false,
      minhaDecisao: null,
      origem: 'BUSCA',
    },
    {
      revisaoDocumentoId: 'rd2',
      documentoId: 'd2',
      titulo: 'Dados hidrológicos',
      resumo: 'Resumo 2',
      decisaoFinal: null,
      conflito: false,
      minhaDecisao: null,
      origem: 'BUSCA',
    },
  ];
  return {
    ...real,
    get: vi.fn(async (url: string) => {
      chamadas.push({ metodo: 'GET', url });
      if (url.startsWith('/etapas/'))
        return {
          etapa: {},
          contagens: { total: 2, selecionados: 0, excluidos: 0, conflitos: 0, semDecisao: 2 },
          documentos,
        };
      if (url.endsWith('/protocolo'))
        return { criterios: [{ id: 'c1', tipo: 'EXCLUSAO', nome: 'Fora do período' }], questoes: [], strings: [] };
      throw new Error(url);
    }),
    put: vi.fn(async (url: string, corpo: unknown) => {
      chamadas.push({ metodo: 'PUT', url, corpo });
      return { contagens: {} };
    }),
  };
});
vi.mock('../pages/projeto/ProjetoLayout', () => ({
  useProjetoAtual: () => ({ projeto: { id: 'p1' }, papel: 'COLABORADOR', edita: true, dono: false }),
}));
const { Triagem } = await import('../pages/revisao/Triagem');

const revisao = { id: 'r1', doisRevisores: false } as Revisao;
const etapa = {
  id: 'e1',
  revisaoId: 'r1',
  status: 'EM_ANDAMENTO',
  exigeTriagem: true,
  permiteExclusao: true,
  categoria: 'TRIAGEM',
} as EtapaRevisao;

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Triagem revisao={revisao} etapa={etapa} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Triagem (UC08)', () => {
  beforeEach(() => (chamadas.length = 0));

  it('tecla S seleciona o documento aberto e passa para o próximo pendente', async () => {
    montar();
    expect(await screen.findByRole('heading', { name: 'Ontologia de domínio' })).toBeInTheDocument();
    await userEvent.keyboard('s');
    await waitFor(() => expect(chamadas.find((c) => c.metodo === 'PUT')).toBeDefined());
    const put = chamadas.find((c) => c.metodo === 'PUT')!;
    expect(put.url).toBe('/etapas/e1/documentos/rd1/decisao');
    expect(put.corpo).toEqual({ decisao: 'SELECIONADO', motivo: null, criterioId: null, observacao: null });
    expect(await screen.findByRole('heading', { name: 'Dados hidrológicos' })).toBeInTheDocument();
  });

  it('tecla E abre o motivo; exclusão por critério exige escolher o critério (RN10)', async () => {
    montar();
    await screen.findByRole('heading', { name: 'Ontologia de domínio' });
    await userEvent.keyboard('e');
    await userEvent.click(screen.getByLabelText('Critério de exclusão'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
    expect(await screen.findByText('Escolha o critério de exclusão')).toBeInTheDocument();
    expect(chamadas.some((c) => c.metodo === 'PUT')).toBe(false);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Critério de exclusão' }), 'c1');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
    await waitFor(() =>
      expect(chamadas.find((c) => c.metodo === 'PUT')?.corpo).toEqual({
        decisao: 'EXCLUIDO',
        motivo: 'CRITERIO',
        criterioId: 'c1',
        observacao: null,
      }),
    );
  });
});
