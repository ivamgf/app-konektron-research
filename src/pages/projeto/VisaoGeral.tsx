import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, patch, post } from '../../lib/api';
import { chaves, useRevisoes } from '../../lib/consultas';
import { data } from '../../lib/formato';
import type { Tema } from '../../lib/tipos';
import { Abas, BotaoConfirmar, ErroAlerta, Modal, Situacao } from '../../components/ui';
import { BotaoTarefa } from '../../components/BotaoTarefa';
import { FormProjeto, paraApi } from '../Projetos';
import { useProjetoAtual } from './ProjetoLayout';
import { TOTAL_PASSOS } from './protocoloPassos';

type ResultadoBusca = {
  documentos: { id: string; titulo: string; autores: string | null; ano: number | null }[];
  respostas: {
    id: string;
    texto: string;
    codigo: string;
    analiseId: string;
    analiseNome: string;
    documentoId: string;
  }[];
  citacoes: {
    id: string;
    citacao: string | null;
    textoParafraseado: string | null;
    analiseId: string;
    documentoId: string;
  }[];
};

export function VisaoGeral() {
  const { projeto: p, dono, edita } = useProjetoAtual();
  const qc = useQueryClient();
  const navegar = useNavigate();
  const [editando, setEditando] = useState(false);
  const revisoes = useRevisoes(p.id);
  const atualizar = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: chaves.projeto(p.id) }),
      qc.invalidateQueries({ queryKey: chaves.projetos }),
    ]);
  const arquivar = useMutation({
    mutationFn: () => patch(`/projetos/${p.id}`, { status: p.status === 'ATIVO' ? 'ARQUIVADO' : 'ATIVO' }),
    onSuccess: atualizar,
  });

  return (
    <div className="row g-4">
      <div className="col-lg-8">
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-start">
              <h2 className="h5">Dados do projeto</h2>
              {dono && (
                <button className="btn btn-outline-primary btn-sm" onClick={() => setEditando(true)}>
                  <i className="bi bi-pencil me-1" aria-hidden="true" />
                  Editar
                </button>
              )}
            </div>
            <dl className="row mb-0">
              <dt className="col-sm-3">Subtítulo</dt>
              <dd className="col-sm-9">{p.subtitulo || '—'}</dd>
              <dt className="col-sm-3">Área</dt>
              <dd className="col-sm-9">{p.area || '—'}</dd>
              <dt className="col-sm-3">Instituição</dt>
              <dd className="col-sm-9">{p.instituicao || '—'}</dd>
              <dt className="col-sm-3">Programa</dt>
              <dd className="col-sm-9">{p.programa || '—'}</dd>
              <dt className="col-sm-3">Período</dt>
              <dd className="col-sm-9">
                {data(p.dataInicio)} a {data(p.dataFim)}
              </dd>
            </dl>
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-md-6">
            <Link to="protocolo" className="card h-100 text-decoration-none text-reset">
              <div className="card-body">
                <div className="k-label text-secondary">Protocolo de pesquisa</div>
                <div className="d-flex align-items-center gap-2 mt-2">
                  <Situacao valor={p.protocolo?.status} />
                  <span className="small text-secondary">
                    {p.protocolo?.versaoAtual ? `versão ${p.protocolo.versaoAtual}` : 'sem versão concluída'} · passo{' '}
                    {p.protocolo?.passoAtual ?? 1} de {TOTAL_PASSOS}
                  </span>
                </div>
              </div>
            </Link>
          </div>
          <div className="col-md-6">
            <Link to="revisoes" className="card h-100 text-decoration-none text-reset">
              <div className="card-body">
                <div className="k-label text-secondary">Revisões de literatura</div>
                <div className="mt-2">
                  {revisoes.data?.length ? (
                    revisoes.data.slice(0, 3).map((r) => (
                      <div key={r.id} className="small text-truncate">
                        <Situacao valor={r.status} /> {r.titulo}
                        {r.etapaAtualNome && <span className="text-secondary"> · {r.etapaAtualNome}</span>}
                      </div>
                    ))
                  ) : (
                    <span className="small text-secondary">Nenhuma revisão criada.</span>
                  )}
                </div>
              </div>
            </Link>
          </div>
        </div>

        <BuscaGlobal projetoId={p.id} />
      </div>

      <div className="col-lg-4">
        <div className="card mb-4">
          <div className="card-body d-grid gap-2">
            <h2 className="h6 mb-1">Exportar</h2>
            <p className="small text-secondary mb-2">
              Projeto no layout da planilha modelo (Definições, Questões, Critérios, Etapas, Selecionados, Análise,
              Matriz-Síntese, Discussão).
            </p>
            <BotaoTarefa url={`/projetos/${p.id}/exportar`} corpo={{ formato: 'xlsx' }} textoPronto="Baixar XLSX">
              <i className="bi bi-file-earmark-spreadsheet me-1" aria-hidden="true" />
              Exportar XLSX
            </BotaoTarefa>
            <p className="small text-secondary mb-2 mt-2">
              PDF do projeto inteiro: protocolo de pesquisa, relatórios das revisões e análises. Para imprimir só o
              protocolo, use a página Protocolo.
            </p>
            <BotaoTarefa url={`/projetos/${p.id}/exportar`} corpo={{ formato: 'pdf' }} textoPronto="Abrir PDF">
              <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
              Imprimir projeto inteiro (PDF)
            </BotaoTarefa>
            <BotaoTarefa url={`/projetos/${p.id}/exportar`} corpo={{ formato: 'docx' }} textoPronto="Baixar DOCX">
              <i className="bi bi-file-earmark-word me-1" aria-hidden="true" />
              Projeto inteiro em Word (DOCX)
            </BotaoTarefa>
          </div>
        </div>

        <Temas projetoId={p.id} edita={edita} />

        {dono && (
          <div className="card border-danger-subtle">
            <div className="card-body d-grid gap-2">
              <h2 className="h6 mb-1">Gerenciar projeto</h2>
              <ErroAlerta erro={arquivar.error} />
              <button
                className="btn btn-outline-secondary"
                disabled={arquivar.isPending}
                onClick={() => arquivar.mutate()}
              >
                <i
                  className={`bi ${p.status === 'ATIVO' ? 'bi-archive' : 'bi-box-arrow-up'} me-1`}
                  aria-hidden="true"
                />
                {p.status === 'ATIVO' ? 'Arquivar' : 'Reativar'}
              </button>
              <BotaoConfirmar
                className="btn btn-outline-danger"
                pergunta="O projeto vai para a lixeira e pode ser restaurado em até 30 dias. Depois disso é removido com os arquivos."
                aoConfirmar={async () => {
                  await del(`/projetos/${p.id}`);
                  await qc.invalidateQueries({ queryKey: chaves.projetos });
                  navegar('/projetos');
                }}
              >
                <i className="bi bi-trash me-1" aria-hidden="true" />
                Mover para a lixeira
              </BotaoConfirmar>
            </div>
          </div>
        )}
      </div>

      <Modal titulo="Editar projeto" aberto={editando} aoFechar={() => setEditando(false)} tamanho="lg">
        <FormProjeto
          inicial={p}
          textoBotao="Salvar"
          aoSalvar={async (d) => {
            await patch(`/projetos/${p.id}`, paraApi(d));
            await atualizar();
            setEditando(false);
          }}
        />
      </Modal>
    </div>
  );
}

