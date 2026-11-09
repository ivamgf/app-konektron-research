import { describe, expect, it } from 'vitest';
import { corDaSituacao, data, ehDono, podeEditar, rotulo } from '../lib/formato';
import { caminhoDoTipo } from '../lib/consultas';
import { corpoDoPasso, passosPreenchidos, rascunhoDe, type Rascunho } from '../pages/projeto/protocoloPassos';
import { corpoDecisao, proximoPendente, teclaDeAtalho, validarExclusao } from '../pages/revisao/triagemLogica';
import { tabelaBaseFase } from '../pages/revisao/Painel';
import type { DocumentoTriagem, Protocolo, TipoRevisao } from '../lib/tipos';

describe('formato', () => {
  it('datas em dd/mm/aaaa no fuso de São Paulo', () => {
    expect(data('2026-11-05')).toBe('05/11/2026');
    expect(data('2026-11-06T01:30:00Z')).toBe('05/11/2026'); // 22:30 do dia 5 em Brasília
    expect(data(null)).toBe('—');
    expect(data('lixo')).toBe('—');
  });
  it('rótulos e cores de situação (ERS 8.3)', () => {
    expect(rotulo('SEM_ACESSO')).toBe('Sem acesso');
    expect(rotulo('DESCONHECIDO')).toBe('DESCONHECIDO');
    expect(corDaSituacao('SELECIONADO')).toBe('success');
    expect(corDaSituacao('EXCLUIDO')).toBe('danger');
    expect(corDaSituacao('PENDENTE')).toBe('warning');
    expect(corDaSituacao('ND')).toBe('secondary');
  });
  it('papéis que editam e que são donos', () => {
    expect(podeEditar('COLABORADOR')).toBe(true);
    expect(podeEditar('ORIENTADOR')).toBe(false);
    expect(ehDono('COLABORADOR')).toBe(false);
    expect(ehDono('ADMIN')).toBe(true);
  });
  it('caminho hierárquico do tipo de revisão', () => {
    const tipos = [
      { id: 's', nome: 'Sistemática', tipoPaiId: null },
      { id: 'i', nome: 'Integrativa', tipoPaiId: 's' },
    ] as TipoRevisao[];
    expect(caminhoDoTipo(tipos, 'i')).toBe('Sistemática › Integrativa');
  });
});

const vazio: Rascunho = rascunhoDe({
  tema: null,
  questaoPesquisa: null,
  hipotese: null,
  objetivoGeral: null,
  justificativa: null,
  outrasQuestoes: [],
  objetivos: [],
  palavrasChave: [],
  strings: [],
  descritores: [],
} as unknown as Protocolo);

describe('assistente do protocolo', () => {
  it('cada passo envia só os seus campos, sem itens em branco', () => {
    const r: Rascunho = {
      ...vazio,
      tema: ' Ontologias ',
      questaoPesquisa: '',
      objetivos: [{ texto: 'a' }, { texto: '  ' }],
      objetivoGeral: 'x',
    };
    expect(corpoDoPasso(1, r, 2)).toEqual({ passoAtual: 2, tema: ' Ontologias ', questaoPesquisa: null });
    expect(corpoDoPasso(4, r, 5)).toEqual({ passoAtual: 5, objetivoGeral: 'x', objetivos: [{ texto: 'a' }] });
    expect(corpoDoPasso(8, { ...vazio, descritores: [{ termo: 'Água', vocabulario: 'DECS', codigo: '' }] }, 9)).toEqual(
      {
        passoAtual: 9,
        descritores: [{ termo: 'Água', vocabulario: 'DECS', codigo: null }],
      },
    );
  });
  it('passo 9 envia a metodologia (o nome só quando é "Outra") e o 10 riscos, benefícios e resultados', () => {
    expect(
      corpoDoPasso(9, { ...vazio, metodologiaTipo: 'DSR', metodologiaOutro: 'x', metodologia: 'Ciclos' }, 10),
    ).toEqual({
      passoAtual: 10,
      metodologiaTipo: 'DSR',
      metodologiaOutro: null,
      metodologia: 'Ciclos',
    });
    expect(corpoDoPasso(9, { ...vazio, metodologiaTipo: 'OUTRA', metodologiaOutro: 'Netnografia' }, 10)).toMatchObject({
      metodologiaTipo: 'OUTRA',
      metodologiaOutro: 'Netnografia',
    });
    expect(corpoDoPasso(10, { ...vazio, resultadosEsperados: 'Um framework', riscos: '  ' }, 11)).toEqual({
      passoAtual: 11,
      riscos: null,
      beneficios: null,
      resultadosEsperados: 'Um framework',
    });
    expect(passosPreenchidos({ ...vazio, metodologiaTipo: 'OUTRA' })[9]).toBe(false);
    expect(passosPreenchidos({ ...vazio, resultadosEsperados: 'x' })[10]).toBe(true);
  });
  it('passo 11 começa com português, inglês e espanhol e envia só os resumos com texto', () => {
    expect(vazio.resumos.map((r) => r.idioma)).toEqual(['pt', 'en', 'es']);
    const r = {
      ...vazio,
      resumos: [
        { idioma: 'pt', texto: ' Resumo ' },
        { idioma: 'en', texto: '' },
        { idioma: 'fr', texto: 'Résumé' },
      ],
    };
    expect(corpoDoPasso(11, r, 12)).toEqual({
      passoAtual: 11, // a API aceita só 1 a 11
      resumos: [
        { idioma: 'pt', texto: 'Resumo' },
        { idioma: 'fr', texto: 'Résumé' },
      ],
    });
    expect(passosPreenchidos(vazio)[11]).toBe(false);
    expect(passosPreenchidos(r)[11]).toBe(true);
  });
  it('marca como preenchido o passo 6 só com 3 palavras-chave (RN02)', () => {
    const duas = {
      ...vazio,
      palavrasChave: [
        { termo: 'a', idiomaId: null },
        { termo: 'b', idiomaId: null },
      ],
    };
    expect(passosPreenchidos(duas)[6]).toBe(false);
    expect(
      passosPreenchidos({ ...duas, palavrasChave: [...duas.palavrasChave, { termo: 'c', idiomaId: null }] })[6],
    ).toBe(true);
  });
});

