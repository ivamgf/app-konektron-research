/** Relatório de pesquisa (template Konektron): seções, textos do pesquisador e opções de impressão */

export const SECOES = [
  'identificacao',
  'resumo',
  'introducao',
  'metodo',
  'cronograma',
  'resultados',
  'caracterizacao',
  'analise',
  'sintese',
  'checklist',
  'consideracoes',
  'referencias',
  'apendiceA',
  'apendiceB',
  'apendiceC',
  'apendiceD',
] as const;
export type Secao = (typeof SECOES)[number];

export const NOME_SECAO: Record<Secao, string> = {
  identificacao: 'Identificação do projeto',
  resumo: 'Resumo',
  introducao: 'Introdução',
  metodo: 'Método',
  cronograma: 'Cronograma',
  resultados: 'Resultados da identificação e seleção',
  caracterizacao: 'Caracterização dos estudos incluídos',
  analise: 'Análise dos estudos',
  sintese: 'Matriz de síntese e discussão',
  checklist: 'Checklist de relato',
  consideracoes: 'Considerações finais',
  referencias: 'Referências',
  apendiceA: 'Apêndice — Strings de busca planejadas',
  apendiceB: 'Apêndice — Histórico do protocolo',
  apendiceC: 'Apêndice — Estudos excluídos na leitura completa',
  apendiceD: 'Apêndice — Trilha de auditoria',
};

/** O que cada seção traz do banco (ajuda ao lado da caixa de seleção) */
export const ORIGEM_SECAO: Record<Secao, string> = {
  identificacao: 'Projeto, revisão, protocolo e equipe (membros com convite aceito)',
  resumo: 'Objetivo geral, bases, datas e números das buscas, incluídos e palavras-chave em português',
  introducao: 'Tema, justificativa, questões, hipótese e objetivos do protocolo',
  metodo: 'Metodologia, tipo de revisão e diretriz, etapas, termos, buscas, critérios e questões de análise',
  cronograma: 'Aba Cronograma do projeto',
  resultados: 'Registros por base, painel de etapas, exclusões por critério e fluxograma',
  caracterizacao:
    'Estudos incluídos com tipo, idioma, categoria e origem; distribuição por ano, categoria, tema e base',
  analise: 'Respostas por questão, progresso e considerações das análises ligadas à revisão',
  sintese: 'Matriz de síntese e pontos de discussão das análises',
  checklist: 'Itens do checklist de relato da revisão',
  consideracoes: 'Limitações montadas a partir da busca, do acesso, da seleção e do protocolo',
  referencias: 'Incluídos e documentos citados na matriz de síntese (ABNT ou APA)',
  apendiceA: 'Strings do protocolo sem busca executada na revisão',
  apendiceB: 'Versões do protocolo, aprovação e parecer',
  apendiceC: 'Excluídos na última etapa de triagem, com motivo e observação',
  apendiceD: 'Conclusões, alterações e impressões registradas na auditoria',
};

export type Textos = {
  resumoAchados?: string;
  resumoConclusao?: string;
  introducao?: string;
  metodoSintese?: string;
  distribuicao?: string;
  sintese?: Record<string, string>;
  discussaoFechamento?: string;
  consideracoes?: string;
  limitacoes?: string;
  trabalhosFuturos?: string;
};
export type CampoTexto = Exclude<keyof Textos, 'sintese'>;

export type Opcoes = { secoes: Secao[]; norma: 'ABNT' | 'APA'; orientacoes: boolean; capa: boolean };
export type Rascunho = { revisaoId?: string | null; opcoes?: Partial<Opcoes>; textos?: Record<string, Textos> };

