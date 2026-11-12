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
  it('aceita etapa pendente (a importação inicia a etapa) e recusa dispensada ou sem documentos', () => {
    expect(aceitaImportacao(etapa({ status: 'PENDENTE' }))).toBe(true);
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
    post
      .mockResolvedValueOnce({ data: { ...rel, simulado: true } })
      .mockResolvedValueOnce({ data: { ...rel, simulado: false } });
    comQuery(<ImportarCsvEtapa revisaoId="r1" etapa={etapa()} aberto aoFechar={vi.fn()} />);
    const importar = screen.getByRole('button', { name: 'Importar' });
    expect(importar).toBeDisabled();
    await userEvent.upload(
      screen.getByLabelText('Arquivo CSV'),
      new File(['titulo;decisao\nA;sim\n'], 't.csv', { type: 'text/csv' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }));
    expect(await screen.findByText(/Simulação \(nada foi gravado ainda\)/)).toBeInTheDocument();
    expect((post.mock.calls[0][1] as FormData).get('simular')).toBe('true');
    expect(post.mock.calls[0][0]).toBe('/revisoes/r1/etapas/e1/importar');
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(await screen.findByText(/Importação concluída/)).toBeInTheDocument();
    expect((post.mock.calls[1][1] as FormData).get('simular')).toBe('false');
  });
});

describe('ImportarCsvEtapa em etapa pendente', () => {
  it('envia iniciar=true e bloqueia a simulação se a opção for desmarcada', async () => {
    post.mockResolvedValueOnce({
      data: {
        linhas: 1,
        documentosCriados: 1,
        documentosDoProjeto: 0,
        documentosDaRevisao: 0,
        decisoes: { selecionados: 1, excluidos: 0, semDecisao: 0 },
        selecionadosEmEtapasAnteriores: 0,
        temasCriados: 2,
        avisos: [],
        totalAvisos: 0,
        simulado: true,
      },
    });
    comQuery(
      <ImportarCsvEtapa
        revisaoId="r1"
        etapa={etapa({ status: 'PENDENTE', iniciadaEm: null })}
        aberto
        aoFechar={vi.fn()}
      />,
    );
    await userEvent.upload(
      screen.getByLabelText('Arquivo CSV'),
      new File(['Título,Situação\nA,Selecionado\n'], 'RIL-F1.csv', { type: 'text/csv' }),
    );
    const iniciar = screen.getByLabelText(/Iniciar esta etapa/);
    expect(iniciar).toBeChecked();
    await userEvent.click(iniciar);
    expect(screen.getByRole('button', { name: 'Simular' })).toBeDisabled();
    await userEvent.click(iniciar);
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }));
    expect(await screen.findByText(/2 tema\(s\) novo\(s\)/)).toBeInTheDocument();
    expect((post.mock.calls.at(-1)![1] as FormData).get('iniciar')).toBe('true');
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
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/revisoes/r1/etapas/e1', { nome: 'Triagem por título', exigeTriagem: false }),
    );
    await waitFor(() => expect(aoFechar).toHaveBeenCalled());
  });
});

describe('ImportarCsvEtapa: adicionar ou substituir', () => {
  it('envia o modo escolhido (adicionar é o padrão) e explica o efeito em cada fase', async () => {
    const rel = {
      linhas: 1,
      documentosCriados: 0,
      documentosDoProjeto: 0,
      documentosDaRevisao: 1,
      decisoes: { selecionados: 1, excluidos: 0, semDecisao: 0 },
      selecionadosEmEtapasAnteriores: 0,
      documentosRemovidos: 3,
      avisos: [],
      totalAvisos: 0,
      simulado: true,
    };
    post.mockReset();
    post.mockResolvedValue({ data: rel });
    const { unmount } = comQuery(<ImportarCsvEtapa revisaoId="r1" etapa={etapa()} aberto aoFechar={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /Adicionar/ })).toBeChecked();
    await userEvent.upload(screen.getByLabelText('Arquivo CSV'), new File(['titulo\nA\n'], 'scielo.csv'));
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }));
    await screen.findByText(/Simulação/);
    expect((post.mock.calls[0][1] as FormData).get('modo')).toBe('ADICIONAR');
    await userEvent.click(screen.getByRole('radio', { name: /Substituir só as bases do arquivo/ }));
    expect(screen.getByText(/saem da revisão \(com as decisões deles\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }));
    expect(await screen.findByText(/3 documento\(s\) de importações anteriores/)).toBeInTheDocument();
    expect((post.mock.calls[1][1] as FormData).get('modo')).toBe('SUBSTITUIR_BASES');
    unmount();
    // F2: os documentos vêm da F1 e não saem da revisão
    comQuery(
      <ImportarCsvEtapa
        revisaoId="r1"
        etapa={etapa({ nome: 'Triagem F2' })}
        entrada={false}
        aberto
        aoFechar={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('radio', { name: /Substituir tudo/ }));
    expect(screen.getByText(/os documentos vêm da fase anterior/)).toBeInTheDocument();
  });

  it('etapaDeEntrada: só a primeira triagem (e busca/deduplicação antes dela) recebe os documentos', async () => {
    const { etapaDeEntrada } = await import('../pages/revisao/AcoesEtapa');
    const f1 = etapa({ id: 'f1', ordem: 3 });
    const f2 = etapa({ id: 'f2', ordem: 4, nome: 'Triagem F2' });
    const busca = etapa({ id: 'b', ordem: 1, categoria: 'BUSCA', exigeTriagem: false });
    const todas = [busca, f1, f2];
    expect(etapaDeEntrada(f1, todas)).toBe(true);
    expect(etapaDeEntrada(busca, todas)).toBe(true);
    expect(etapaDeEntrada(f2, todas)).toBe(false);
  });
});
