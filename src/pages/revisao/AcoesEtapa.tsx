import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, patch } from '../../lib/api';
import { chaves } from '../../lib/consultas';
import type { EtapaRevisao } from '../../lib/tipos';
import { ErroAlerta, Modal } from '../../components/ui';

export type RelatorioImportacao = {
  linhas: number;
  documentosCriados: number;
  documentosDoProjeto: number;
  documentosDaRevisao: number;
  decisoes: { selecionados: number; excluidos: number; semDecisao: number };
  selecionadosEmEtapasAnteriores: number;
  temasCriados?: number;
  outrasOrigens?: { revisaoAnterior: number; integrados: number };
  documentosRemovidos?: number;
  modo?: ModoImportacao;
  avisos: { linha: number; mensagem: string }[];
  totalAvisos: number;
  simulado: boolean;
};

const CATEGORIAS_IMPORTAVEIS = ['BUSCA', 'DEDUPLICACAO', 'TRIAGEM', 'INCLUSAO'];

/**
 * Como o arquivo convive com as importações anteriores (um CSV por base: ieee.csv, pubmed.csv, scielo.csv…)
 */
export type ModoImportacao = 'ADICIONAR' | 'SUBSTITUIR_BASES' | 'SUBSTITUIR';
export const MODOS_IMPORTACAO: { valor: ModoImportacao; titulo: string; texto: string; icone: string }[] = [
  {
    valor: 'ADICIONAR',
    titulo: 'Adicionar',
    icone: 'bi-plus-circle',
    texto:
      'Soma os documentos do arquivo aos já importados (ex.: subir o ieee.csv depois do pubmed.csv). Documentos que já estão na revisão têm a decisão atualizada; os demais ficam como estão.',
  },
  {
    valor: 'SUBSTITUIR_BASES',
    titulo: 'Substituir só as bases do arquivo',
    icone: 'bi-arrow-repeat',
    texto:
      'Corrige um arquivo enviado antes (ex.: um novo scielo.csv): o que veio antes das mesmas bases dá lugar ao conteúdo deste arquivo. As outras bases não mudam.',
  },
  {
    valor: 'SUBSTITUIR',
    titulo: 'Substituir tudo',
    icone: 'bi-exclamation-triangle',
    texto:
      'Reescreve tudo o que as importações CSV anteriores registraram nesta etapa, de todas as bases. Use para recomeçar a partir de um arquivo único.',
  },
];

/** Etapa de entrada: os documentos entram na revisão por ela (busca, deduplicação ou primeira triagem) */
export const etapaDeEntrada = (e: EtapaRevisao, etapas: EtapaRevisao[]) =>
  e.categoria !== 'INCLUSAO' && !etapas.some((x) => x.exigeTriagem && x.ordem < e.ordem);

/**
 * Etapas que recebem documentos por CSV (busca, deduplicação, triagem, inclusão ou livre com triagem).
 * Etapa pendente também aceita: a importação inicia a etapa e conclui as anteriores (triagem feita fora do app).
 */
export const aceitaImportacao = (e: EtapaRevisao) =>
  (CATEGORIAS_IMPORTAVEIS.includes(e.categoria) ||
    (e.categoria === 'LIVRE' && (e.exigeTriagem || e.permiteExclusao))) &&
  e.status !== 'DISPENSADA';

const MODELO =
  'titulo;autores;ano;doi;periodico;base;decisao;motivo;criterio;observacao\n' +
  '"Agile practices in research teams";"Silva, A.; Souza, B.";2023;10.1000/exemplo1;"Journal of Research";Scopus;SELECIONADO;;;\n' +
  '"Scrum for laboratories";"Lee, K.";2021;;"IEEE Software";IEEE Xplore;EXCLUIDO;CRITERIO;Idioma;"fora do idioma do protocolo"\n' +
  '"Kanban in academia";"Costa, C.";2020;;;SciELO;EXCLUIDO;SEM_ACESSO;;\n';

/**
 * Modelos das planilhas de revisão anterior e de integrados (mesmo formato das abas da planilha da
 * revisão integrativa): linha de título com o nome da aba e, abaixo, o cabeçalho.
 */
