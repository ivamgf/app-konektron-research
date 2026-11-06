// Formatos devolvidos pela API (camelCase). Campos não usados pelo app ficam de fora.

export type PerfilGlobal = 'ADMIN' | 'USUARIO';
export type Papel = 'RESPONSAVEL' | 'COLABORADOR' | 'ORIENTADOR' | 'LEITOR';

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  instituicao: string | null;
  orcid: string | null;
  perfilGlobal: PerfilGlobal;
  preferencias: { tema?: 'claro' | 'escuro' | 'sistema'; idiomaReferencias?: 'NBR' | 'APA' } | null;
  ativo: boolean;
  emailVerificadoEm: string | null;
  criadoEm: string;
};

export type Pagina<T> = { itens: T[]; page: number; pageSize: number; total: number };

export type Projeto = {
  id: string;
  titulo: string;
  area: string | null;
  instituicao: string | null;
  programa: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  status: 'ATIVO' | 'ARQUIVADO';
  excluidoEm: string | null;
  atualizadoEm: string;
  papel?: Papel | 'ADMIN';
  protocoloStatus?: StatusProtocolo;
  protocoloPasso?: number;
  revisoes?: number;
  protocolo?: { id: string; status: StatusProtocolo; versaoAtual: number; passoAtual: number };
};

export type StatusProtocolo = 'RASCUNHO' | 'CONCLUIDO' | 'APROVADO' | 'DEVOLVIDO';

export type ItemTexto = { id: string; texto: string; ordem: number };
export type PalavraChave = {
  id: string;
  termo: string;
  idiomaId: number | null;
  idiomaCodigo?: string | null;
  ordem: number;
};
export type Descritor = {
  id: string;
  termo: string;
  vocabulario: 'DECS' | 'MESH' | 'LIVRE';
  codigo: string | null;
  ordem: number;
};
export type StringBusca = {
  id: string;
  baseDadosId: string | null;
  baseNome?: string | null;
  campo: CampoBusca;
  expressao: string;
  ordem: number;
};
export type CampoBusca = 'TITULO' | 'RESUMO' | 'PALAVRAS_CHAVE' | 'TODOS';
export type QuestaoAnalise = { id: string; codigo: string; enunciado: string; ordem: number; ativo: boolean };
export type Criterio = {
  id: string;
  tipo: 'INCLUSAO' | 'EXCLUSAO';
  nome: string;
  descricao: string | null;
  ordem: number;
};
export type Pendencia = { campo: string; passo: number; mensagem: string };

export type Protocolo = {
  id: string;
  projetoId: string;
  status: StatusProtocolo;
  versaoAtual: number;
  passoAtual: number;
  tema: string | null;
  questaoPesquisa: string | null;
  hipotese: string | null;
  objetivoGeral: string | null;
  justificativa: string | null;
  parecer: string | null;
  aprovadoEm: string | null;
  concluidoEm: string | null;
  outrasQuestoes: ItemTexto[];
  objetivos: ItemTexto[];
  palavrasChave: PalavraChave[];
  descritores: Descritor[];
  strings: StringBusca[];
  questoes: QuestaoAnalise[];
  criterios: Criterio[];
  pendencias?: Pendencia[];
};

export type VersaoProtocolo = {
  id: string;
  versao: number;
  justificativa: string | null;
  pdfArquivoId: string | null;
  criadoEm: string;
  criadoPorNome: string | null;
};

export type CategoriaEtapa =
  | 'PROTOCOLO'
  | 'BUSCA'
  | 'DEDUPLICACAO'
  | 'TRIAGEM'
  | 'INCLUSAO'
  | 'ANALISE'
  | 'SINTESE'
  | 'DISCUSSAO'
  | 'CHECKLIST'
  | 'LIVRE';
export type MotivoExclusao = 'CRITERIO' | 'DUPLICADO' | 'SEM_ACESSO' | 'OUTRO';

export type TipoRevisao = {
  id: string;
  nome: string;
  descricao: string | null;
  tipoPaiId: string | null;
  sistematica: boolean;
  sistematicaEfetiva?: boolean;
  projetoId: string | null;
  ativo: boolean;
  totalEtapas?: number;
  etapas?: EtapaModelo[];
  aviso?: string | null;
};
export type EtapaModelo = {
  id: string;
  tipoRevisaoId: string;
  ordem: number;
  nome: string;
  descricao: string | null;
  categoria: CategoriaEtapa;
  exigeTriagem: boolean;
  permiteExclusao: boolean;
  motivosSugeridos: MotivoExclusao[] | null;
};

export type StatusEtapa = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'DISPENSADA';
export type ContagensEtapa = {
  total: number;
  selecionados: number;
  excluidos: number;
  conflitos: number;
  semDecisao: number;
};
export type EtapaRevisao = {
  id: string;
  revisaoId: string;
  ordem: number;
  nome: string;
  categoria: CategoriaEtapa;
  exigeTriagem: boolean;
  permiteExclusao: boolean;
  status: StatusEtapa;
  justificativaDispensa: string | null;
  iniciadaEm: string | null;
  concluidaEm: string | null;
  contagens?: ContagensEtapa;
};

export type Revisao = {
  id: string;
  projetoId: string;
  titulo: string;
  tipoRevisaoId: string;
  tipoNome: string;
  diretrizRelatoId: string | null;
  diretrizNome?: string | null;
  diretrizSigla?: string | null;
  diretrizVersao?: string | null;
  diretrizUrl?: string | null;
  doisRevisores: boolean;
  status: 'PLANEJADA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';
  etapaAtualId: string | null;
  etapaAtualNome?: string | null;
  sistematica?: boolean;
  etapas?: EtapaRevisao[];
};

