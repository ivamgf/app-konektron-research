import {
  avaliar,
  ehFase1ou2,
  erroOrdemDasFases,
  expressoesDoProtocolo,
  lerExpressao,
  numeroDaFase,
  textoDoNo,
  textosDoDocumento,
  verificarTermos,
} from '../pages/revisao/termosBusca';
import { cosseno, faixaNota, perfilDoProtocolo, similaridades, termosDoTexto } from '../pages/revisao/similaridade';
import type { EtapaRevisao, Protocolo } from '../lib/tipos';

const pk = (termo: string, idiomaId: number | null) => ({ id: termo, termo, idiomaId });
const str = (expressao: string) => ({ id: expressao, baseDadosId: null, campo: 'TODOS' as const, expressao, ordem: 1 });
type ParaTermos = Pick<Protocolo, 'palavrasChave' | 'strings'>;

const STRING_DO_PROJETO =
  '(data analysis) AND (linked data) OR (natural disasters);(análisis de datos) AND (datos vinculados) OR (desastres naturales);(análise de dados) AND (dados interligados) OR (desastres naturais)';

describe('string de busca com AND e OR na triagem', () => {
  const ex = expressoesDoProtocolo({ palavrasChave: [], strings: [str(STRING_DO_PROJETO)] } as ParaTermos);

  it('separa as versões por idioma e lê A AND B OR C como A AND (B OR C)', () => {
    expect(ex).toHaveLength(3);
    expect(textoDoNo(ex[0].no)).toBe('data analysis AND (linked data OR natural disasters)');
  });

  it('atende com "data analysis" no título e no resumo e só "natural disasters" nas palavras-chave', () => {
    const r = verificarTermos(
      {
        titulo: 'Data analysis of flood records',
        resumo: 'We apply data analysis to municipal reports.',
        palavrasChave: 'floods; natural disasters',
      },
      ex,
    )!;
    expect(r.sugerido).toBe(true);
    expect(r.faltando).toEqual(['linked data']);
    expect(r.encontrados.find((e) => e.termo === 'data analysis')!.onde).toEqual(['titulo', 'resumo']);
    expect(r.encontrados.find((e) => e.termo === 'natural disasters')!.onde).toEqual(['palavrasChave']);
    expect(r.clausulas.map((c) => c.ok)).toEqual([true, true]);
  });

  it('não atende sem "data analysis", mesmo com linked data e natural disasters', () => {
    const r = verificarTermos({ titulo: 'Linked data for natural disasters', resumo: null, palavrasChave: null }, ex)!;
    expect(r.sugerido).toBe(false);
    expect(r.clausulas.find((c) => !c.ok)!.texto).toBe('data analysis');
  });

  it('a versão em outro idioma também vale', () => {
    const r = verificarTermos({ titulo: 'Análise de dados', resumo: null, palavrasChave: 'desastres naturais' }, ex)!;
    expect(r.sugerido).toBe(true);
  });

  it('lê aspas, parênteses, NOT, AND implícito e código de campo', () => {
    const no = lerExpressao('("ontology" OR "ontologies") AND ("water resources" OR hydrology) AND NOT "medicine"')!;
    expect(textoDoNo(no)).toBe('((ontology OR ontologies) AND (water resources OR hydrology)) NOT medicine');
    const t = (titulo: string) => avaliar(no, textosDoDocumento({ titulo, resumo: null, palavrasChave: null }));
    expect(t('Ontologies for hydrology')).toBe(true);
    expect(t('Ontologies for hydrology in medicine')).toBe(false);
    expect(t('Ontology only')).toBe(false);
    expect(textoDoNo(lerExpressao('TITLE-ABS-KEY("open data" ontolog*)')!)).toBe('open data AND ontolog*');
  });

  it('sem strings, liga as palavras-chave de cada idioma por AND', () => {
    const e = expressoesDoProtocolo({
      palavrasChave: [pk('ontologia', 1), pk('dados abertos', 1), pk('ontology', 2), pk('open data', 2)],
      strings: [],
    } as unknown as ParaTermos);
    expect(e.map((x) => x.texto)).toEqual(['"ontologia" AND "dados abertos"', '"ontology" AND "open data"']);
    expect(
      verificarTermos({ titulo: 'An ontology for open data', resumo: null, palavrasChave: null }, e)!.sugerido,
    ).toBe(true);
  });
});

describe('similaridade com o tema da pesquisa', () => {
  it('dá nota de 0 a 1, maior para o documento do assunto', () => {
    const perfil = perfilDoProtocolo({
      tema: 'Framework de análise de dados orientado por linked data para desastres naturais',
      questaoPesquisa: null,
      objetivoGeral: null,
      objetivos: [],
      palavrasChave: [pk('Linked Data', 2), pk('Natural Disasters', 2), pk('Data Analysis', 2)],
      strings: [],
      resumos: [],
    } as unknown as Protocolo);
    const docs = [
      {
        titulo: 'Linked data framework for natural disaster data analysis',
        resumo: 'Semantic integration of disaster records using linked data.',
        palavrasChave: 'linked data; disasters',
      },
      {
        titulo: 'Prevalence of parasitic infections in pregnancy',
        resumo: 'A cohort study of maternal outcomes.',
        palavrasChave: 'pregnancy',
      },
    ];
    const [a, b] = similaridades(docs, perfil);
    expect(a.nota).toBeGreaterThanOrEqual(0.7);
    expect(b.nota).toBeLessThan(0.3);
    for (const s of [a, b]) {
      expect(s.nota).toBeGreaterThanOrEqual(0);
      expect(s.nota).toBeLessThanOrEqual(1);
    }
    expect(faixaNota(a.nota)).toBe('alta');
    expect(faixaNota(b.nota)).toBe('baixa');
    expect(a.termosComuns).toContain('linked');
  });

  it('aceita o resumo ajustado em texto livre, sem contar os rótulos', () => {
    const [a] = similaridades([{ titulo: 'Tema', resumo: null, palavrasChave: null }], 'Tema: ontologias');
    expect(a.nota).toBe(0);
  });

  it('cosseno e radicais', () => {
    expect(cosseno(new Map([['x', 1]]), new Map([['x', 2]]))).toBeCloseTo(1);
    expect(cosseno(new Map([['x', 1]]), new Map([['y', 1]]))).toBe(0);
    expect(termosDoTexto('Ontologies and the ontology of 2024')).toEqual(['ontolo', 'ontolo']);
  });
});

describe('fases da triagem', () => {
  it('F1 vem antes de F2 e F2 antes de F3', () => {
    expect(numeroDaFase('Triagem F2/F3 (acesso)')).toBe(2);
    expect(erroOrdemDasFases([{ nome: 'Triagem F2' }, { nome: 'Triagem F1' }])).toMatch(/F1.*antes/);
    expect(erroOrdemDasFases([{ nome: 'Busca' }, { nome: 'Triagem F1' }, { nome: 'Triagem F2' }])).toBeNull();
  });

  it('a verificação vale nas etapas F1 e F2 pelo nome', () => {
    const e = (id: string, nome: string, ordem: number) =>
      ({ id, nome, ordem, categoria: 'TRIAGEM', exigeTriagem: true }) as EtapaRevisao;
    const etapas = [e('a', 'Triagem F2', 4), e('b', 'Triagem F1', 5), e('c', 'Elegibilidade F3', 6)];
    expect(ehFase1ou2(etapas[0], etapas)).toBe(true);
    expect(ehFase1ou2(etapas[1], etapas)).toBe(true);
    expect(ehFase1ou2(etapas[2], etapas)).toBe(false);
  });
});
