import {
  citacao,
  completarRascunho,
  FRASE_CAPES,
  minuscula,
  modeloDeclaracaoIa,
  montarDocumento,
  paragrafos,
  rascunhoInicial,
  textoRevisao,
  type FontesArtigo,
} from '../pages/projeto/artigoLogica';
import { ehSugeridoPorSimilaridade, faixaNota, LIMIAR_SUGESTAO } from '../pages/revisao/similaridade';

const fontes: FontesArtigo = {
  projeto: { titulo: 'Framework de Linked Data', subtitulo: 'um estudo de desastres naturais', instituicao: 'UFSC' },
  autores: [
    {
      usuarioId: 'u2',
      nome: 'Ana Souza',
      email: 'ana@x.br',
      orcid: null,
      instituicao: 'UFSC',
      papel: 'COLABORADOR',
      principal: false,
    },
    {
      usuarioId: 'u1',
      nome: 'Ivam Galvão',
      email: 'ivam@x.br',
      orcid: '0000-0002-0162-3221',
      instituicao: 'UFSC',
      papel: 'RESPONSAVEL',
      principal: true,
    },
  ],
  protocolo: {
    tema: 'Linked data para desastres naturais',
    questaoPesquisa: 'Como integrar dados de desastres com linked data',
    hipotese: null,
    objetivoGeral: 'Desenvolver um framework orientado por linked data.',
    justificativa: 'Os dados de desastres estão dispersos.',
    metodologiaTipo: 'DSR',
    metodologiaOutro: null,
    metodologia: 'Ciclos de projeto e avaliação.',
    resultadosEsperados: null,
    outrasQuestoes: [],
    objetivos: [
      { id: 'o1', texto: 'Mapear frameworks existentes.', ordem: 1 },
      { id: 'o2', texto: 'Modelar o framework', ordem: 2 },
    ],
    palavrasChave: [
      { id: 'k1', termo: 'Linked Data', idiomaId: 2, ordem: 1 },
      { id: 'k2', termo: 'Dados interligados', idiomaId: 1, ordem: 1 },
    ],
    criterios: [{ id: 'c1', tipo: 'INCLUSAO', nome: 'Período', descricao: '2015 a 2026', ordem: 1 }],
    resumos: [
      { idiomaId: 1, idiomaCodigo: 'pt', idiomaNome: 'Português', texto: 'Resumo em português.' },
      { idiomaId: 2, idiomaCodigo: 'en', idiomaNome: 'Inglês', texto: 'English abstract.' },
    ],
    strings: [{ baseNome: 'Scopus', expressao: '"linked data" AND "disaster*"' }],
  },
  revisoes: [
    {
      id: 'r1',
      titulo: 'Revisão',
      status: 'CONCLUIDA',
      tipoNome: 'Integrativa',
      registroUrl: null,
      registroIdentificador: null,
      diretrizSigla: 'PRISMA',
      diretrizVersao: '2020',
      diagrama: {
        revisaoAnterior: 0,
        bases: [{ rotulo: 'Scopus', n: 100 }],
        identificados: 100,
        removidosAntes: [{ rotulo: 'Registros duplicados', n: 10 }],
        fases: [
          { nome: 'Triagem F1 (título e resumo)', avaliados: 90, selecionados: 30, excluidos: 60 },
          { nome: 'Triagem F2', avaliados: 30, selecionados: 12, excluidos: 18 },
        ],
        outrasFontes: [],
        totalOutrasFontes: 0,
        incluidos: { novos: 12, revisaoAnterior: 3, integrados: 0, total: 15 },
      },
    },
  ],
  analisados: [
    {
      id: 'a1',
      analiseNome: 'Referencial',
      documentoId: 'd1',
      titulo: 'Teoria',
      autores: 'BERNERS-LEE, Tim; HENDLER, James; LASSILA, Ora',
      ano: 2001,
      resumoAssunto: 'Apresenta a web semântica.',
      teorico: true,
    },
    {
      id: 'a2',
      analiseNome: 'Incluídos',
      documentoId: 'd2',
      titulo: 'Estudo',
      autores: 'SILVA, João',
      ano: 2024,
      resumoAssunto: 'Propõe uma ontologia de desastres.',
      teorico: false,
    },
  ],
  discussoes: [
    {
      id: 'x1',
      pontoPrincipal: 'Interoperabilidade',
      discussao: 'Os estudos convergem',
      analiseNome: 'Incluídos',
      titulo: 'Estudo',
      autores: 'SILVA, João',
      ano: 2024,
    },
  ],
  referencias: [
    { id: 'f2', abnt: 'SILVA, J. Estudo. 2024.', apa: 'Silva, J. (2024). Estudo.' },
    { id: 'f1', abnt: 'BERNERS-LEE, T. et al. The semantic web. 2001.', apa: null },
  ],
  usosIa: [
    {
      provedor: 'anthropic',
      modelo: 'claude-opus-5-5',
      modo: 'API',
      recursos: ['Gerar: resumo do assunto'],
      vezes: 2,
      primeiro: '2026-11-01T10:00:00Z',
      ultimo: '2026-11-05T10:00:00Z',
    },
  ],
};