export type Busca = {
  id: string;
  revisaoId: string;
  baseDadosId: string;
  baseNome: string;
  stringBuscaId: string | null;
  expressaoUsada: string;
  campo: CampoBusca;
  filtros: string | null;
  dataBusca: string;
  qtdRetornada: number;
  statusImportacao: 'SEM_ARQUIVO' | 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDA' | 'ERRO';
  qtdImportada: number;
  qtdDuplicados: number;
  qtdErros: number;
  logImportacao: unknown;
};

export type DocumentoResumo = {
  id: string;
  titulo: string;
  autores: string | null;
  ano: number | null;
  periodico: string | null;
  doi: string | null;
  citacoes?: number | null;
  arquivoId: string | null;
};
export type Documento = DocumentoResumo & {
  resumo: string | null;
  palavrasChave: string | null;
  fatorImpacto: number | null;
  idiomaId: number | null;
  tipoDocumentoId: number | null;
  baseDadosId: string | null;
  link: string | null;
  refNbr: string | null;
  refApa: string | null;
  temas?: { id: string; nome: string }[];
  revisoes?: { id: string; revisaoId: string; revisaoTitulo: string; situacao: string; origem: string }[];
};

export type DocumentoDaRevisao = {
  id: string;
  documentoId: string;
  origem: 'BUSCA' | 'REVISAO_ANTERIOR' | 'INTEGRADO' | 'MANUAL';
  situacao: 'EM_TRIAGEM' | 'INCLUIDO' | 'EXCLUIDO';
  duplicadoDeId: string | null;
  titulo: string;
  autores: string | null;
  ano: number | null;
  doi: string | null;
  baseNome: string | null;
  categoriaNome: string | null;
};

export type DocumentoTriagem = {
  revisaoDocumentoId: string;
  documentoId: string;
  origem: string;
  titulo: string;
  autores: string | null;
  resumo: string | null;
  palavrasChave: string | null;
  ano: number | null;
  periodico: string | null;
  doi: string | null;
  link: string | null;
  arquivoId: string | null;
  baseNome: string | null;
  decisaoFinal: 'SELECIONADO' | 'EXCLUIDO' | null;
  motivo: MotivoExclusao | null;
  conflito: boolean | null;
  minhaDecisao: 'SELECIONADO' | 'EXCLUIDO' | null;
  meuMotivo: MotivoExclusao | null;
};

export type Analise = {
  id: string;
  projetoId: string;
  nome: string;
  descricao: string | null;
  tipoRevisaoId: string;
  tipoNome: string;
  revisaoId: string | null;
  revisaoTitulo?: string | null;
  fonte: 'INCLUIDOS_REVISAO' | 'INTEGRADOS' | 'REFERENCIAL_TEORICO' | 'SELECAO_MANUAL';
  status: 'ABERTA' | 'CONCLUIDA';
  documentos?: number;
  concluidos?: number;
  questoes?: { id: string; codigo: string; enunciado: string; ordem: number }[];
};
export type Progresso = 'NAO_INICIADO' | 'PARCIAL' | 'CONCLUIDO';
export type DocumentoDaAnalise = {
  id: string;
  documentoId: string;
  ordem: number;
  progresso: Progresso;
  titulo: string;
  autores: string | null;
  ano: number | null;
  arquivoId: string | null;
};
export type ItemMatriz = {
  id: string;
  ordem: number;
  citacao: string | null;
  textoOriginal: string | null;
  textoParafraseado: string | null;
  pagina: string | null;
};
export type ItemDiscussao = { id: string; ordem: number; pontoPrincipal: string | null; discussao: string | null };
export type AnaliseDocumentoDetalhe = {
  id: string;
  analiseId: string;
  documentoId: string;
  progresso: Progresso;
  consideracoes: string | null;
  observacoes: string | null;
  documento: Documento;
  respostas: { questaoAnaliseId: string; texto: string | null }[];
  matriz: ItemMatriz[];
  discussao: ItemDiscussao[];
};

export type Tarefa = {
  id: number;
  fila: string;
  status: 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDA' | 'ERRO';
  erro?: string;
  resultado?: { url?: string; arquivo?: { nomeOriginal: string }; [k: string]: unknown };
};

export type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  dados: any;
  lidaEm: string | null;
  criadoEm: string;
};

export type BaseDados = { id: string; nome: string; sigla: string | null; url: string | null; ativo: boolean };
export type Idioma = { id: number; codigo: string; nome: string };
export type TipoDocumento = { id: number; nome: string };
export type Diretriz = {
  id: string;
  nome: string;
  sigla: string;
  versao: string | null;
  urlOficial: string | null;
  checklistModeloId: string | null;
  ativo: boolean;
};
export type ChecklistModelo = { id: string; nome: string; descricao: string | null; padrao: boolean; ativo: boolean };
export type ItemChecklistModelo = { id: string; codigo: string; secao: string; descricao: string; ordem: number };
export type ItemChecklistRevisao = {
  id: string;
  codigo: string;
  secao: string;
  descricao: string;
  ordem: number;
  situacao: 'ND' | 'REALIZADO' | 'PENDENTE' | 'NAO_REALIZADO';
  localRelato: string | null;
};
export type Tema = { id: string; nome: string };
