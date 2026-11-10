import type { Protocolo } from '../../lib/tipos';
import { METODOLOGIAS } from './protocoloPassos';

/**
 * Gerador de artigo: o que vem do projeto (fontes), o rascunho editável (dados) e a montagem do
 * documento final que a API converte em Word.
 */

// ------------------------------------------------------------------ fontes (GET /projetos/:id/artigo)

export type AutorFonte = {
  usuarioId: string;
  nome: string;
  email: string;
  orcid: string | null;
  instituicao: string | null;
  papel: string;
  principal: boolean;
};
export type FaseFonte = { nome: string; avaliados: number; selecionados: number; excluidos: number };
export type RevisaoFonte = {
  id: string;
  titulo: string;
  status: string;
  tipoNome: string;
  registroUrl: string | null;
  registroIdentificador: string | null;
  diretrizSigla: string | null;
  diretrizVersao: string | null;
  diagrama: {
    revisaoAnterior: number;
    bases: { rotulo: string; n: number }[];
    identificados: number;
    removidosAntes: { rotulo: string; n: number }[];
    fases: FaseFonte[];
    outrasFontes: { rotulo: string; n: number }[];
    totalOutrasFontes: number;
    incluidos: { novos: number; revisaoAnterior: number; integrados: number; total: number };
  };
  /** artigos incluídos ao final da revisão (selecionados nas buscas, de revisão anterior e integrados) */
  incluidos?: IncluidoFonte[];
};
export type IncluidoFonte = {
  origem: 'BUSCA' | 'REVISAO_ANTERIOR' | 'INTEGRADO' | 'MANUAL';
  titulo: string;
  autores: string | null;
  ano: number | null;
  periodico: string | null;
  doi: string | null;
  baseNome: string | null;
};
export type DocAnalisado = {
  id: string;
  analiseNome: string;
  documentoId: string;
  titulo: string;
  autores: string | null;
  ano: number | null;
  resumoAssunto: string;
  teorico: boolean;
};
export type DiscussaoFonte = {
  id: string;
  pontoPrincipal: string | null;
  discussao: string | null;
  analiseNome: string;
  titulo: string;
  autores: string | null;
  ano: number | null;
};
export type UsoIa = {
  provedor: string | null;
  modelo: string | null;
  modo: string | null;
  recursos: string[];
  vezes: number;
  primeiro: string;
  ultimo: string;
};
export type FontesArtigo = {
  projeto: { titulo: string; subtitulo: string | null; instituicao: string | null };
  autores: AutorFonte[];
  protocolo:
    | (Pick<
        Protocolo,
        | 'tema'
        | 'questaoPesquisa'
        | 'hipotese'
        | 'objetivoGeral'
        | 'justificativa'
        | 'metodologiaTipo'
        | 'metodologiaOutro'
        | 'metodologia'
        | 'resultadosEsperados'
        | 'outrasQuestoes'
        | 'objetivos'
        | 'palavrasChave'
        | 'criterios'
      > & {
        resumos: { idiomaId: number; idiomaCodigo: string; idiomaNome: string; texto: string }[];
        strings: { baseNome: string | null; expressao: string }[];
      })
    | null;
  revisoes: RevisaoFonte[];
  analisados: DocAnalisado[];
  discussoes: DiscussaoFonte[];
  referencias: { id: string; abnt: string | null; apa: string | null }[];
  usosIa: UsoIa[];
};

// ------------------------------------------------------------------ rascunho (dados salvos)

export const ITENS_INTRODUCAO = [
  ['tema', 'Tema da pesquisa'],
  ['questao', 'Questão de pesquisa'],
  ['outrasQuestoes', 'Outras questões'],
  ['objetivoGeral', 'Objetivo geral'],
  ['objetivos', 'Objetivos específicos'],
  ['hipotese', 'Hipótese'],
  ['justificativa', 'Justificativa'],
  ['metodo', 'Tipo de pesquisa (método)'],
  ['resultados', 'Resultados esperados'],
  ['estrutura', 'Parágrafo com a estrutura do artigo'],
] as const;
export type ItemIntroducao = (typeof ITENS_INTRODUCAO)[number][0];

export type DadosArtigo = {
  versao: 1;
  titulo: string;
  subtitulo: string;
  /** ordem dos autores e quem entra */
  autores: { usuarioId: string; incluir: boolean }[];
  resumoIdiomas: number[];
  palavrasChave: boolean;
  introducao: { texto: string; incluir: ItemIntroducao[] };
  fundamentacao: { texto: string; documentos: string[] };
  metodologia: { texto: string };
  revisao: { texto: string; tabela: boolean };
  analise: { texto: string; documentos: string[] };
  discussao: { texto: string; itens: string[] };
  conclusoes: { texto: string };
  agradecimentos: { texto: string; fundacoes: string; capes: boolean };
  declaracaoIa: { usou: boolean; texto: string };
  /** declarações pedidas pela Portaria CNPq nº 2.664/2026 (autoria, dados, divulgação prévia) */
  declaracoes: Record<ChaveDeclaracao, { incluir: boolean; texto: string }>;
  referencias: { estilo: 'ABNT' | 'APA'; excluidas: string[] };
  /** destacar em amarelo, no Word, os trechos montados pelo sistema que o autor ainda não reescreveu */
  destacarGerados: boolean;
};

