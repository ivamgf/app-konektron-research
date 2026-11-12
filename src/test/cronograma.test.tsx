import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import {
  completarCronograma,
  cronogramaInicial,
  marcacoesForaDosAnos,
  marcarPeriodo,
  mesesDaEtapaRevisao,
  mesesEntre,
  moverEtapa,
  paraSalvar,
  periodoMarcado,
  periodosDoAno,
  preencherPelasDatas,
  type DadosCronograma,
  type EtapaDaRevisao,
} from '../pages/projeto/cronogramaLogica';
import {
  alternarSecao,
  contarPalavras,
  opcoesIniciais,
  pendentes,
  secoesPadrao,
} from '../pages/projeto/relatorioLogica';

const etapasRevisao: EtapaDaRevisao[] = [
  {
    id: 're1',
    nome: 'Busca',
    ordem: 1,
    categoria: 'BUSCA',
    status: 'CONCLUIDA',
    iniciadaEm: '2024-10-02T12:00:00Z',
    concluidaEm: '2024-11-20T12:00:00Z',
    revisaoId: 'r1',
    revisaoTitulo: 'RIL',
  },
  {
    id: 're2',
    nome: 'Triagem F1',
    ordem: 2,
    categoria: 'TRIAGEM',
    status: 'PENDENTE',
    iniciadaEm: null,
    concluidaEm: null,
    revisaoId: 'r1',
    revisaoTitulo: 'RIL',
  },
];

let salvo: DadosCronograma | null = null;
const get = vi.fn(async (url: string) => {
  if (url.endsWith('/cronograma'))
    return {
      dados: salvo,
      atualizadoEm: null,
      sugestoes: { dataInicio: '2024-03-01', dataFim: '2025-12-31', etapasRevisao },
    };
  if (url.startsWith('/tarefas/'))
    return {
      id: 9,
      fila: 'relatorio-pesquisa',
      status: 'CONCLUIDA',
      resultado: {
        url: 'http://x/a.pdf',
        arquivo: { nomeOriginal: 'relatorio_pesquisa.pdf', mimeType: 'application/pdf' },
      },
    };
  if (url.endsWith('/relatorio'))
    return {
      dados: null,
      atualizadoEm: null,
      revisoes: [{ id: 'r1', titulo: 'RIL', status: 'EM_ANDAMENTO', tipoNome: 'Integrativa', sistematica: false }],
      revisaoId: 'r1',
      questoes: [{ id: 'q1', codigo: 'QA1', enunciado: 'Quais recursos?' }],
      secoesPadrao: secoesPadrao(false),
    };
  throw new Error(`GET inesperado ${url}`);
});
const put = vi.fn(async (_url: string, _body: unknown) => ({ atualizadoEm: '2026-11-11T12:00:00Z' }));
const post = vi.fn(async (url: string, _body?: unknown) =>
  url.endsWith('/previa') ? { html: '<p>prévia</p>' } : { tarefaId: 9 },
);
vi.mock('../lib/api', async (original) => ({ ...(await original<typeof import('../lib/api')>()), get, put, post }));
vi.mock('../pages/projeto/ProjetoLayout', () => ({
  useProjetoAtual: () => ({ projeto: { id: 'p1' }, papel: 'RESPONSAVEL', edita: true, dono: true }),
}));
const { default: Cronograma } = await import('../pages/projeto/Cronograma');
const { default: Relatorio } = await import('../pages/projeto/Relatorio');

const montar = (el: React.ReactNode) =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>{el}</QueryClientProvider>
    </MemoryRouter>,
  );

const limpar = () => {
  salvo = null;
  put.mockClear();
  post.mockClear();
};