/** Campos de texto livre de cada seção, com a orientação do template */
export const CAMPOS: { campo: CampoTexto; secao: Secao; rotulo: string; orientacao: string; linhas?: number }[] = [
  {
    campo: 'resumoAchados',
    secao: 'resumo',
    rotulo: 'Principais achados',
    orientacao:
      'Redija por último. O resumo inteiro deve ter até 250 palavras, com objetivo, método, fontes, número de estudos incluídos e principais achados (CG02).',
  },
  {
    campo: 'resumoConclusao',
    secao: 'resumo',
    rotulo: 'Conclusão do resumo',
    orientacao: 'Síntese da resposta à questão de pesquisa.',
    linhas: 2,
  },
  {
    campo: 'introducao',
    secao: 'introducao',
    rotulo: 'Estado do conhecimento e lacuna',
    orientacao: 'Complete a justificativa com o estado atual do conhecimento e a lacuna que a revisão cobre (CG03).',
  },
  {
    campo: 'metodoSintese',
    secao: 'metodo',
    rotulo: 'Método de síntese e avaliação de qualidade',
    orientacao:
      'Descreva o método de síntese (narrativa, temática, estatística) e, se houver, a avaliação de qualidade dos estudos (CG11–CG12).',
  },
  {
    campo: 'distribuicao',
    secao: 'caracterizacao',
    rotulo: 'Comentário sobre a distribuição',
    orientacao:
      'Comente o perfil dos estudos (concentração temporal, idiomas, tipos de publicação) em até três frases (CG16).',
    linhas: 3,
  },
  {
    campo: 'discussaoFechamento',
    secao: 'sintese',
    rotulo: 'Fechamento da discussão',
    orientacao:
      'Interpretação frente a outras evidências (CG19), limitações das evidências e do processo (CG20) e implicações para prática e pesquisa (CG21).',
  },
  {
    campo: 'consideracoes',
    secao: 'consideracoes',
    rotulo: 'Resposta à questão de pesquisa',
    orientacao: 'Responda diretamente à questão de pesquisa e diga se a hipótese foi sustentada.',
  },
  {
    campo: 'limitacoes',
    secao: 'consideracoes',
    rotulo: 'Outras limitações',
    orientacao: 'As limitações da busca, do acesso, da seleção e do protocolo já vêm do projeto. Acrescente outras.',
    linhas: 3,
  },
  {
    campo: 'trabalhosFuturos',
    secao: 'consideracoes',
    rotulo: 'Trabalhos futuros',
    orientacao: 'Liste lacunas identificadas na síntese que justificam novas pesquisas.',
    linhas: 3,
  },
];

export const ORIENTACAO_SINTESE =
  'Sintetize as respostas dos estudos, apontando convergências, divergências e frequência dos achados.';

/** Seções padrão: em revisão não sistemática a seleção em fases e o checklist ficam de fora; auditoria é opcional */
export const secoesPadrao = (sistematica: boolean): Secao[] =>
  SECOES.filter((s) => s !== 'apendiceD' && (sistematica || (s !== 'resultados' && s !== 'checklist')));

export const opcoesIniciais = (salvas: Partial<Opcoes> | undefined, padrao: Secao[]): Opcoes => ({
  secoes: salvas?.secoes?.length ? SECOES.filter((s) => salvas.secoes!.includes(s)) : padrao,
  norma: salvas?.norma === 'APA' ? 'APA' : 'ABNT',
  orientacoes: salvas?.orientacoes ?? true,
  capa: salvas?.capa ?? true,
});

/** Liga ou desliga uma seção mantendo a ordem do template */
export const alternarSecao = (secoes: Secao[], s: Secao, incluir: boolean): Secao[] =>
  SECOES.filter((x) => (x === s ? incluir : secoes.includes(x)));

export const contarPalavras = (...textos: (string | undefined)[]) =>
  textos.reduce((n, t) => n + (t ?? '').split(/\s+/).filter(Boolean).length, 0);

/** Chave dos textos no rascunho: a revisão, ou "_" quando o projeto não tem revisão */
export const chaveTextos = (revisaoId: string | null | undefined) => revisaoId ?? '_';

/** Campos ainda em branco das seções incluídas (para o aviso antes de gerar) */
export function pendentes(t: Textos, secoes: Secao[], questoes: { codigo: string }[] = []): string[] {
  const vazio = (v?: string) => !(v ?? '').trim();
  const faltam = CAMPOS.filter((c) => secoes.includes(c.secao) && vazio(t[c.campo])).map((c) => c.rotulo);
  if (secoes.includes('analise'))
    for (const q of questoes) if (vazio(t.sintese?.[q.codigo])) faltam.push(`Síntese ${q.codigo}`);
  return faltam;
}