export const DECLARACOES = [
  ['contribuicao', 'Contribuição dos autores', 'art. 9º, II, “p”, “q”, “r” e “s”'],
  ['conflito', 'Conflito de interesses', 'art. 5º, VII, e art. 9º, II'],
  ['dados', 'Disponibilidade dos dados', 'art. 9º, I, “g”, e II, “n”'],
  ['divulgacao', 'Divulgação prévia e originalidade', 'art. 9º, II, “e”, “f” e “u”'],
] as const;
export type ChaveDeclaracao = (typeof DECLARACOES)[number][0];

const vazio = (s?: string | null) => !s?.trim();
const limpar = (s?: string | null) => (s ?? '').trim().replace(/\s+$/g, '');

/** "Desenvolver um framework" → "desenvolver um framework" (mantém siglas: "DSR", "IA") */
export const minuscula = (s: string) => (/^[A-ZÀ-Ý][a-zà-ÿ]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
/** Garante ponto final */
export const comPonto = (s: string) => (/[.!?…:]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const semPonto = (s: string) => s.trim().replace(/[.;]+$/, '');

/** Lista em português: "a, b e c" */
export const listaPt = (l: string[]) => (l.length <= 1 ? (l[0] ?? '') : `${l.slice(0, -1).join(', ')} e ${l.at(-1)}`);

export function nomeMetodologia(p: FontesArtigo['protocolo']) {
  if (!p?.metodologiaTipo) return null;
  if (p.metodologiaTipo === 'OUTRA') return p.metodologiaOutro || null;
  return METODOLOGIAS.find(([c]) => c === p.metodologiaTipo)?.[1] ?? p.metodologiaTipo;
}

/** Citação autor-data (ABNT): "SILVA, João; SOUZA, Ana" + 2020 → "(SILVA; SOUZA, 2020)"; 3+ → "(SILVA et al., 2020)" */
export function citacao(autores: string | null, ano: number | null): string {
  const lista = autoresDe(autores);
  const data = ano ?? 's.d.';
  if (!lista.length) return `(AUTOR DESCONHECIDO, ${data})`;
  if (lista.length >= 3) return `(${lista[0]} et al., ${data})`;
  return `(${lista.join('; ')}, ${data})`;
}

/** Autor(es) e ano fora dos parênteses, para tabelas: "SILVA et al. (2020)" */
export function autoriaCurta(autores: string | null, ano: number | null): string {
  const lista = autoresDe(autores);
  const data = ano ?? 's.d.';
  if (!lista.length) return `Autor desconhecido (${data})`;
  return `${lista.length >= 3 ? `${lista[0]} et al.` : lista.join('; ')} (${data})`;
}

/** Sobrenomes em maiúsculas: "SILVA, João; SOUZA, Ana" ou, no estilo Vancouver, "Amadi D, Banda JM." */
function autoresDe(autores: string | null): string[] {
  const t = (autores ?? '').trim().replace(/\.$/, '');
  if (!t) return [];
  const vancouver = !t.includes(';') && t.split(/\s*,\s*/).every((p) => /^[\p{L}'’\- ]+\s[A-Z]{1,4}$/u.test(p.trim()));
  const lista = vancouver
    ? t.split(/\s*,\s*/)
    : t
        .split(/\s*;\s*|\s+and\s+|\s+e\s+(?=[A-ZÀ-Ý]{2,},)/)
        .map((a) => a.trim())
        .filter(Boolean);
  return lista.map((a) =>
    (vancouver ? a.replace(/\s[A-Z]{1,4}$/, '') : a.includes(',') ? a.split(',')[0] : (a.split(/\s+/).at(-1) ?? a))
      .trim()
      .toUpperCase(),
  );
}

const NOMES_PROVEDOR: Record<string, string> = {
  anthropic: 'Claude (Anthropic)',
  openai: 'ChatGPT (OpenAI)',
  google: 'Gemini (Google)',
  gemini: 'Gemini (Google)',
  mistral: 'Mistral AI',
  deepseek: 'DeepSeek',
};
export const nomeFerramenta = (u: UsoIa) =>
  [
    NOMES_PROVEDOR[(u.provedor ?? '').toLowerCase()] ?? u.provedor ?? 'Ferramenta de IA',
    u.modelo ? `modelo ${u.modelo}` : null,
  ]
    .filter(Boolean)
    .join(', ');
const dataBr = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

export const PORTARIA_CNPQ =
  'Portaria CNPq nº 2.664, de 6 de março de 2026 (Política de Integridade na Atividade Científica do CNPq)';

/**
 * Declaração de uso de IA Generativa conforme o art. 9º, inciso I, alíneas "c", "d" e "f" da Portaria
 * CNPq nº 2.664/2026: identificar a ferramenta e a finalidade, não apresentar conteúdo de IAG como de
 * autoria humana e assumir a responsabilidade integral pelo conteúdo. A portaria não traz um texto
 * oficial: este é um modelo que segue esses requisitos.
 */
export function modeloDeclaracaoIa(usou: boolean, usos: UsoIa[]): string {
  if (!usou)
    return [
      `Em conformidade com a ${PORTARIA_CNPQ}, art. 9º, inciso I, alínea "c", os autores declaram que não utilizaram ferramentas de Inteligência Artificial Generativa (IAG) em nenhuma fase deste trabalho (concepção, redação, análise de dados e submissão).`,
      'Os autores são integralmente responsáveis pelo texto, pelos dados e pelas análises aqui apresentados.',
    ].join('\n\n');
  const ferramentas = usos.length
    ? usos
        .map(
          (u) =>
            `- ${nomeFerramenta(u)}${u.modo === 'ASSISTENTE' ? ', por meio do assistente (chat)' : ''} – fase: ${listaPt([...new Set(u.recursos.map(faseDoUso))]) || '[informe a fase]'}; finalidade: ${u.recursos.length ? listaPt(u.recursos.map(minuscula)) : '[descreva a finalidade]'} (${u.vezes} uso(s) registrado(s) no Konektron Research entre ${dataBr(u.primeiro)} e ${dataBr(u.ultimo)}).`,
        )
        .join('\n')
    : '- [Ferramenta e versão] – fase: [concepção, redação, análise de dados ou submissão]; finalidade: [descreva].';
  return [
    `Em conformidade com a ${PORTARIA_CNPQ}, art. 9º, inciso I, alíneas "c", "d" e "f", os autores declaram que utilizaram ferramentas de Inteligência Artificial Generativa (IAG) neste trabalho, como apoio às etapas indicadas abaixo:`,
    ferramentas,
    '- [Acrescente aqui os usos de IAG feitos fora do Konektron Research, com a ferramenta, a fase e a finalidade.]',
    'As ferramentas foram empregadas de forma complementar e instrumental, sem delegação da autoria intelectual, da interpretação científica ou das decisões metodológicas. Os textos produzidos com apoio de IAG serviram apenas como base: foram reescritos pelos autores com suas próprias palavras, e as informações, as citações e as referências foram conferidas nas fontes originais. Nenhum conteúdo gerado por IAG é apresentado como de autoria humana.',
    'Os autores assumem integral responsabilidade pelo conteúdo final, inclusive por eventuais imprecisões ou plágios decorrentes do uso dessas ferramentas.',
  ].join('\n\n');
}

/** Fase da pesquisa de um uso de IA, pelo nome do recurso registrado (art. 9º, I, "c") */
export function faseDoUso(recurso: string): string {
  const r = recurso.toLowerCase();
  if (/tradu/.test(r)) return 'redação (tradução)';
  if (/resumo do assunto|análise|analise|resposta|matriz|discuss|síntese|sintese/.test(r)) return 'análise de dados';
  if (
    /protocolo|objetivo|quest|justificativa|hip[oó]tese|string|palavra|descritor|crit[eé]rio|tema|metodologia/.test(r)
  )
    return 'concepção';
  if (/complet|metadad|refer[eê]ncia|busca/.test(r)) return 'levantamento bibliográfico';
  return 'redação';
}

export const FRASE_CAPES =
  'O presente trabalho foi realizado com apoio da Coordenação de Aperfeiçoamento de Pessoal de Nível Superior – Brasil (CAPES) – Código de Financiamento 001.';
export const MARCADOR_FUNDACOES = '[FUNDAÇÕES]';

export function modeloAgradecimentos(instituicao: string | null) {
  return [
    `Os autores agradecem ao(à) ${MARCADOR_FUNDACOES} pelo apoio financeiro concedido a esta pesquisa.`,
    `Agradecem também ${instituicao ? `à ${instituicao}` : 'à instituição de vínculo'}, pela infraestrutura disponibilizada, e a todas as pessoas que contribuíram para a realização deste trabalho.`,
  ].join('\n\n');
}

/** Aviso: o que o sistema monta não é texto oficial nem de autoria do pesquisador */
export const AVISO_TEXTO_BASE =
  'Os textos montados pelo sistema (modelos, trechos do protocolo, descrições geradas, resumos do assunto e textos produzidos com IA) não são textos oficiais nem de sua autoria: servem apenas como base para revisão. Reescreva-os com suas palavras, confira dados e citações nas fontes originais e declare o uso de IA. Apresentar conteúdo gerado como se fosse de autoria humana é vedado (Portaria CNPq nº 2.664/2026, art. 9º, I, “d”).';

export function modeloDeclaracao(k: ChaveDeclaracao, f: FontesArtigo, nomesAutores: string[]): string {
  switch (k) {
    case 'contribuicao':
      return [
        'Contribuição de cada autor (descreva o que cada pessoa fez; inclua como autor só quem contribuiu de forma significativa):',
        (nomesAutores.length ? nomesAutores : ['[Autor]'])
          .map(
            (n) =>
              `- ${n}: [concepção, metodologia, busca e seleção dos estudos, análise dos dados, redação, revisão crítica, supervisão]`,
          )
          .join('\n'),
        'Todos os autores leram e aprovaram a versão final e respondem pela veracidade, integridade e confiabilidade do trabalho, cabendo ao primeiro autor e ao autor de correspondência a responsabilidade integral.',
      ].join('\n\n');
    case 'conflito':
      return 'Os autores declaram não haver conflito de interesses, pessoais, institucionais ou financeiros, que possa ter influenciado este trabalho. [Se houver, descreva-o aqui.]';
    case 'dados': {
      const registros = f.revisoes
        .map((r) => [r.registroIdentificador, r.registroUrl].filter(Boolean).join(' – '))
        .filter(Boolean);
      return registros.length
        ? `O protocolo, as estratégias de busca, as decisões de triagem e os dados extraídos estão depositados e disponíveis em: ${registros.join('; ')}.`
        : 'O protocolo, as estratégias de busca, as decisões de triagem e os dados extraídos estão disponíveis em [informe o repositório de dados confiável, com o identificador persistente (DOI)].';
    }
    case 'divulgacao':
      return 'Este trabalho é original, não foi publicado nem submetido, total ou parcialmente, a outro periódico, e não é fragmentação de resultados de outro estudo. [Informe aqui apresentações públicas, preprints ou versões anteriores, se houver.]';
  }
}

/** Quadro com os artigos incluídos na revisão (busca, revisão anterior e integrados) */
export function tabelaIncluidos(r: RevisaoFonte, numero: number, varias: boolean): Bloco[] {
  const l = r.incluidos ?? [];
  if (!l.length) return [];
  const ordem: Record<string, number> = { BUSCA: 0, MANUAL: 1, REVISAO_ANTERIOR: 2, INTEGRADO: 3 };
  const linhas = [...l]
    .sort(
      (a, b) =>
        (ordem[a.origem] ?? 9) - (ordem[b.origem] ?? 9) ||
        autoriaCurta(a.autores, a.ano).localeCompare(autoriaCurta(b.autores, b.ano), 'pt-BR'),
    )
    .map((x, i) => [
      String(i + 1),
      autoriaCurta(x.autores, x.ano),
      x.titulo,
      x.periodico ?? '—',
      x.origem === 'BUSCA'
        ? `Busca${x.baseNome ? ` – ${x.baseNome}` : ''}`
        : x.origem === 'REVISAO_ANTERIOR'
          ? 'Revisão anterior'
          : x.origem === 'INTEGRADO'
            ? 'Integrado (outras fontes)'
            : 'Inclusão manual',
    ]);
  const n = (o: string) => l.filter((x) => x.origem === o).length;
  const partes = [
    n('BUSCA') + n('MANUAL') ? `${n('BUSCA') + n('MANUAL')} selecionados nas buscas` : '',
    n('REVISAO_ANTERIOR') ? `${n('REVISAO_ANTERIOR')} de revisão anterior` : '',
    n('INTEGRADO') ? `${n('INTEGRADO')} integrados de outras fontes` : '',
  ].filter(Boolean);
  return [
    {
      tipo: 'p',
      texto: `O Quadro ${numero} apresenta os ${l.length} artigos incluídos${varias ? ` na revisão "${r.titulo}"` : ''}: ${listaPt(partes)}.`,
    },
    {
      tipo: 'tabela',
      texto: `Quadro ${numero} – Artigos incluídos${varias ? ` (${r.titulo})` : ''}: selecionados na revisão e integrados`,
      cabecalho: ['Nº', 'Autor(es) e ano', 'Título', 'Periódico', 'Origem'],
      linhas,
      fonte: `Fonte: elaborado pelos autores com os dados da revisão (${new Date().getFullYear()}).`,
    },
  ];
}

/** Metodologia do protocolo: tipo de pesquisa + descrição */
export function textoMetodologia(f: FontesArtigo): string {
  const p = f.protocolo;
  const tipo = nomeMetodologia(p);
  return [tipo ? `Trata-se de uma pesquisa do tipo ${tipo}.` : '', limpar(p?.metodologia)].filter(Boolean).join('\n\n');
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Descrição da revisão de literatura com os números do diagrama de fluxo */
export function textoRevisao(f: FontesArtigo): string {
  const p = f.protocolo;
  const paragrafos: string[] = [];
  for (const r of f.revisoes) {
    const d = r.diagrama;
    const abertura = [
      `Foi realizada uma revisão ${minuscula(r.tipoNome)} da literatura${f.revisoes.length > 1 ? ` (${r.titulo})` : ''}`,
      r.registroIdentificador || r.registroUrl
        ? `, registrada sob ${[r.registroIdentificador, r.registroUrl].filter(Boolean).join(' – ')}`
        : '',
      r.diretrizSigla
        ? `, relatada de acordo com a diretriz ${[r.diretrizSigla, r.diretrizVersao].filter(Boolean).join(' ')}`
        : '',
      '.',
    ].join('');
    const bases = d.bases.map((b) => b.rotulo);
    const busca = bases.length
      ? ` As buscas foram realizadas nas bases ${listaPt(bases)}, identificando ${d.identificados} registros (${d.bases.map((b) => `${b.rotulo}: ${b.n}`).join('; ')}).`
      : '';
    paragrafos.push(abertura + busca);

    if (paragrafos.length === 1 && p?.strings?.length) {
      // a mesma string em várias bases aparece uma vez, com as bases entre parênteses
      const porExpressao = new Map<string, string[]>();
      for (const s of p.strings) {
        const bases = porExpressao.get(s.expressao.trim()) ?? [];
        if (s.baseNome && !bases.includes(s.baseNome)) bases.push(s.baseNome);
        porExpressao.set(s.expressao.trim(), bases);
      }
      const lista = [...porExpressao].map(([e, b]) => `${e}${b.length ? ` (${listaPt(b)})` : ''}`);
      paragrafos.push(
        lista.length === 1
          ? `A string de busca utilizada foi: ${lista[0]}.`
          : `As strings de busca utilizadas foram: ${lista.join('; ')}.`,
      );
      const inclusao = (p.criterios ?? []).filter((c) => c.tipo === 'INCLUSAO');
      const exclusao = (p.criterios ?? []).filter((c) => c.tipo === 'EXCLUSAO');
      const crit = (l: typeof inclusao) =>
        l.map((c) => (c.descricao ? `${semPonto(c.nome)}: ${semPonto(c.descricao)}` : semPonto(c.nome))).join('; ');
      if (inclusao.length) paragrafos.push(`Os critérios de inclusão foram: ${crit(inclusao)}.`);
      if (exclusao.length) paragrafos.push(`Os critérios de exclusão foram: ${crit(exclusao)}.`);
    }

    const etapas: string[] = [];
    const removidos = d.removidosAntes.reduce((s, x) => s + x.n, 0);
    if (removidos)
      etapas.push(
        `Antes da triagem, ${removidos === 1 ? 'foi removido 1 registro' : `foram removidos ${removidos} registros`} (${d.removidosAntes.map((x) => `${minuscula(x.rotulo)}: ${x.n}`).join('; ')}).`,
      );
    for (const fase of d.fases)
      etapas.push(
        `Na etapa ${fase.nome}, ${plural(fase.avaliados, 'documento foi avaliado', 'documentos foram avaliados')}: ${plural(fase.selecionados, 'selecionado', 'selecionados')} e ${plural(fase.excluidos, 'excluído', 'excluídos')}.`,
      );
    const i = d.incluidos;
    if (i.total) {
      const extras = [
        i.revisaoAnterior ? `${i.revisaoAnterior} de revisão anterior` : '',
        i.integrados ? `${i.integrados} integrados de outras fontes` : '',
      ].filter(Boolean);
      etapas.push(
        `Ao final, foram incluídos ${i.novos} estudos provenientes das buscas${extras.length ? `, somados a ${listaPt(extras)}` : ''}, totalizando ${i.total} documentos analisados.`,
      );
    }
    if (etapas.length) paragrafos.push(etapas.join(' '));
  }
  return paragrafos.join('\n\n');
}

/** Rascunho inicial a partir do projeto (tudo marcado; textos prontos onde há dados) */
export function rascunhoInicial(f: FontesArtigo): DadosArtigo {
  return {
    versao: 1,
    titulo: f.projeto.titulo,
    subtitulo: f.projeto.subtitulo ?? '',
    // autor principal (quem criou o projeto) sempre primeiro
    autores: [...f.autores]
      .sort((a, b) => Number(b.principal) - Number(a.principal))
      .map((a) => ({ usuarioId: a.usuarioId, incluir: true })),
    resumoIdiomas: (f.protocolo?.resumos ?? []).map((r) => r.idiomaId),
    palavrasChave: true,
    introducao: { texto: '', incluir: ['questao', 'objetivoGeral', 'objetivos', 'justificativa', 'estrutura'] },
    fundamentacao: { texto: '', documentos: f.analisados.filter((d) => d.teorico).map((d) => d.id) },
    metodologia: { texto: textoMetodologia(f) },
    revisao: { texto: textoRevisao(f), tabela: true },
    analise: { texto: '', documentos: f.analisados.filter((d) => !d.teorico).map((d) => d.id) },
    discussao: { texto: '', itens: f.discussoes.map((d) => d.id) },
    conclusoes: { texto: '' },
    agradecimentos: { texto: modeloAgradecimentos(f.projeto.instituicao), fundacoes: '', capes: false },
    declaracaoIa: { usou: f.usosIa.length > 0, texto: modeloDeclaracaoIa(f.usosIa.length > 0, f.usosIa) },
    declaracoes: Object.fromEntries(
      DECLARACOES.map(([k]) => [
        k,
        {
          incluir: true,
          texto: modeloDeclaracao(
            k,
            f,
            ordenarAutores(f).map((a) => a.nome),
          ),
        },
      ]),
    ) as DadosArtigo['declaracoes'],
    referencias: { estilo: 'ABNT', excluidas: [] },
    destacarGerados: true,
  };
}

const ordenarAutores = (f: FontesArtigo) => [...f.autores].sort((a, b) => Number(b.principal) - Number(a.principal));

/** Junta um rascunho salvo com o inicial (campos novos ganham o valor padrão) */
export function completarRascunho(salvo: Partial<DadosArtigo> | null, f: FontesArtigo): DadosArtigo {
  const base = rascunhoInicial(f);
  if (!salvo) return base;
  const d = { ...base, ...salvo } as DadosArtigo;
  for (const k of [
    'introducao',
    'fundamentacao',
    'metodologia',
    'revisao',
    'analise',
    'discussao',
    'conclusoes',
    'agradecimentos',
    'declaracaoIa',
    'referencias',
  ] as const)
    (d as Record<string, unknown>)[k] = { ...base[k], ...(salvo[k] ?? {}) };
  d.declaracoes = Object.fromEntries(
    DECLARACOES.map(([k]) => [k, { ...base.declaracoes[k], ...(salvo.declaracoes?.[k] ?? {}) }]),
  ) as DadosArtigo['declaracoes'];
  // autores novos no projeto entram no fim; os que saíram do projeto somem
  const ids = new Set(f.autores.map((a) => a.usuarioId));
  const salvos = (salvo.autores ?? []).filter((a) => ids.has(a.usuarioId));
  d.autores = [...salvos, ...base.autores.filter((a) => !salvos.some((s) => s.usuarioId === a.usuarioId))];
  return d;
}

// ------------------------------------------------------------------ documento final (POST .../docx)

export type Bloco = {
  tipo: 'p' | 'h3' | 'lista' | 'citacao' | 'ref' | 'nota' | 'tabela';
  texto?: string;
  itens?: string[];
  cabecalho?: string[];
  linhas?: string[][];
  fonte?: string;
  /** montado pelo sistema e ainda não reescrito pelo autor: sai destacado no Word */
  gerado?: boolean;
};

const chaveBloco = (b: Bloco) => `${b.tipo}|${b.texto ?? ''}|${(b.itens ?? []).join('|')}`;
/** Marca como gerados os blocos iguais aos do texto que o sistema montou (o que o autor mudou deixa de ser) */
function marcarIguais(blocos: Bloco[], geradoPeloSistema: string): Bloco[] {
  const gerados = new Set(paragrafos(geradoPeloSistema).map(chaveBloco));
  return blocos.map((b) => (gerados.has(chaveBloco(b)) ? { ...b, gerado: true } : b));
}
const gerado = (b: Bloco): Bloco => ({ ...b, gerado: true });
export type DocumentoArtigo = {
  titulo: string;
  subtitulo?: string | null;
  autores: { nome: string; detalhes: string[] }[];
  secoes: { titulo: string; blocos: Bloco[] }[];
};

/** Texto livre → parágrafos (linha em branco separa; linhas com "- " viram lista) */
export function paragrafos(texto: string): Bloco[] {
  const out: Bloco[] = [];
  for (const trecho of texto.split(/\n\s*\n/)) {
    const t = trecho.trim();
    if (!t) continue;
    const linhas = t.split('\n').map((l) => l.trim());
    if (linhas.every((l) => /^[-•*]\s+/.test(l)))
      out.push({ tipo: 'lista', itens: linhas.map((l) => l.replace(/^[-•*]\s+/, '')) });
    else out.push({ tipo: 'p', texto: linhas.join(' ') });
  }
  return out;
}

const ROTULOS_RESUMO: Record<string, [string, string]> = {
  pt: ['Resumo', 'Palavras-chave'],
  en: ['Abstract', 'Keywords'],
  es: ['Resumen', 'Palabras clave'],
  fr: ['Résumé', 'Mots-clés'],
  it: ['Riassunto', 'Parole chiave'],
  de: ['Zusammenfassung', 'Schlüsselwörter'],
};
export const rotuloResumo = (codigo: string, nome: string): [string, string] =>
  ROTULOS_RESUMO[codigo.slice(0, 2).toLowerCase()] ?? [`Resumo (${nome})`, `Palavras-chave (${nome})`];

/** Blocos da introdução vindos do protocolo, na ordem de ITENS_INTRODUCAO */
export function blocosIntroducao(d: DadosArtigo, f: FontesArtigo, secoesComTexto: string[]): Bloco[] {
  const p = f.protocolo;
  const out: Bloco[] = [];
  const quer = (k: ItemIntroducao) => d.introducao.incluir.includes(k);
  if (quer('tema') && !vazio(p?.tema))
    out.push({ tipo: 'p', texto: `Esta pesquisa tem como tema: ${minuscula(comPonto(p!.tema!))}` });
  if (quer('questao') && !vazio(p?.questaoPesquisa))
    out.push({
      tipo: 'p',
      texto: `Diante desse contexto, este estudo busca responder à seguinte questão de pesquisa: ${semPonto(p!.questaoPesquisa!).replace(/\?*$/, '?')}`,
    });
  const outras = (p?.outrasQuestoes ?? []).map((q) => q.texto).filter((t) => !vazio(t));
  if (quer('outrasQuestoes') && outras.length) {
    out.push({ tipo: 'p', texto: 'De forma complementar, são investigadas as seguintes questões:' });
    out.push({ tipo: 'lista', itens: outras.map((q) => semPonto(q).replace(/\?*$/, '?')) });
  }
  if (quer('objetivoGeral') && !vazio(p?.objetivoGeral))
    out.push({ tipo: 'p', texto: `O objetivo geral é ${minuscula(comPonto(p!.objetivoGeral!))}` });
  const objetivos = (p?.objetivos ?? []).map((o) => o.texto).filter((t) => !vazio(t));
  if (quer('objetivos') && objetivos.length) {
    out.push({ tipo: 'p', texto: 'Como objetivos específicos, pretende-se:' });
    out.push({
      tipo: 'lista',
      itens: objetivos
        .map((o) => minuscula(semPonto(o)) + ';')
        .map((o, i, l) => (i === l.length - 1 ? o.replace(/;$/, '.') : o)),
    });
  }
  if (quer('hipotese') && !vazio(p?.hipotese))
    out.push({ tipo: 'p', texto: `Parte-se da seguinte hipótese: ${minuscula(comPonto(p!.hipotese!))}` });
  if (quer('justificativa') && !vazio(p?.justificativa)) out.push(...paragrafos(p!.justificativa!));
  const metodo = nomeMetodologia(p);
  if (quer('metodo') && metodo)
    out.push({ tipo: 'p', texto: `Quanto ao método, trata-se de uma pesquisa do tipo ${metodo}.` });
  if (quer('resultados') && !vazio(p?.resultadosEsperados))
    out.push({
      tipo: 'p',
      texto: `Como resultados esperados, destacam-se: ${minuscula(comPonto(p!.resultadosEsperados!))}`,
    });
  if (quer('estrutura') && secoesComTexto.length)
    out.push({
      tipo: 'p',
      texto: `Além desta introdução, o artigo está organizado da seguinte forma: ${listaPt(secoesComTexto.map((s, i) => `a seção ${i + 2} apresenta ${s}`))}.`,
    });
  return out;
}

const DESCRICAO_SECAO: Record<string, string> = {
  'Fundamentação teórica': 'a fundamentação teórica',
  Metodologia: 'a metodologia',
  'Revisão de literatura': 'a revisão de literatura',
  Análise: 'a análise dos estudos',
  Discussão: 'a discussão dos resultados',
  Conclusões: 'as conclusões',
};

/** Monta o documento final (só entram as seções com conteúdo; as do corpo são numeradas) */
export function montarDocumento(d: DadosArtigo, f: FontesArtigo): DocumentoArtigo {
  const autoresPorId = new Map(f.autores.map((a) => [a.usuarioId, a]));
  const autores = d.autores
    .filter((a) => a.incluir && autoresPorId.has(a.usuarioId))
    .map((a) => {
      const x = autoresPorId.get(a.usuarioId)!;
      return {
        nome: x.nome,
        detalhes: [
          x.instituicao,
          x.email ? `E-mail: ${x.email}` : null,
          x.orcid ? `ORCID: https://orcid.org/${x.orcid}` : null,
        ].filter((v): v is string => !!v),
      };
    });

  const secoes: DocumentoArtigo['secoes'] = [];
  // resumos (não numerados), cada um com as palavras-chave do idioma
  for (const r of (f.protocolo?.resumos ?? []).filter((r) => d.resumoIdiomas.includes(r.idiomaId))) {
    const [rotulo, rotuloPc] = rotuloResumo(r.idiomaCodigo, r.idiomaNome);
    const pcs = (f.protocolo?.palavrasChave ?? []).filter((k) => k.idiomaId === r.idiomaId).map((k) => k.termo.trim());
    const blocos: Bloco[] = paragrafos(r.texto);
    if (d.palavrasChave && pcs.length) blocos.push({ tipo: 'p', texto: `${rotuloPc}: ${pcs.join('; ')}.` });
    secoes.push({ titulo: rotulo, blocos });
  }

  const porId = new Map(f.analisados.map((x) => [x.id, x]));
  const docs = (ids: string[]) => ids.map((id) => porId.get(id)).filter((x): x is DocAnalisado => !!x);
  const corpo: { titulo: string; blocos: Bloco[] }[] = [
    {
      titulo: 'Fundamentação teórica',
      blocos: [
        ...paragrafos(d.fundamentacao.texto),
        ...docs(d.fundamentacao.documentos).map((x) =>
          gerado({ tipo: 'p', texto: `${semPonto(x.resumoAssunto)} ${citacao(x.autores, x.ano)}.` }),
        ),
      ],
    },
    { titulo: 'Metodologia', blocos: marcarIguais(paragrafos(d.metodologia.texto), textoMetodologia(f)) },
    {
      titulo: 'Revisão de literatura',
      blocos: [
        ...marcarIguais(paragrafos(d.revisao.texto), textoRevisao(f)),
        ...(d.revisao.tabela
          ? f.revisoes
              .flatMap((r, i) => tabelaIncluidos(r, i + 1, f.revisoes.length > 1))
              .map((b) => (b.tipo === 'p' ? gerado(b) : b))
          : []),
      ],
    },
    {
      titulo: 'Análise',
      blocos: [
        ...paragrafos(d.analise.texto),
        ...docs(d.analise.documentos).map((x) =>
          gerado({ tipo: 'p', texto: `${semPonto(x.resumoAssunto)} ${citacao(x.autores, x.ano)}.` }),
        ),
      ],
    },
    {
      titulo: 'Discussão',
      blocos: [
        ...paragrafos(d.discussao.texto),
        ...f.discussoes
          .filter((x) => d.discussao.itens.includes(x.id))
          .map((x) => ({
            tipo: 'p' as const,
            gerado: true,
            texto: [
              x.pontoPrincipal ? comPonto(x.pontoPrincipal) : '',
              x.discussao ? semPonto(x.discussao) : '',
              citacao(x.autores, x.ano),
            ]
              .filter(Boolean)
              .join(' ')
              .concat('.'),
          })),
      ],
    },
    { titulo: 'Conclusões', blocos: paragrafos(d.conclusoes.texto) },
  ].filter((s) => s.blocos.length);

  const intro: Bloco[] = [
    ...paragrafos(d.introducao.texto),
    ...blocosIntroducao(
      d,
      f,
      corpo.map((s) => DESCRICAO_SECAO[s.titulo] ?? minuscula(s.titulo)),
    ).map(gerado),
  ];
  const numeradas = [...(intro.length ? [{ titulo: 'Introdução', blocos: intro }] : []), ...corpo];
  numeradas.forEach((s, i) => secoes.push({ titulo: `${i + 1} ${s.titulo}`, blocos: s.blocos }));

  // agradecimentos: troca o marcador pelas fundações informadas e acrescenta a frase da CAPES
  const fundacoes = d.agradecimentos.fundacoes.trim();
  const trocar = (t: string) => t.split(MARCADOR_FUNDACOES).join(fundacoes || MARCADOR_FUNDACOES);
  const agradecimentos = [
    ...marcarIguais(paragrafos(trocar(d.agradecimentos.texto)), trocar(modeloAgradecimentos(f.projeto.instituicao))),
    ...(d.agradecimentos.capes ? [{ tipo: 'p' as const, texto: FRASE_CAPES }] : []),
  ];
  if (agradecimentos.length) secoes.push({ titulo: 'Agradecimentos', blocos: agradecimentos });
  // declarações da Portaria CNPq nº 2.664/2026
  const nomes = autores.map((a) => a.nome);
  for (const [k, titulo] of DECLARACOES) {
    const x = d.declaracoes[k];
    if (!x.incluir) continue;
    const blocos = marcarIguais(paragrafos(x.texto), modeloDeclaracao(k, f, nomes));
    if (blocos.length) secoes.push({ titulo, blocos });
  }
  const declaracao = marcarIguais(paragrafos(d.declaracaoIa.texto), modeloDeclaracaoIa(d.declaracaoIa.usou, f.usosIa));
  if (declaracao.length) secoes.push({ titulo: 'Declaração de uso de Inteligência Artificial', blocos: declaracao });

  const refs = f.referencias
    .filter((r) => !d.referencias.excluidas.includes(r.id))
    .map((r) => (d.referencias.estilo === 'APA' ? r.apa || r.abnt : r.abnt || r.apa))
    .filter((t): t is string => !vazio(t))
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  if (refs.length)
    secoes.push({ titulo: 'Referências', blocos: refs.map((texto) => ({ tipo: 'ref' as const, texto })) });

  // sem destaque: tira a marca dos trechos gerados
  const final = d.destacarGerados
    ? secoes
    : secoes.map((x) => ({ ...x, blocos: x.blocos.map(({ gerado: _g, ...b }) => b) }));
  return { titulo: d.titulo.trim() || f.projeto.titulo, subtitulo: d.subtitulo.trim() || null, autores, secoes: final };
}
