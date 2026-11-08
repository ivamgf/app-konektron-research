import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { EtapaRevisao } from '../lib/tipos';

const post = vi.fn();
const patch = vi.fn();
vi.mock('../lib/api', async (original) => {
  const real = await original<typeof import('../lib/api')>();
  return { ...real, patch, api: { ...real.api, post } };
});
const { aceitaImportacao, EditarEtapa, ImportarCsvEtapa } = await import('../pages/revisao/AcoesEtapa');

const etapa = (e: Partial<EtapaRevisao> = {}): EtapaRevisao => ({
  id: 'e1',
  revisaoId: 'r1',
  ordem: 3,
  nome: 'Triagem F1',
  categoria: 'TRIAGEM',
  exigeTriagem: true,
  permiteExclusao: true,
  status: 'EM_ANDAMENTO',
  justificativaDispensa: null,
  iniciadaEm: '2026-11-01T12:00:00.000Z',
  concluidaEm: null,
  ...e,
});
const comQuery = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

describe('aceitaImportacao', () => {
  it('aceita busca, triagem e inclusão iniciadas ou concluídas', () => {
    expect(aceitaImportacao(etapa())).toBe(true);
    expect(aceitaImportacao(etapa({ status: 'CONCLUIDA', categoria: 'INCLUSAO', exigeTriagem: false }))).toBe(true);
    expect(aceitaImportacao(etapa({ categoria: 'BUSCA', exigeTriagem: false }))).toBe(true);
  });
  it('recusa etapa pendente, dispensada ou sem documentos', () => {
    expect(aceitaImportacao(etapa({ status: 'PENDENTE' }))).toBe(false);
    expect(aceitaImportacao(etapa({ status: 'DISPENSADA' }))).toBe(false);
    expect(aceitaImportacao(etapa({ categoria: 'ANALISE', exigeTriagem: false, permiteExclusao: false }))).toBe(false);
    expect(aceitaImportacao(etapa({ categoria: 'LIVRE', exigeTriagem: false, permiteExclusao: false }))).toBe(false);
  });
});

describe('ImportarCsvEtapa', () => {
  it('simula antes de importar e mostra o resumo', async () => {
    const rel = {
      linhas: 2,
      documentosCriados: 1,
      documentosDoProjeto: 0,
      documentosDaRevisao: 1,
      decisoes: { selecionados: 1, excluidos: 1, semDecisao: 0 },
      selecionadosEmEtapasAnteriores: 0,
      avisos: [],
      totalAvisos: 0,
    };
    post.mockResolvedValueOnce({ data: { ...rel, simulado: true } }).mockResolvedValueOnce({ data: { ...rel, simulado: false } });
    comQuery(<ImportarCsvEtapa revisaoId="r1" etapa={etapa()} aberto aoFechar={vi.fn()} />);
    const importar = screen.getByRole('button', { name: 'Importar' });
    expect(importar).toBeDisabled();
    await userEvent.upload(screen.getByLabelText('Arquivo CSV'), new File(['titulo;decisao\nA;sim\n'], 't.csv', { type: 'text/csv' }));
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }));
    expect(await screen.findByText(/Simulação \(nada foi gravado ainda\)/)).toBeInTheDocument();
    expect((post.mock.calls[0][1] as FormData).get('simular')).toBe('true');
    expect(post.mock.calls[0][0]).toBe('/revisoes/r1/etapas/e1/importar');
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(await screen.findByText(/Importação concluída/)).toBeInTheDocument();
    expect((post.mock.calls[1][1] as FormData).get('simular')).toBe('false');
  });
});

describe('EditarEtapa', () => {
  it('envia só o que mudou e permite editar etapa concluída', async () => {
    patch.mockResolvedValueOnce({});
    const aoFechar = vi.fn();
    comQuery(
      <EditarEtapa
        revisaoId="r1"
        etapa={etapa({ status: 'CONCLUIDA', concluidaEm: '2026-11-05T12:00:00.000Z' })}
        aberto
        aoFechar={aoFechar}
      />,
    );
    const nome = screen.getByLabelText('Nome');
    await userEvent.clear(nome);
    await userEvent.type(nome, 'Triagem por título');
    await userEvent.click(screen.getByLabelText(/Exige triagem/));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/revisoes/r1/etapas/e1', { nome: 'Triagem por título', exigeTriagem: false }));
    await waitFor(() => expect(aoFechar).toHaveBeenCalled());
  });
});