describe('lógica do cronograma', () => {
  it('períodos por granularidade e descrição acessível', () => {
    expect(periodosDoAno('TRIMESTRAL', 2025).map((p) => p.rotulo)).toEqual(['Trim 1', 'Trim 2', 'Trim 3', 'Trim 4']);
    expect(periodosDoAno('TRIMESTRAL', 2025)[1].descricao).toBe('2º trimestre de 2025 (abril a junho)');
    expect(periodosDoAno('MENSAL', 2025)[2].descricao).toBe('março de 2025');
    expect(periodosDoAno('SEMESTRAL', 2025)[1].meses).toHaveLength(6);
  });

  it('marcar um período marca os meses dele; a troca de granularidade preserva', () => {
    const e = marcarPeriodo(
      { id: 'a', nome: 'A', origem: 'LIVRE', meses: [] },
      periodosDoAno('TRIMESTRAL', 2025)[1],
      true,
    );
    expect(e.meses).toEqual(['2025-04', '2025-05', '2025-06']);
    expect(periodoMarcado(e, periodosDoAno('SEMESTRAL', 2025)[0])).toBe(true);
    expect(periodoMarcado(e, periodosDoAno('MENSAL', 2025)[6])).toBe(false);
    expect(marcarPeriodo(e, periodosDoAno('MENSAL', 2025)[4], false).meses).toEqual(['2025-04', '2025-06']);
  });

  it('meses entre datas, inclusive na virada do ano', () => {
    expect(mesesEntre('2024-11-15', '2025-02-01')).toEqual(['2024-11', '2024-12', '2025-01', '2025-02']);
    expect(
      mesesDaEtapaRevisao({ iniciadaEm: '2025-05-10T00:00:00Z', concluidaEm: null }, new Date('2025-07-20')),
    ).toEqual(['2025-05', '2025-06', '2025-07']);
    expect(mesesDaEtapaRevisao({ iniciadaEm: null, concluidaEm: null })).toEqual([]);
  });

  it('rascunho inicial usa o período do projeto; preencher pelas datas das revisões', () => {
    const d = cronogramaInicial({ dataInicio: '2023-03-01', dataFim: '2027-03-31', etapasRevisao: [] });
    expect([d.anoInicio, d.anoFim, d.granularidade]).toEqual([2023, 2027, 'TRIMESTRAL']);
    const comEtapa = {
      ...d,
      etapas: [{ id: 'x', nome: 'Busca', origem: 'REVISAO' as const, revisaoEtapaId: 're1', meses: [] }],
    };
    const r = preencherPelasDatas(comEtapa, etapasRevisao);
    expect(r.preenchidas).toBe(1);
    expect(r.dados.etapas[0].meses).toEqual(['2024-10', '2024-11']);
  });

  it('anos, ordem e limpeza para salvar', () => {
    const d: DadosCronograma = {
      granularidade: 'MENSAL',
      anoInicio: 2024,
      anoFim: 2025,
      etapas: [
        { id: 'a', nome: ' A ', origem: 'LIVRE', meses: ['2024-01', '2026-01', '2024-01'] },
        { id: 'b', nome: '  ', origem: 'LIVRE', meses: [] },
      ],
    };
    expect(marcacoesForaDosAnos(d, 2025, 2025)).toBe(3);
    expect(paraSalvar(d).etapas).toEqual([{ id: 'a', nome: 'A', origem: 'LIVRE', meses: ['2024-01'] }]);
    expect(moverEtapa(d, 'b', -1).etapas.map((e) => e.id)).toEqual(['b', 'a']);
    expect(completarCronograma({ granularidade: 'XX' as never, anoInicio: 2020, anoFim: 2021 }).granularidade).toBe(
      'TRIMESTRAL',
    );
  });
});

describe('tela do cronograma', () => {
  beforeEach(limpar);
  it('adiciona etapas, marca períodos com clique, Shift + clique e teclado, e salva sozinho', async () => {
    montar(<Cronograma />);
    const nova = await screen.findByLabelText('Etapa da pesquisa ou outra etapa');
    await userEvent.type(nova, 'Qualificação{Enter}');
    // etapa da revisão
    await userEvent.selectOptions(screen.getByLabelText('Etapa das revisões do projeto'), 're1');

    const celula = (nome: string, desc: RegExp) =>
      screen.getByRole('button', { name: new RegExp(`^${nome}: ${desc.source}`) });
    const t1 = celula('Qualificação', /1º trimestre de 2024/);
    expect(t1).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(t1);
    expect(t1).toHaveAttribute('aria-pressed', 'true');

    // Shift + clique preenche do 1º ao 4º trimestre
    const user = userEvent.setup();
    await user.keyboard('{Shift>}');
    await user.click(celula('Qualificação', /4º trimestre de 2024/));
    await user.keyboard('{/Shift}');
    expect(celula('Qualificação', /3º trimestre de 2024/)).toHaveAttribute('aria-pressed', 'true');

    // teclado: Enter alterna e as setas movem o foco
    const busca = celula('Busca', /1º trimestre de 2025/);
    busca.focus();
    fireEvent.keyDown(busca, { key: 'ArrowRight' });
    expect(celula('Busca', /2º trimestre de 2025/)).toHaveFocus();
    fireEvent.click(celula('Busca', /2º trimestre de 2025/), { detail: 0 });
    expect(celula('Busca', /2º trimestre de 2025/)).toHaveAttribute('aria-pressed', 'true');

    await waitFor(() => expect(put).toHaveBeenCalled(), { timeout: 3000 });
    const corpo = put.mock.calls.at(-1)![1] as { dados: DadosCronograma };
    expect(corpo.dados.etapas.map((e) => e.nome)).toEqual(['Qualificação', 'Busca']);
    expect(corpo.dados.etapas[0].meses).toHaveLength(12);
    expect(corpo.dados.etapas[1]).toMatchObject({
      origem: 'REVISAO',
      revisaoEtapaId: 're1',
      meses: ['2025-04', '2025-05', '2025-06'],
    });
    expect(await screen.findByText('Salvo')).toBeInTheDocument();
  });

  it('troca a granularidade sem perder as marcações e imprime só o cronograma', async () => {
    salvo = {
      granularidade: 'TRIMESTRAL',
      anoInicio: 2024,
      anoFim: 2025,
      etapas: [{ id: 'a', nome: 'Defesa', origem: 'PESQUISA', meses: ['2025-11'] }],
    };
    montar(<Cronograma />);
    await userEvent.click(await screen.findByLabelText('Mensal'));
    expect(screen.getByRole('button', { name: /^Defesa: novembro de 2025/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Defesa: outubro de 2025/ })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByLabelText('Semestral'));
    expect(screen.getByRole('button', { name: /^Defesa: 2º semestre de 2025/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('nov/2025')).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Imprimir o cronograma' })).getByRole('button', { name: /PDF/ }),
    );
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/projetos/p1/relatorio/gerar', {
        formato: 'pdf',
        opcoes: { secoes: ['cronograma'], capa: false, orientacoes: false },
      }),
    );
    // salvou a mudança de granularidade antes de gerar
    expect(put).toHaveBeenCalledWith('/projetos/p1/cronograma', {
      dados: expect.objectContaining({ granularidade: 'SEMESTRAL' }),
    });
    expect(await screen.findByRole('link', { name: /Abrir PDF/ })).toBeInTheDocument();
  });
});