/** RF46: busca global (FULLTEXT) em documentos, respostas e citações */
function BuscaGlobal({ projetoId }: { projetoId: string }) {
  const [termo, setTermo] = useState('');
  const [busca, setBusca] = useState('');
  const r = useQuery({
    queryKey: ['projeto', projetoId, 'busca', busca],
    queryFn: () => get<ResultadoBusca>(`/projetos/${projetoId}/busca`, { q: busca }),
    enabled: busca.length >= 2,
  });
  const total = r.data ? r.data.documentos.length + r.data.respostas.length + r.data.citacoes.length : 0;
  return (
    <div className="card">
      <div className="card-body">
        <h2 className="h5">Buscar no projeto</h2>
        <form
          className="input-group mb-3"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setBusca(termo.trim());
          }}
        >
          <input
            className="form-control"
            placeholder="Documentos, respostas e citações"
            aria-label="Termo de busca"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            minLength={2}
          />
          <button className="btn btn-primary" disabled={termo.trim().length < 2}>
            <i className="bi bi-search" aria-hidden="true" />
            <span className="visually-hidden">Buscar</span>
          </button>
        </form>
        {r.isFetching && <div className="small text-secondary">Buscando…</div>}
        <ErroAlerta erro={r.error} />
        {r.data && total === 0 && <div className="small text-secondary">Nada encontrado para “{busca}”.</div>}
        {r.data && total > 0 && (
          <div className="small">
            {r.data.documentos.length > 0 && <div className="k-label text-secondary mt-2">Documentos</div>}
            {r.data.documentos.map((d) => (
              <div key={d.id} className="py-1 border-bottom">
                <Link to={`../documentos?doc=${d.id}`}>{d.titulo}</Link>{' '}
                <span className="text-secondary">{d.ano ?? ''}</span>
              </div>
            ))}
            {r.data.respostas.length > 0 && <div className="k-label text-secondary mt-3">Respostas</div>}
            {r.data.respostas.map((x) => (
              <div key={x.id} className="py-1 border-bottom">
                <span className="k-mono me-1">{x.codigo}</span>
                <Link to={`../analises/${x.analiseId}?doc=${x.documentoId}`}>{x.analiseNome}</Link>
                <div className="text-secondary text-truncate">{x.texto}</div>
              </div>
            ))}
            {r.data.citacoes.length > 0 && (
              <div className="k-label text-secondary mt-3">Citações da matriz de síntese</div>
            )}
            {r.data.citacoes.map((x) => (
              <div key={x.id} className="py-1 border-bottom">
                <Link to={`../analises/${x.analiseId}?doc=${x.documentoId}&aba=matriz`}>
                  {x.citacao || x.textoParafraseado}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Temas e categorias do projeto (usados nos documentos e nas revisões) */
function Temas({ projetoId, edita }: { projetoId: string; edita: boolean }) {
  const qc = useQueryClient();
  const [aba, setAba] = useState<'temas' | 'categorias'>('temas');
  const [nome, setNome] = useState('');
  const chave = aba === 'temas' ? chaves.temas(projetoId) : (['projeto', projetoId, 'categorias'] as const);
  const lista = useQuery({ queryKey: chave, queryFn: () => get<Tema[]>(`/projetos/${projetoId}/${aba}`) });
  const criar = useMutation({
    mutationFn: () => post(`/projetos/${projetoId}/${aba}`, { nome: nome.trim() }),
    onSuccess: () => {
      setNome('');
      qc.invalidateQueries({ queryKey: chave });
    },
  });
  return (
    <div className="card mb-4">
      <div className="card-body">
        <Abas
          abas={[
            { id: 'temas', texto: 'Temas' },
            { id: 'categorias', texto: 'Categorias' },
          ]}
          atual={aba}
          aoMudar={setAba}
          rotulo="Temas e categorias do projeto"
          className="nav nav-pills nav-sm mb-3"
          classeBotao="py-1"
        >
          <ErroAlerta erro={lista.error ?? criar.error} />
          <div className="d-flex flex-wrap gap-1 mb-3">
            {lista.data?.map((t) => (
              <span key={t.id} className="badge text-bg-light border d-inline-flex align-items-center gap-1">
                {t.nome}
                {edita && (
                  <BotaoConfirmar
                    className="btn btn-link btn-sm p-0 text-danger"
                    titulo={`Excluir ${t.nome}`}
                    pergunta={`Excluir "${t.nome}"?`}
                    aoConfirmar={async () => {
                      await del(`/projetos/${projetoId}/${aba}/${t.id}`);
                      await qc.invalidateQueries({ queryKey: chave });
                    }}
                  >
                    <i className="bi bi-x" aria-hidden="true" />
                  </BotaoConfirmar>
                )}
              </span>
            ))}
            {lista.data?.length === 0 && <span className="small text-secondary">Nenhum cadastrado.</span>}
          </div>
          {edita && (
            <form
              className="input-group input-group-sm"
              onSubmit={(e) => {
                e.preventDefault();
                if (nome.trim()) criar.mutate();
              }}
            >
              <input
                className="form-control"
                placeholder={`Novo ${aba === 'temas' ? 'tema' : 'categoria'}`}
                aria-label={aba === 'temas' ? 'Nome do novo tema' : 'Nome da nova categoria'}
                value={nome}
                maxLength={120}
                onChange={(e) => setNome(e.target.value)}
              />
              <button className="btn btn-outline-primary" disabled={!nome.trim() || criar.isPending}>
                Adicionar
              </button>
            </form>
          )}
        </Abas>
      </div>
    </div>
  );
}