export const MODELOS_ORIGEM = {
  INTEGRADO: {
    arquivo: 'modelo_integrados.csv',
    texto:
      'Integrados,,,,,,,,,,,\n' +
      'N°,Título,Autores,Resumo,Palavras-chave,Ano,Periódico,Idioma,Link,Como citar,Citações,Base\n' +
      '1,"Identifiers for the twenty-first century: How to design, provision, and reuse persistent identifiers","McMurry, J. A., Juty, N., Blomberg, N. et al.","Diretrizes para a criação e resolução de identificadores persistentes (PIDs).","Persistent identifiers, Linked Data, FAIR data",2017,"PLOS Biology, 15(6), e2001414",Inglês,https://doi.org/10.1371/journal.pbio.2001414,"MCMURRY, J. A. et al. Identifiers for the twenty-first century: How to design, provision, and reuse persistent identifiers. PLOS Biology, v. 15, n. 6, e2001414, 2017.",~170+,\n',
  },
  REVISAO_ANTERIOR: {
    arquivo: 'modelo_revisao_anterior.csv',
    texto:
      'Referencial Teórico,,,,,,,,,,,\n' +
      'N°,Título,Autores,Resumo,Palavras-chave,Tipo,Ano,Link,Como citar,Referências,Citações,Base\n' +
      '1,"Doing Data Science: A Framework and Case Study","Sallie Ann Keller, Stephanie S. Shipp, Aaron D. Schroeder, Gizem Korkmaz","Today\'s data revolution is not just about big data.","data science framework, data discovery, ethics",Artigo,2020,,"(KELLER et al., 2020)","KELLER, Sallie Ann et al. Doing data science: A framework and case study. Harvard Data Science Review, v. 2, n. 1, 2020.",43,N/D\n',
  },
} as const;

function baixarTexto(texto: string, arquivo: string) {
  // BOM para o Excel abrir com acentos
  const url = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo;
  a.click();
  URL.revokeObjectURL(url);
}

export function baixarModeloCsv() {
  baixarTexto(MODELO, 'modelo_importacao_etapa.csv');
}

export function baixarModeloOrigem(origem: keyof typeof MODELOS_ORIGEM) {
  baixarTexto(MODELOS_ORIGEM[origem].texto, MODELOS_ORIGEM[origem].arquivo);
}

function textoDaEtapa(e: EtapaRevisao) {
  if (e.categoria === 'BUSCA') return 'Os documentos entram na revisão para triagem; a coluna de decisão é ignorada.';
  if (e.categoria === 'INCLUSAO')
    return 'Linhas sem decisão ou SELECIONADO contam como incluídas; as decisões ficam na última triagem antes da inclusão.';
  if (!e.exigeTriagem) return 'Etapa que só exclui: EXCLUIDO marca a exclusão (ex.: DUPLICADO); SELECIONADO desfaz.';
  return 'Cada linha grava a decisão desta etapa e conta como selecionada nas triagens anteriores ainda sem decisão.';
}