const doc = (id: string, extra: Partial<DocumentoTriagem> = {}) =>
  ({ revisaoDocumentoId: id, decisaoFinal: null, conflito: false, minhaDecisao: null, ...extra }) as DocumentoTriagem;

describe('triagem', () => {
  it('vai para o próximo pendente, dando a volta na lista', () => {
    const docs = [doc('a'), doc('b', { decisaoFinal: 'SELECIONADO' }), doc('c'), doc('d', { conflito: true })];
    expect(proximoPendente(docs, 'a', false)).toBe('c');
    expect(proximoPendente(docs, 'c', false)).toBe('a');
    expect(proximoPendente([doc('a')], 'a', false)).toBeNull();
  });
  it('com dois revisores, pendente é o que eu ainda não decidi', () => {
    const docs = [doc('a', { minhaDecisao: 'SELECIONADO' }), doc('b')];
    expect(proximoPendente(docs, 'a', true)).toBe('b');
  });
  it('RN10: exclusão exige motivo, critério ou texto', () => {
    expect(validarExclusao({ motivo: '', criterioId: '', observacao: '' })).toMatch(/motivo/);
    expect(validarExclusao({ motivo: 'CRITERIO', criterioId: '', observacao: '' })).toMatch(/critério/);
    expect(validarExclusao({ motivo: 'OUTRO', criterioId: '', observacao: ' ' })).toMatch(/Descreva/);
    expect(validarExclusao({ motivo: 'SEM_ACESSO', criterioId: '', observacao: '' })).toBeNull();
    expect(corpoDecisao('EXCLUIDO', { motivo: 'SEM_ACESSO', criterioId: 'x', observacao: '' })).toEqual({
      decisao: 'EXCLUIDO',
      motivo: 'SEM_ACESSO',
      criterioId: null,
      observacao: null,
    });
    expect(corpoDecisao('SELECIONADO')).toEqual({
      decisao: 'SELECIONADO',
      motivo: null,
      criterioId: null,
      observacao: null,
    });
  });
  it('atalhos S/E não disparam dentro de campos de texto', () => {
    const tecla = (key: string, alvo: HTMLElement) => {
      const ev = new KeyboardEvent('keydown', { key });
      Object.defineProperty(ev, 'target', { value: alvo });
      return teclaDeAtalho(ev);
    };
    expect(tecla('s', document.body)).toBe('s');
    expect(tecla('E', document.body)).toBe('e');
    expect(tecla('ArrowDown', document.body)).toBe('proximo');
    expect(tecla('s', document.createElement('textarea'))).toBeNull();
    expect(tecla('x', document.body)).toBeNull();
  });
});

describe('painel de etapas', () => {
  it('monta a tabela base × fase na ordem das etapas', () => {
    const linha = (base: string, id: string, ordem: number, sel: number) => ({
      revisaoEtapaId: id,
      etapaOrdem: ordem,
      etapaNome: 'F' + ordem,
      base,
      selecionados: sel,
      excluidos: 0,
      excluidosDuplicados: 0,
      excluidosSemAcesso: 0,
      excluidosCriterio: 0,
      conflitos: 0,
      semDecisao: 0,
    });
    const t = tabelaBaseFase([linha('Scopus', 'f2', 5, 3), linha('IEEE', 'f1', 4, 2), linha('Scopus', 'f1', 4, 4)]);
    expect(t.etapas.map((e) => e.nome)).toEqual(['F4', 'F5']);
    expect(t.bases).toEqual(['IEEE', 'Scopus']);
    expect(t.celula('Scopus', 'f1')?.selecionados).toBe(4);
    expect(t.celula('IEEE', 'f2')).toBeUndefined();
  });
});
