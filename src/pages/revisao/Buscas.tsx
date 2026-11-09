import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, del, get } from '../../lib/api';
import { useBases, useProtocolo } from '../../lib/consultas';
import { data, rotulo } from '../../lib/formato';
import type { Busca, CampoBusca, EtapaRevisao } from '../../lib/tipos';
import { BotaoConfirmar, Carregando, ErroAlerta, Situacao } from '../../components/ui';
import { useProjetoAtual } from '../projeto/ProjetoLayout';
import { BotaoCompletarDados } from '../../components/CompletarDados';
import { chaveEtapas } from './Revisao';

const hoje = () => new Date().toISOString().slice(0, 10);
const EXTENSOES = '.ris,.nbib,.bib,.bibtex,.csv,.txt,.xlsx';

/** RF24/RF25: registra a busca e, com arquivo, enfileira a importação (202) */
export function Buscas({ revisaoId, etapa }: { revisaoId: string; etapa: EtapaRevisao }) {
  const { projeto, edita } = useProjetoAtual();
  const qc = useQueryClient();
  const bases = useBases();
  const protocolo = useProtocolo(projeto.id);
  const chave = ['revisao', revisaoId, 'buscas'];
  const buscas = useQuery({
    queryKey: chave,
    queryFn: () => get<Busca[]>(`/revisoes/${revisaoId}/buscas`),
    // acompanha a importação no worker (diagrama S2: o app consulta a cada 3 s)
    refetchInterval: (q) =>
      q.state.data?.some((b) => b.statusImportacao === 'PENDENTE' || b.statusImportacao === 'PROCESSANDO')
        ? 3000
        : false,
  });
  const vazio = {
    baseDadosId: '',
    stringBuscaId: '',
    expressaoUsada: '',
    campo: 'TODOS' as CampoBusca,
    filtros: '',
    dataBusca: hoje(),
    qtdRetornada: '',
  };
  const [f, setF] = useState(vazio);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const registrar = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('baseDadosId', f.baseDadosId);
      if (f.stringBuscaId) fd.append('stringBuscaId', f.stringBuscaId);
      fd.append('expressaoUsada', f.expressaoUsada.trim());
      fd.append('campo', f.campo);
      if (f.filtros.trim()) fd.append('filtros', f.filtros.trim());
      fd.append('dataBusca', f.dataBusca);
      if (f.qtdRetornada) fd.append('qtdRetornada', f.qtdRetornada);
      if (arquivo) fd.append('arquivo', arquivo);
      return api.post(`/revisoes/${revisaoId}/buscas`, fd);
    },
    onSuccess: () => {
      setF(vazio);
      setArquivo(null);
      setInputKey((k) => k + 1);
      qc.invalidateQueries({ queryKey: chave });
      qc.invalidateQueries({ queryKey: chaveEtapas(revisaoId) });
    },
  });
  const usarString = (id: string) => {
    const s = protocolo.data?.strings.find((x) => x.id === id);
    setF({
      ...f,
      stringBuscaId: id,
      expressaoUsada: s?.expressao ?? f.expressaoUsada,
      campo: s?.campo ?? f.campo,
      baseDadosId: s?.baseDadosId ?? f.baseDadosId,
    });
  };
  const podeRegistrar = edita && etapa.status === 'EM_ANDAMENTO';

  return (
    <div className="row g-4">
      <div className={podeRegistrar ? 'col-xl-7' : 'col-12'}>
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <h4 className="h6 mb-0 me-auto">Buscas registradas</h4>
          {edita && !!buscas.data?.length && <BotaoCompletarDados url={`/revisoes/${revisaoId}/completar-metadados`} />}
        </div>
        {buscas.isLoading && <Carregando />}
        <ErroAlerta erro={buscas.error} />
        {buscas.data?.length === 0 && <p className="small text-secondary">Nenhuma busca registrada.</p>}
        <ul className="list-group">
          {buscas.data?.map((b) => (
            <li key={b.id} className="list-group-item">
              <div className="d-flex justify-content-between gap-2">
                <strong>{b.baseNome}</strong>
                <Situacao
                  valor={b.statusImportacao === 'CONCLUIDA' ? 'CONCLUIDA' : b.statusImportacao}
                  texto={`Importação: ${rotulo(b.statusImportacao)}`}
                />
              </div>
              <div className="k-mono small text-break my-1">{b.expressaoUsada}</div>
              <div className="small text-secondary">
                {data(b.dataBusca)} · {rotulo(b.campo)} · {b.qtdRetornada} artigo(s) consultado(s)
                {b.filtros && ` · filtros: ${b.filtros}`}
              </div>
              {b.statusImportacao !== 'SEM_ARQUIVO' && (
                <div className="small mt-1">
                  {(b.statusImportacao === 'PENDENTE' || b.statusImportacao === 'PROCESSANDO') && (
                    <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                  )}
                  Importados: {b.qtdImportada} · Duplicados: {b.qtdDuplicados} · Erros: {b.qtdErros}
                </div>
              )}
              {b.qtdErros > 0 && b.logImportacao != null && (
                <details className="small mt-1">
                  <summary>Ver registros com erro</summary>
                  <pre className="small bg-body-tertiary p-2 mb-0" style={{ maxHeight: 160 }}>
                    {JSON.stringify(b.logImportacao, null, 2)}
                  </pre>
                </details>
              )}
              {edita &&
                b.qtdImportada === 0 &&
                b.statusImportacao !== 'PENDENTE' &&
                b.statusImportacao !== 'PROCESSANDO' && (
                  <div className="text-end">
                    <BotaoConfirmar
                      titulo="Excluir busca"
                      pergunta="Excluir esta busca?"
                      aoConfirmar={async () => {
                        await del(`/buscas/${b.id}`);
                        await qc.invalidateQueries({ queryKey: chave });
                      }}
                    >
                      <i className="bi bi-trash" aria-hidden="true" />
                    </BotaoConfirmar>
                  </div>
                )}
            </li>
          ))}
        </ul>
      </div>

      {podeRegistrar && (
        <div className="col-xl-5">
          <div className="card bg-body-tertiary border-0">
            <div className="card-body">
              <h4 className="h6">Registrar busca</h4>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  registrar.mutate();
                }}
              >
                <ErroAlerta erro={registrar.error} />
                {registrar.isSuccess && (
                  <div className="alert alert-success small py-2">
                    {arquivo ? '' : 'Busca registrada.'} A importação aparece na lista assim que o worker terminar.
                  </div>
                )}
                {!!protocolo.data?.strings.length && (
                  <div className="mb-2">
                    <label htmlFor="b-string" className="form-label small">
                      String do protocolo
                    </label>
                    <select
                      id="b-string"
                      className="form-select form-select-sm"
                      value={f.stringBuscaId}
                      onChange={(e) => usarString(e.target.value)}
                    >
                      <option value="">Digitar a expressão</option>
                      {protocolo.data.strings.map((s) => (
                        <option key={s.id} value={s.id}>
                          {(s.baseNome ?? 'Todas as bases') + ': ' + s.expressao.slice(0, 60)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="mb-2">
                  <label htmlFor="b-base" className="form-label small">
                    Base de dados *
                  </label>
                  <select
                    id="b-base"
                    className="form-select form-select-sm"
                    value={f.baseDadosId}
                    onChange={(e) => setF({ ...f, baseDadosId: e.target.value })}
                  >
                    <option value="">Escolha…</option>
                    {bases.data
                      ?.filter((b) => b.ativo)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nome}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="mb-2">
                  <label htmlFor="b-expr" className="form-label small">
                    Expressão usada *
                  </label>
                  <textarea
                    id="b-expr"
                    className="form-control form-control-sm k-mono"
                    rows={3}
                    value={f.expressaoUsada}
                    onChange={(e) => setF({ ...f, expressaoUsada: e.target.value })}
                  />
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <label htmlFor="b-campo" className="form-label small">
                      Campo
                    </label>
                    <select
                      id="b-campo"
                      className="form-select form-select-sm"
                      value={f.campo}
                      onChange={(e) => setF({ ...f, campo: e.target.value as CampoBusca })}
                    >
                      {(['TODOS', 'TITULO', 'RESUMO', 'PALAVRAS_CHAVE'] as const).map((c) => (
                        <option key={c} value={c}>
                          {rotulo(c)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6">
                    <label htmlFor="b-data" className="form-label small">
                      Data
                    </label>
                    <input
                      id="b-data"
                      type="date"
                      className="form-control form-control-sm"
                      value={f.dataBusca}
                      onChange={(e) => setF({ ...f, dataBusca: e.target.value })}
                    />
                  </div>
                </div>
                <div className="mb-2">
                  <label htmlFor="b-filtros" className="form-label small">
                    Filtros aplicados
                  </label>
                  <input
                    id="b-filtros"
                    className="form-control form-control-sm"
                    placeholder="ex.: 2015–2026; artigos; inglês e português"
                    value={f.filtros}
                    onChange={(e) => setF({ ...f, filtros: e.target.value })}
                  />
                </div>
                <div className="mb-2">
                  <label htmlFor="b-qtd" className="form-label small">
                    Quantidade retornada (artigos consultados)
                  </label>
                  <input
                    id="b-qtd"
                    type="number"
                    min={0}
                    className="form-control form-control-sm"
                    value={f.qtdRetornada}
                    onChange={(e) => setF({ ...f, qtdRetornada: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="b-arq" className="form-label small">
                    Arquivo exportado da base (RIS, BibTeX, CSV ou XLSX)
                  </label>
                  <input
                    key={inputKey}
                    id="b-arq"
                    type="file"
                    accept={EXTENSOES}
                    className="form-control form-control-sm"
                    onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                  />
                  <div className="form-text">
                    Sem arquivo, cadastre os documentos manualmente na aba Documentos do projeto.
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!f.baseDadosId || !f.expressaoUsada.trim() || registrar.isPending}
                >
                  {registrar.isPending ? 'Enviando…' : arquivo ? 'Registrar e importar' : 'Registrar busca'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