/** Importa um CSV de documentos com decisão para a etapa (primeiro simula, depois grava) */
export function ImportarCsvEtapa({
  revisaoId,
  etapa,
  aberto,
  aoFechar,
  origemInicial = '',
  entrada = true,
}: {
  revisaoId: string;
  etapa: EtapaRevisao;
  /** etapa por onde os documentos entram (F1): no modo substituir, os que não estão no arquivo saem da revisão */
  entrada?: boolean;
  aberto: boolean;
  aoFechar: () => void;
  /** já abre com a origem escolhida (cadastro de revisão anterior / integrados) */
  origemInicial?: '' | 'REVISAO_ANTERIOR' | 'INTEGRADO';
}) {
  const qc = useQueryClient();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [modo, setModo] = useState<ModoImportacao>('ADICIONAR');
  const pendente = etapa.status === 'PENDENTE';
  const [iniciar, setIniciar] = useState(true);
  const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null);
  // origem dos documentos: '' = busca (passam pela triagem) ou a coluna "Origem" do CSV
  const [origem, setOrigem] = useState<'' | 'REVISAO_ANTERIOR' | 'INTEGRADO'>(origemInicial);
  useEffect(() => {
    if (!aberto) {
      setArquivo(null);
      setModo('ADICIONAR');
      setOrigem(origemInicial);
      setIniciar(true);
      setRelatorio(null);
    }
  }, [aberto, origemInicial]);

  const enviar = useMutation({
    mutationFn: async (simular: boolean) => {
      const fd = new FormData();
      fd.append('arquivo', arquivo!);
      fd.append('modo', modo);
      fd.append('simular', String(simular));
      if (pendente) fd.append('iniciar', String(iniciar));
      if (origem) fd.append('origem', origem);
      return (
        await api.post<RelatorioImportacao>(`/revisoes/${revisaoId}/etapas/${etapa.id}/importar`, fd, {
          timeout: 120_000,
        })
      ).data;
    },
    onSuccess: async (r) => {
      setRelatorio(r);
      if (!r.simulado) await qc.invalidateQueries({ queryKey: ['revisao', revisaoId] });
    },
  });
  const trocar = (f: File | null) => {
    setArquivo(f);
    setRelatorio(null);
    enviar.reset();
  };
  const gravado = relatorio && !relatorio.simulado;

  return (
    <Modal
      titulo={`Importar CSV · ${etapa.ordem}. ${etapa.nome}`}
      aberto={aberto}
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        gravado ? (
          <button className="btn btn-primary" onClick={aoFechar}>
            Fechar
          </button>
        ) : (
          <>
            <button
              className="btn btn-outline-primary"
              disabled={!arquivo || enviar.isPending || (pendente && !iniciar)}
              onClick={() => enviar.mutate(true)}
            >
              Simular
            </button>
            <button
              className="btn btn-primary"
              disabled={!arquivo || enviar.isPending || !relatorio?.simulado}
              title={relatorio?.simulado ? undefined : 'Simule antes de importar'}
              onClick={() => enviar.mutate(false)}
            >
              {enviar.isPending && <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />}
              Importar
            </button>
          </>
        )
      }
    >
      <p className="small">
        Uma linha por documento. Colunas reconhecidas: <code>titulo</code> (obrigatória), <code>autores</code>,{' '}
        <code>ano</code>, <code>doi</code>, <code>periodico</code>, <code>resumo</code>, <code>base</code>,{' '}
        <code>decisao</code> (SELECIONADO/EXCLUIDO), <code>motivo</code> (CRITERIO, DUPLICADO, SEM_ACESSO, OUTRO),{' '}
        <code>criterio</code> (nome do critério de exclusão) e <code>observacao</code>. Também aceita o layout da
        planilha RIL: <code>Situação</code> (Selecionado/Excluído), <code>Base</code>, <code>Temas</code>,{' '}
        <code>Idioma</code>, <code>Citações</code>, <code>Ref-NBR</code> e <code>Ref-APA</code>. A coluna{' '}
        <code>Origem</code> (Busca, Revisão anterior ou Integrado) marca a origem de cada linha. Separador vírgula ou
        ponto e vírgula. Documentos já existentes são reconhecidos pelo DOI (também lido dentro do periódico ou do link)
        ou pelo título.
      </p>
      <p className="small text-secondary">{textoDaEtapa(etapa)}</p>
      <button type="button" className="btn btn-link btn-sm p-0 mb-3" onClick={baixarModeloCsv}>
        <i className="bi bi-filetype-csv me-1" aria-hidden="true" />
        Baixar modelo CSV
      </button>

      <div className="mb-2">
        <label htmlFor="csv-etapa" className="form-label">
          Arquivo CSV
        </label>
        <input
          id="csv-etapa"
          type="file"
          className="form-control"
          accept=".csv,.txt,.tsv,text/csv"
          disabled={!!gravado}
          onChange={(e) => trocar(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="mb-2">
        <label htmlFor="csv-origem" className="form-label">
          Origem dos documentos
        </label>
        <select
          id="csv-origem"
          className="form-select"
          value={origem}
          disabled={!!gravado}
          onChange={(e) => {
            setOrigem(e.target.value as typeof origem);
            setRelatorio(null);
          }}
        >
          <option value="">Busca em bases de dados — passam pela triagem (ou a coluna Origem do CSV)</option>
          <option value="REVISAO_ANTERIOR">Revisão anterior — entram direto como incluídos</option>
          <option value="INTEGRADO">Integrados de fonte secundária — entram direto como incluídos</option>
        </select>
        {origem ? (
          <div className="form-text">
            Documentos de revisão anterior e integrados não passam pela triagem e contam como incluídos no painel
            (RN13). Linhas com a coluna Origem preenchida seguem o valor da coluna. Formato da planilha:{' '}
            <button
              type="button"
              className="btn btn-link btn-sm p-0 align-baseline"
              onClick={() => baixarModeloOrigem(origem)}
            >
              baixar modelo de {origem === 'INTEGRADO' ? 'integrados' : 'revisão anterior'}
            </button>
            .
          </div>
        ) : (
          <div className="form-text">
            Planilhas com a linha de título “Integrados” ou “Referencial Teórico” (revisão anterior) são reconhecidas
            automaticamente.
          </div>
        )}
      </div>
      {pendente && (
        <div className="form-check mb-2">
          <input
            className="form-check-input"
            type="checkbox"
            id="csv-iniciar"
            checked={iniciar}
            disabled={!!gravado}
            onChange={(e) => {
              setIniciar(e.target.checked);
              setRelatorio(null);
            }}
          />
          <label className="form-check-label" htmlFor="csv-iniciar">
            Iniciar esta etapa e concluir as anteriores ainda abertas (a etapa está pendente; use quando a triagem foi
            feita fora do sistema)
          </label>
        </div>
      )}
      <fieldset className="mb-3">
        <legend className="form-label fs-6 mb-1">Este arquivo deve…</legend>
        <div className="d-grid gap-2">
          {MODOS_IMPORTACAO.map((m) => (
            <label
              key={m.valor}
              className={`k-opcao-modo border rounded p-2 d-flex gap-2 ${modo === m.valor ? 'border-primary bg-primary-subtle' : ''}`}
              htmlFor={`csv-modo-${m.valor}`}
            >
              <input
                className="form-check-input mt-1 flex-shrink-0"
                type="radio"
                name="csv-modo"
                id={`csv-modo-${m.valor}`}
                value={m.valor}
                checked={modo === m.valor}
                disabled={!!gravado}
                onChange={() => {
                  setModo(m.valor);
                  setRelatorio(null);
                }}
              />
              <span>
                <span className="fw-medium d-block">
                  <i className={`bi ${m.icone} me-1`} aria-hidden="true" />
                  {m.titulo}
                </span>
                <span className="small text-secondary">{m.texto}</span>
              </span>
            </label>
          ))}
        </div>
        {modo !== 'ADICIONAR' && (
          <div className="form-text">
            {entrada
              ? 'Documentos de importações CSV anteriores que não estiverem no arquivo saem da revisão (com as decisões deles). Simule para ver quantos.'
              : 'Nesta fase os documentos vêm da fase anterior e continuam na revisão: só as decisões desta etapa que não estiverem no arquivo ficam sem decisão.'}
          </div>
        )}
      </fieldset>

      <ErroAlerta erro={enviar.error} />
      {relatorio && <ResumoImportacao r={relatorio} />}
    </Modal>
  );
}