describe('gerador de artigo', () => {
  it('citação autor-data e textos auxiliares', () => {
    expect(citacao('SILVA, João; SOUZA, Ana', 2020)).toBe('(SILVA; SOUZA, 2020)');
    expect(citacao('BERNERS-LEE, Tim; HENDLER, James; LASSILA, Ora', 2001)).toBe('(BERNERS-LEE et al., 2001)');
    expect(citacao(null, null)).toBe('(AUTOR DESCONHECIDO, s.d.)');
    expect(minuscula('Desenvolver um framework')).toBe('desenvolver um framework');
    expect(minuscula('DSR em ciclos')).toBe('DSR em ciclos');
    expect(paragrafos('Um.\n\nDois\nainda.\n\n- a\n- b')).toEqual([
      { tipo: 'p', texto: 'Um.' },
      { tipo: 'p', texto: 'Dois ainda.' },
      { tipo: 'lista', itens: ['a', 'b'] },
    ]);
  });

  it('descreve a revisão com bases, strings, critérios e números de cada fase', () => {
    const t = textoRevisao(fontes);
    expect(t).toContain('revisão integrativa da literatura, relatada de acordo com a diretriz PRISMA 2020');
    expect(t).toContain('identificando 100 registros (Scopus: 100)');
    expect(t).toContain('"linked data" AND "disaster*" (Scopus)');
    expect(t).toContain('Período: 2015 a 2026');
    expect(t).toContain(
      'Na etapa Triagem F1 (título e resumo), 90 documentos foram avaliados: 30 selecionados e 60 excluídos.',
    );
    expect(t).toContain(
      'foram incluídos 12 estudos provenientes das buscas, somados a 3 de revisão anterior, totalizando 15',
    );
  });

  it('declaração de IA cita a Portaria CNPq 2.664/2026, a ferramenta e a finalidade', () => {
    const usou = modeloDeclaracaoIa(true, fontes.usosIa);
    expect(usou).toContain('Portaria CNPq nº 2.664, de 6 de março de 2026');
    expect(usou).toContain('Claude (Anthropic), modelo claude-opus-5-5');
    expect(usou).toContain('gerar: resumo do assunto');
    expect(usou).toContain('integral responsabilidade');
    expect(modeloDeclaracaoIa(false, [])).toContain('não utilizaram');
  });

  it('monta o artigo: autor principal primeiro, resumos, seções numeradas e referências em ordem', () => {
    const d = rascunhoInicial(fontes);
    d.introducao.texto = 'Os desastres naturais geram muitos dados.';
    d.conclusoes.texto = 'O framework atende ao objetivo.';
    d.agradecimentos.fundacoes = 'FAPESC';
    d.agradecimentos.capes = true;
    const doc = montarDocumento(d, fontes);
    expect(doc.titulo).toBe('Framework de Linked Data');
    expect(doc.subtitulo).toBe('um estudo de desastres naturais');
    expect(doc.autores[0].nome).toBe('Ivam Galvão');
    expect(doc.autores[0].detalhes).toEqual([
      'UFSC',
      'E-mail: ivam@x.br',
      'ORCID: https://orcid.org/0000-0002-0162-3221',
    ]);
    const titulos = doc.secoes.map((s) => s.titulo);
    expect(titulos).toEqual([
      'Resumo',
      'Abstract',
      '1 Introdução',
      '2 Fundamentação teórica',
      '3 Metodologia',
      '4 Revisão de literatura',
      '5 Análise',
      '6 Discussão',
      '7 Conclusões',
      'Agradecimentos',
      'Declaração de uso de Inteligência Artificial',
      'Referências',
    ]);
    const secao = (t: string) => doc.secoes.find((s) => s.titulo.endsWith(t))!;
    expect(secao('Resumo').blocos.at(-1)!.texto).toBe('Palavras-chave: Dados interligados.');
    expect(secao('Abstract').blocos.at(-1)!.texto).toBe('Keywords: Linked Data.');
    const intro = secao('Introdução').blocos;
    expect(intro[0].texto).toBe('Os desastres naturais geram muitos dados.');
    expect(
      intro.some((b) => b.texto?.includes('questão de pesquisa: Como integrar dados de desastres com linked data?')),
    ).toBe(true);
    expect(
      intro.some((b) => b.texto === 'O objetivo geral é desenvolver um framework orientado por linked data.'),
    ).toBe(true);
    expect(intro.find((b) => b.tipo === 'lista')!.itens).toEqual([
      'mapear frameworks existentes;',
      'modelar o framework.',
    ]);
    expect(intro.at(-1)!.texto).toContain('a seção 2 apresenta a fundamentação teórica');
    // fundamentação usa o resumo do assunto da análise (não o abstract) com a citação
    expect(secao('Fundamentação teórica').blocos[0].texto).toBe(
      'Apresenta a web semântica (BERNERS-LEE et al., 2001).',
    );
    expect(secao('Metodologia').blocos[0].texto).toBe(
      'Trata-se de uma pesquisa do tipo Design Science Research (DSR).',
    );
    expect(secao('Agradecimentos').blocos[0].texto).toContain('agradecem ao(à) FAPESC');
    expect(secao('Agradecimentos').blocos.at(-1)!.texto).toBe(FRASE_CAPES);
    expect(secao('Referências').blocos.map((b) => b.texto)).toEqual([
      'BERNERS-LEE, T. et al. The semantic web. 2001.',
      'SILVA, J. Estudo. 2024.',
    ]);
  });

  it('seções vazias não entram e a numeração se ajusta', () => {
    const d = rascunhoInicial({ ...fontes, revisoes: [], analisados: [], discussoes: [] });
    d.introducao.incluir = [];
    d.metodologia.texto = '';
    d.conclusoes.texto = 'Fim.';
    const titulos = montarDocumento(d, fontes).secoes.map((s) => s.titulo);
    expect(titulos.filter((t) => /^\d/.test(t))).toEqual(['1 Conclusões']);
  });

  it('rascunho salvo mantém o que o autor escreveu e acrescenta autores novos', () => {
    const d = completarRascunho(
      { conclusoes: { texto: 'Meu texto' }, autores: [{ usuarioId: 'u2', incluir: false }] },
      fontes,
    );
    expect(d.conclusoes.texto).toBe('Meu texto');
    expect(d.autores).toEqual([
      { usuarioId: 'u2', incluir: false },
      { usuarioId: 'u1', incluir: true },
    ]);
    expect(d.metodologia.texto).toContain('Design Science Research');
  });
});

describe('sugestão por similaridade', () => {
  it('só sugere com nota >= 0,7; 0,6 não é sugerido', () => {
    expect(LIMIAR_SUGESTAO).toBe(0.7);
    expect(ehSugeridoPorSimilaridade(0.7)).toBe(true);
    expect(ehSugeridoPorSimilaridade(0.6)).toBe(false);
    expect(faixaNota(0.6)).toBe('baixa');
    expect(faixaNota(0.85)).toBe('alta');
  });
});
