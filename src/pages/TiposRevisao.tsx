import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { del, get, patch, post, put } from '../lib/api';
import { chaves, useTiposRevisao } from '../lib/consultas';
import { rotulo } from '../lib/formato';
import type { CategoriaEtapa, EtapaModelo, MotivoExclusao, Projeto, TipoRevisao } from '../lib/tipos';
import { BotaoConfirmar, Cabecalho, Carregando, ErroAlerta, Modal } from '../components/ui';

const CATEGORIAS: CategoriaEtapa[] = [
  'PROTOCOLO',
  'BUSCA',
  'DEDUPLICACAO',
  'TRIAGEM',
  'INCLUSAO',
  'ANALISE',
  'SINTESE',
  'DISCUSSAO',
  'CHECKLIST',
  'LIVRE',
];
const MOTIVOS: MotivoExclusao[] = ['CRITERIO', 'DUPLICADO', 'SEM_ACESSO', 'OUTRO'];

/** RF16–RF18/UC05: árvore de tipos à esquerda, etapas ordenáveis à direita */
export default function TiposRevisao() {
  const { usuario } = useAuth();
  const admin = usuario?.perfilGlobal === 'ADMIN';
  const qc = useQueryClient();
  const [projetoId, setProjetoId] = useState('');
  const projetos = useQuery({
    queryKey: [...chaves.projetos, 'ATIVO'],
    queryFn: () => get<Projeto[]>('/projetos', { status: 'ATIVO' }),
  });
  const tipos = useTiposRevisao(projetoId || undefined);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [form, setForm] = useState<{
    modo: 'novo' | 'copiar';
    nome: string;
    tipoPaiId: string;
    sistematica: boolean;
    descricao: string;
  } | null>(null);
  const projetoEscolhido = projetos.data?.find((p) => p.id === projetoId);
  const podeEscreverProjeto =
    !!projetoEscolhido && ['RESPONSAVEL', 'COLABORADOR'].includes(projetoEscolhido.papel ?? '');
  const podeEditar = (t?: TipoRevisao) => !!t && (admin || (!!t.projetoId && podeEscreverProjeto));

  const recarregar = () => qc.invalidateQueries({ queryKey: ['tipos-revisao'] });
  const salvarNovo = useMutation({
    mutationFn: () =>
      form!.modo === 'copiar'
        ? post<TipoRevisao>(`/tipos-revisao/${selecionado}/copiar`, {
            nome: form!.nome.trim(),
            projetoId: projetoId || null,
          })
        : post<TipoRevisao>('/tipos-revisao', {
            nome: form!.nome.trim(),
            descricao: form!.descricao.trim() || null,
            tipoPaiId: form!.tipoPaiId || null,
            sistematica: form!.sistematica,
            projetoId: projetoId || null,
          }),
    onSuccess: async (t) => {
      await recarregar();
      setForm(null);
      setSelecionado(t.id);
    },
  });

  const lista = tipos.data ?? [];
  const filhos = (pai: string | null) =>
    lista.filter((t) => (t.tipoPaiId ?? null) === pai).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const arvore = (pai: string | null, nivel = 0): JSX.Element[] =>
    filhos(pai).flatMap((t) => [
      <button
        key={t.id}
        type="button"
        className={`list-group-item list-group-item-action d-flex align-items-center gap-2 ${selecionado === t.id ? 'active' : ''}`}
        style={{ paddingLeft: `${1 + nivel * 1.25}rem` }}
        onClick={() => setSelecionado(t.id)}
      >
        {nivel > 0 && <i className="bi bi-arrow-return-right text-secondary" aria-hidden="true" />}
        <span className={`me-auto ${t.ativo ? '' : 'text-decoration-line-through'}`}>{t.nome}</span>
        {t.sistematicaEfetiva && <span className="badge text-bg-success">Sistemática</span>}
        {t.projetoId && <span className="badge text-bg-light border">projeto</span>}
        <span className="small text-secondary">{t.totalEtapas}</span>
      </button>,
      ...arvore(t.id, nivel + 1),
    ]);
  const podeCriar = admin || podeEscreverProjeto;

  return (
    <>
      <Cabecalho titulo="Tipos de revisão" subtitulo="Tipos globais e, escolhendo um projeto, os tipos dele">
        {podeCriar && (
          <button
            className="btn btn-primary"
            onClick={() =>
              setForm({ modo: 'novo', nome: '', tipoPaiId: selecionado ?? '', sistematica: false, descricao: '' })
            }
          >
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Novo tipo
          </button>
        )}
      </Cabecalho>
      <div className="row g-4">
        <div className="col-lg-4">
          <label htmlFor="tr-projeto" className="form-label small">
            Projeto
          </label>
          <select
            id="tr-projeto"
            className="form-select mb-3"
            value={projetoId}
            onChange={(e) => setProjetoId(e.target.value)}
          >
            <option value="">Só os tipos globais</option>
            {projetos.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo}
              </option>
            ))}
          </select>
          {!admin && !podeEscreverProjeto && (
            <p className="small text-secondary">
              Tipos globais são mantidos pelo administrador. Escolha um projeto seu para criar ou copiar tipos.
            </p>
          )}
          {tipos.isLoading && <Carregando />}
          <ErroAlerta erro={tipos.error} />
          <div className="list-group">{arvore(null)}</div>
        </div>
        <div className="col-lg-8">
          {selecionado ? (
            <DetalheTipo
              id={selecionado}
              tipos={lista}
              podeEditar={podeEditar(lista.find((t) => t.id === selecionado))}
              podeCopiar={podeCriar}
              aoCopiar={(t) =>
                setForm({
                  modo: 'copiar',
                  nome: `${t.nome} (cópia)`,
                  tipoPaiId: '',
                  sistematica: t.sistematica,
                  descricao: '',
                })
              }
              aoExcluir={() => setSelecionado(null)}
            />
          ) : (
            <p className="text-secondary">Escolha um tipo para ver e editar as etapas.</p>
          )}
        </div>
      </div>

      <Modal
        titulo={form?.modo === 'copiar' ? 'Copiar tipo de revisão' : 'Novo tipo de revisão'}
        aberto={!!form}
        aoFechar={() => setForm(null)}
      >
        {form && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              salvarNovo.mutate();
            }}
          >
            <ErroAlerta erro={salvarNovo.error} />
            <p className="small text-secondary">
              {projetoId
                ? `O tipo fica no projeto "${projetoEscolhido?.titulo}".`
                : 'Tipo global (visível em todos os projetos).'}
            </p>
            <div className="mb-3">
              <label htmlFor="tr-nome" className="form-label">
                Nome
              </label>
              <input
                id="tr-nome"
                className="form-control"
                maxLength={120}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            {form.modo === 'novo' && (
              <>
                <div className="mb-3">
                  <label htmlFor="tr-desc" className="form-label">
                    Descrição
                  </label>
                  <textarea
                    id="tr-desc"
                    className="form-control"
                    rows={2}
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="tr-pai" className="form-label">
                    Tipo pai (o subtipo herda as etapas — RN07)
                  </label>
                  <select
                    id="tr-pai"
                    className="form-select"
                    value={form.tipoPaiId}
                    onChange={(e) => setForm({ ...form, tipoPaiId: e.target.value })}
                  >
                    <option value="">Nenhum (do zero)</option>
                    {lista.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="tr-sist"
                    checked={form.sistematica}
                    onChange={(e) => setForm({ ...form, sistematica: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="tr-sist">
                    Sistemática (exige etapas com triagem; subtipos herdam — RN06)
                  </label>
                </div>
              </>
            )}
            <div className="text-end">
              <button className="btn btn-primary" disabled={!form.nome.trim() || salvarNovo.isPending}>
                Salvar
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

function DetalheTipo({
  id,
  tipos,
  podeEditar,
  podeCopiar,
  aoCopiar,
  aoExcluir,
}: {
  id: string;
  tipos: TipoRevisao[];
  podeEditar: boolean;
  podeCopiar: boolean;
  aoCopiar: (t: TipoRevisao) => void;
  aoExcluir: () => void;
}) {
  const qc = useQueryClient();
  const chave = ['tipo-revisao', id];
  const q = useQuery({ queryKey: chave, queryFn: () => get<TipoRevisao>(`/tipos-revisao/${id}`) });
  const [etapa, setEtapa] = useState<Partial<EtapaModelo> | null>(null);
  const recarregar = () =>
    Promise.all([qc.invalidateQueries({ queryKey: chave }), qc.invalidateQueries({ queryKey: ['tipos-revisao'] })]);
  const alterarTipo = useMutation({
    mutationFn: (d: Partial<TipoRevisao>) => patch(`/tipos-revisao/${id}`, d),
    onSuccess: recarregar,
  });
  const salvarEtapa = useMutation({
    mutationFn: () => {
      const corpo = {
        nome: etapa!.nome?.trim(),
        descricao: etapa!.descricao || null,
        categoria: etapa!.categoria,
        exigeTriagem: !!etapa!.exigeTriagem,
        permiteExclusao: !!etapa!.permiteExclusao,
        motivosSugeridos: etapa!.motivosSugeridos ?? [],
      };
      return etapa!.id
        ? patch(`/tipos-revisao/${id}/etapas/${etapa!.id}`, corpo)
        : post(`/tipos-revisao/${id}/etapas`, corpo);
    },
    onSuccess: async () => {
      setEtapa(null);
      await recarregar();
    },
  });
  const ordenar = useMutation({
    mutationFn: (ids: string[]) => put(`/tipos-revisao/${id}/etapas/ordem`, { ids }),
    onSuccess: recarregar,
  });

  if (q.isLoading) return <Carregando />;
  if (q.error || !q.data) return <ErroAlerta erro={q.error} />;
  const t = q.data;
  const etapas = t.etapas ?? [];
  const pai = tipos.find((x) => x.id === t.tipoPaiId);

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex flex-wrap gap-2 align-items-start mb-2">
          <div className="me-auto">
            <h2 className="h5 mb-1">
              {t.nome} {t.sistematicaEfetiva && <span className="badge text-bg-success align-middle">Sistemática</span>}
            </h2>
            <div className="small text-secondary">
              {pai ? `Subtipo de ${pai.nome}` : 'Tipo raiz'} · {t.projetoId ? 'do projeto' : 'global'}
              {!t.ativo && ' · inativo'}
            </div>
          </div>
          {podeCopiar && (
            <button className="btn btn-outline-secondary btn-sm" onClick={() => aoCopiar(t)}>
              <i className="bi bi-copy me-1" aria-hidden="true" />
              Copiar
            </button>
          )}
          {podeEditar && (
            <>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => alterarTipo.mutate({ ativo: !t.ativo })}
              >
                {t.ativo ? 'Desativar' : 'Ativar'}
              </button>
              <BotaoConfirmar
                pergunta={`Excluir o tipo "${t.nome}"? Tipos em uso não podem ser excluídos; desative-os.`}
                aoConfirmar={async () => {
                  await del(`/tipos-revisao/${t.id}`);
                  await qc.invalidateQueries({ queryKey: ['tipos-revisao'] });
                  aoExcluir();
                }}
              >
                <i className="bi bi-trash" aria-hidden="true" />
              </BotaoConfirmar>
            </>
          )}
        </div>
        {t.descricao && <p className="small">{t.descricao}</p>}
        {t.aviso && <div className="alert alert-warning small py-2">{t.aviso}</div>}
        <ErroAlerta erro={alterarTipo.error ?? ordenar.error} />

        <div className="d-flex align-items-center mt-3 mb-2">
          <h3 className="h6 mb-0 me-auto">Etapas ({etapas.length})</h3>
          {podeEditar && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() =>
                setEtapa({ categoria: 'LIVRE', exigeTriagem: false, permiteExclusao: false, motivosSugeridos: [] })
              }
            >
              <i className="bi bi-plus-lg me-1" aria-hidden="true" />
              Etapa
            </button>
          )}
        </div>
        <ol className="list-group list-group-numbered">
          {etapas.map((e, i) => (
            <li key={e.id} className="list-group-item d-flex gap-2 align-items-start">
              <div className="ms-1 me-auto">
                <div className="fw-medium">{e.nome}</div>
                <div className="small text-secondary">
                  {rotulo(e.categoria)}
                  {e.exigeTriagem && ' · exige triagem'}
                  {e.permiteExclusao && ' · permite exclusão'}
                  {!!e.motivosSugeridos?.length && ` · motivos: ${e.motivosSugeridos.map(rotulo).join(', ')}`}
                </div>
              </div>
              {podeEditar && (
                <div className="btn-group btn-group-sm">
                  <button
                    className="btn btn-outline-secondary"
                    aria-label={`Subir ${e.nome}`}
                    disabled={i === 0}
                    onClick={() => {
                      const ids = etapas.map((x) => x.id);
                      [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                      ordenar.mutate(ids);
                    }}
                  >
                    <i className="bi bi-arrow-up" aria-hidden="true" />
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    aria-label={`Descer ${e.nome}`}
                    disabled={i === etapas.length - 1}
                    onClick={() => {
                      const ids = etapas.map((x) => x.id);
                      [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
                      ordenar.mutate(ids);
                    }}
                  >
                    <i className="bi bi-arrow-down" aria-hidden="true" />
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    aria-label={`Editar ${e.nome}`}
                    onClick={() => setEtapa(e)}
                  >
                    <i className="bi bi-pencil" aria-hidden="true" />
                  </button>
                  <BotaoConfirmar
                    className="btn btn-outline-danger"
                    titulo={`Excluir ${e.nome}`}
                    pergunta={`Excluir a etapa "${e.nome}"?`}
                    aoConfirmar={async () => {
                      await del(`/tipos-revisao/${id}/etapas/${e.id}`);
                      await recarregar();
                    }}
                  >
                    <i className="bi bi-trash" aria-hidden="true" />
                  </BotaoConfirmar>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>

      <Modal titulo={etapa?.id ? 'Editar etapa' : 'Nova etapa'} aberto={!!etapa} aoFechar={() => setEtapa(null)}>
        {etapa && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              salvarEtapa.mutate();
            }}
          >
            <ErroAlerta erro={salvarEtapa.error} />
            <div className="mb-3">
              <label htmlFor="et-nome" className="form-label">
                Nome
              </label>
              <input
                id="et-nome"
                className="form-control"
                maxLength={120}
                value={etapa.nome ?? ''}
                onChange={(e) => setEtapa({ ...etapa, nome: e.target.value })}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="et-cat" className="form-label">
                Categoria
              </label>
              <select
                id="et-cat"
                className="form-select"
                value={etapa.categoria}
                onChange={(e) => {
                  const categoria = e.target.value as CategoriaEtapa;
                  setEtapa({ ...etapa, categoria, exigeTriagem: categoria === 'TRIAGEM' ? true : etapa.exigeTriagem });
                }}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {rotulo(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="et-tri"
                checked={!!etapa.exigeTriagem}
                onChange={(e) => setEtapa({ ...etapa, exigeTriagem: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="et-tri">
                Exige triagem (decisão para cada documento)
              </label>
            </div>
            <div className="form-check mb-3">
              <input
                className="form-check-input"
                type="checkbox"
                id="et-exc"
                checked={!!etapa.permiteExclusao}
                onChange={(e) => setEtapa({ ...etapa, permiteExclusao: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="et-exc">
                Permite exclusão
              </label>
            </div>
            <fieldset className="mb-3">
              <legend className="form-label fs-6">Motivos de exclusão sugeridos</legend>
              {MOTIVOS.map((m) => (
                <div className="form-check form-check-inline" key={m}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`et-m-${m}`}
                    checked={etapa.motivosSugeridos?.includes(m) ?? false}
                    onChange={(e) =>
                      setEtapa({
                        ...etapa,
                        motivosSugeridos: e.target.checked
                          ? [...(etapa.motivosSugeridos ?? []), m]
                          : (etapa.motivosSugeridos ?? []).filter((x) => x !== m),
                      })
                    }
                  />
                  <label className="form-check-label" htmlFor={`et-m-${m}`}>
                    {rotulo(m)}
                  </label>
                </div>
              ))}
            </fieldset>
            <div className="text-end">
              <button className="btn btn-primary" disabled={!etapa.nome?.trim() || salvarEtapa.isPending}>
                Salvar
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