function ResumoImportacao({ r }: { r: RelatorioImportacao }) {
  return (
    <div className={`alert ${r.simulado ? 'alert-info' : 'alert-success'} small mb-0`} role="status">
      <div className="fw-medium mb-1">
        {r.simulado ? 'Simulação (nada foi gravado ainda)' : 'Importação concluída'}: {r.linhas} linha(s)
      </div>
      <ul className="mb-1">
        <li>
          {r.documentosDaRevisao} já estavam na revisão · {r.documentosDoProjeto} vieram de outro ponto do projeto ·{' '}
          {r.documentosCriados} documento(s) novo(s)
        </li>
        <li>
          Decisões: <span className="text-success">{r.decisoes.selecionados} selecionado(s)</span> ·{' '}
          <span className="text-danger">{r.decisoes.excluidos} excluído(s)</span> · {r.decisoes.semDecisao} sem decisão
        </li>
        {r.outrasOrigens && (
          <li>
            {r.outrasOrigens.revisaoAnterior} de revisão anterior · {r.outrasOrigens.integrados} integrado(s) — entram
            como incluídos, sem triagem
          </li>
        )}
        {!!r.documentosRemovidos && (
          <li className="text-danger">
            {r.documentosRemovidos} documento(s) de importações anteriores não estão no arquivo e saem da revisão
          </li>
        )}
        {!!r.temasCriados && <li>{r.temasCriados} tema(s) novo(s) no projeto (coluna Temas)</li>}
        {r.selecionadosEmEtapasAnteriores > 0 && (
          <li>{r.selecionadosEmEtapasAnteriores} marcação(ões) de selecionado em triagens anteriores</li>
        )}
      </ul>
      {r.totalAvisos > 0 && (
        <details>
          <summary>{r.totalAvisos} aviso(s)</summary>
          <ul className="mb-0">
            {r.avisos.map((a, i) => (
              <li key={i}>
                Linha {a.linha}: {a.mensagem}
              </li>
            ))}
            {r.totalAvisos > r.avisos.length && <li>… e mais {r.totalAvisos - r.avisos.length}</li>}
          </ul>
        </details>
      )}
    </div>
  );
}

// datetime-local (sem fuso) ↔ ISO
const paraCampo = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const paraIso = (v: string) => (v ? new Date(v).toISOString() : null);