describe('relatório de pesquisa', () => {
  beforeEach(limpar);
  it('lógica: seções padrão, ordem do template, palavras e pendências', () => {
    expect(secoesPadrao(false)).not.toContain('resultados');
    expect(secoesPadrao(true)).toContain('checklist');
    expect(alternarSecao(['referencias', 'identificacao'], 'cronograma', true)).toEqual([
      'identificacao',
      'cronograma',
      'referencias',
    ]);
    expect(opcoesIniciais(undefined, ['resumo'])).toEqual({
      secoes: ['resumo'],
      norma: 'ABNT',
      orientacoes: true,
      capa: true,
    });
    expect(contarPalavras('um dois', ' três ')).toBe(3);
    expect(pendentes({ resumoAchados: 'x' }, ['resumo', 'analise'], [{ codigo: 'QA1' }])).toEqual([
      'Conclusão do resumo',
      'Síntese QA1',
    ]);
  });

  it('escreve os textos, vê a prévia e gera o PDF depois de salvar', async () => {
    montar(<Relatorio />);
    expect(await screen.findByText(/Integrativa · Em andamento · não sistemática/)).toBeInTheDocument();
    // revisão não sistemática: resultados e checklist fora por padrão
    expect(screen.getByLabelText('Resultados da identificação e seleção')).not.toBeChecked();
    expect(screen.getByLabelText('Cronograma')).toBeChecked();

    await userEvent.type(screen.getByLabelText('Principais achados'), 'Poucos estudos sobre surdez.');
    await userEvent.type(screen.getByLabelText(/Síntese QA1/), 'Convergem em legendas.');
    await userEvent.click(screen.getByLabelText('APA (7ª ed.)'));

    await userEvent.click(screen.getByRole('button', { name: /Ver prévia/ }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/projetos/p1/relatorio/previa',
        expect.objectContaining({
          revisaoId: 'r1',
          textos: expect.objectContaining({
            resumoAchados: 'Poucos estudos sobre surdez.',
            sintese: { QA1: 'Convergem em legendas.' },
          }),
        }),
      ),
    );
    expect(await screen.findByTitle('Prévia do relatório de pesquisa')).toHaveAttribute('srcdoc', '<p>prévia</p>');

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Gerar o relatório' })).getByRole('button', { name: /PDF/ }),
    );
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/projetos/p1/relatorio/gerar',
        expect.objectContaining({ revisaoId: 'r1', formato: 'pdf' }),
      ),
    );
    const salvo = put.mock.calls.at(-1)![1] as {
      dados: { textos: Record<string, { resumoAchados: string }>; opcoes: { norma: string } };
    };
    expect(salvo.dados.textos.r1.resumoAchados).toBe('Poucos estudos sobre surdez.');
    expect(salvo.dados.opcoes.norma).toBe('APA');
    // salvou antes de gerar (o worker lê o rascunho salvo)
    expect(put.mock.invocationCallOrder[0]).toBeLessThan(post.mock.invocationCallOrder.at(-1)!);
  });
});