/** Edita os dados da etapa em qualquer situação: nome, configuração, datas e justificativa da dispensa */
export function EditarEtapa({
  revisaoId,
  etapa,
  aberto,
  aoFechar,
}: {
  revisaoId: string;
  etapa: EtapaRevisao;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const qc = useQueryClient();
  const inicial = () => ({
    nome: etapa.nome,
    exigeTriagem: etapa.exigeTriagem,
    permiteExclusao: etapa.permiteExclusao,
    iniciadaEm: paraCampo(etapa.iniciadaEm),
    concluidaEm: paraCampo(etapa.concluidaEm),
    justificativaDispensa: etapa.justificativaDispensa ?? '',
  });
  const [f, setF] = useState(inicial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setF(inicial()), [aberto, etapa]);
  const salvar = useMutation({
    mutationFn: () => {
      const corpo: Record<string, unknown> = {};
      if (f.nome.trim() !== etapa.nome) corpo.nome = f.nome.trim();
      if (f.exigeTriagem !== etapa.exigeTriagem) corpo.exigeTriagem = f.exigeTriagem;
      if (f.permiteExclusao !== etapa.permiteExclusao) corpo.permiteExclusao = f.permiteExclusao;
      if (f.iniciadaEm !== paraCampo(etapa.iniciadaEm)) corpo.iniciadaEm = paraIso(f.iniciadaEm);
      if (f.concluidaEm !== paraCampo(etapa.concluidaEm)) corpo.concluidaEm = paraIso(f.concluidaEm);
      if (etapa.status === 'DISPENSADA' && f.justificativaDispensa.trim() !== (etapa.justificativaDispensa ?? ''))
        corpo.justificativaDispensa = f.justificativaDispensa.trim();
      return patch(`/revisoes/${revisaoId}/etapas/${etapa.id}`, corpo);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: chaves.revisao(revisaoId) }),
        qc.invalidateQueries({ queryKey: ['revisao', revisaoId] }),
      ]);
      aoFechar();
    },
  });
  const datasInvalidas = !!f.iniciadaEm && !!f.concluidaEm && f.concluidaEm < f.iniciadaEm;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal
      titulo={`Editar etapa · ${etapa.ordem}. ${etapa.nome}`}
      aberto={aberto}
      aoFechar={aoFechar}
      rodape={
        <button
          className="btn btn-primary"
          disabled={
            !f.nome.trim() ||
            datasInvalidas ||
            salvar.isPending ||
            (etapa.status === 'DISPENSADA' && f.justificativaDispensa.trim().length < 3)
          }
          onClick={() => salvar.mutate()}
        >
          Salvar
        </button>
      }
    >
      <ErroAlerta erro={salvar.error} />
      <div className="mb-3">
        <label htmlFor="etapa-nome" className="form-label">
          Nome
        </label>
        <input
          id="etapa-nome"
          className="form-control"
          maxLength={120}
          value={f.nome}
          onChange={(e) => set('nome', e.target.value)}
        />
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          type="checkbox"
          id="etapa-triagem"
          checked={f.exigeTriagem}
          onChange={(e) => set('exigeTriagem', e.target.checked)}
        />
        <label className="form-check-label" htmlFor="etapa-triagem">
          Exige triagem (decisão de selecionar ou excluir cada documento)
        </label>
      </div>
      <div className="form-check mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          id="etapa-exclusao"
          checked={f.permiteExclusao}
          onChange={(e) => set('permiteExclusao', e.target.checked)}
        />
        <label className="form-check-label" htmlFor="etapa-exclusao">
          Permite exclusão de documentos
        </label>
      </div>
      <div className="row g-2 mb-3">
        <div className="col-sm-6">
          <label htmlFor="etapa-inicio" className="form-label">
            Início
          </label>
          <input
            id="etapa-inicio"
            type="datetime-local"
            className="form-control"
            value={f.iniciadaEm}
            onChange={(e) => set('iniciadaEm', e.target.value)}
          />
        </div>
        <div className="col-sm-6">
          <label htmlFor="etapa-fim" className="form-label">
            Fim
          </label>
          <input
            id="etapa-fim"
            type="datetime-local"
            className={`form-control ${datasInvalidas ? 'is-invalid' : ''}`}
            value={f.concluidaEm}
            onChange={(e) => set('concluidaEm', e.target.value)}
          />
          {datasInvalidas && <div className="invalid-feedback">O fim não pode ser antes do início.</div>}
        </div>
      </div>
      {etapa.status === 'DISPENSADA' && (
        <div className="mb-2">
          <label htmlFor="etapa-just" className="form-label">
            Justificativa da dispensa
          </label>
          <textarea
            id="etapa-just"
            className="form-control"
            rows={3}
            value={f.justificativaDispensa}
            onChange={(e) => set('justificativaDispensa', e.target.value)}
          />
        </div>
      )}
      <p className="small text-secondary mb-0">
        As decisões dos documentos podem ser corrigidas na própria etapa (também depois de concluída) ou reimportando o
        CSV.
      </p>
    </Modal>
  );
}
