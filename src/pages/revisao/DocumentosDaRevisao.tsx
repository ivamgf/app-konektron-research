import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, get, patch } from '../../lib/api';
import { rotulo } from '../../lib/formato';
import type { Documento, DocumentoDaRevisao, Tema } from '../../lib/tipos';
import { BotaoConfirmar, Carregando, ErroAlerta, Modal, Situacao, Vazio } from '../../components/ui';
import { useProjetoAtual } from '../projeto/ProjetoLayout';
import { FormDocumento } from '../projeto/Documentos';

const ORIGENS = [
  ['BUSCA', 'Busca'],
  ['MANUAL', 'Manual'],
  ['REVISAO_ANTERIOR', 'Revisão anterior'],
  ['INTEGRADO', 'Integrado (fonte secundária)'],
] as const;

export const chaveDocsRevisao = (revisaoId: string) => ['revisao', revisaoId, 'documentos'] as const;

/** Documentos da revisão por situação e origem; a origem e a categoria podem ser ajustadas aqui */
export function DocumentosDaRevisao({
  revisaoId,
  situacaoFixa,
  acoes = false,
}: {
  revisaoId: string;
  situacaoFixa?: 'INCLUIDO';
  /** botões Editar e Excluir por documento (etapa de inclusão de revisão anterior e integrados) */
  acoes?: boolean;
}) {
  const { projeto, edita } = useProjetoAtual();
  const qc = useQueryClient();
  const [situacao, setSituacao] = useState<string>(situacaoFixa ?? '');
  const [origem, setOrigem] = useState('');
  const q = useQuery({
    queryKey: [...chaveDocsRevisao(revisaoId), situacao, origem],
    queryFn: () =>
      get<DocumentoDaRevisao[]>(`/revisoes/${revisaoId}/documentos`, {
        situacao: situacao || undefined,
        origem: origem || undefined,
      }),
  });
  const categorias = useQuery({
    queryKey: ['projeto', projeto.id, 'categorias'],
    queryFn: () => get<Tema[]>(`/projetos/${projeto.id}/categorias`),
  });
  const mudarCategoria = useMutation({
    mutationFn: ({ rdId, categoriaId }: { rdId: string; categoriaId: string | null }) =>
      patch(`/revisoes/${revisaoId}/documentos/${rdId}`, { categoriaId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveDocsRevisao(revisaoId) }),
  });
  const [editando, setEditando] = useState<Documento | null>(null);
  const [erroAcao, setErroAcao] = useState<unknown>(null);
  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['revisao', revisaoId] });
    qc.invalidateQueries({ queryKey: ['projeto', projeto.id, 'documentos'] });
  };
  const editar = async (d: DocumentoDaRevisao) => {
    try {
      setErroAcao(null);
      setEditando(await get<Documento>(`/documentos/${d.documentoId}`));
    } catch (e) {
      setErroAcao(e);
    }
  };
  // tira da revisão; o documento também sai do projeto se não estiver em outra revisão nem em análises
  const excluir = (d: DocumentoDaRevisao) =>
    api.delete(`/revisoes/${revisaoId}/documentos/${d.id}`, { params: { apagarDocumento: true } }).then(atualizar);
  // revisão anterior e integrados entram como incluídos; voltar para busca devolve à triagem
  const mudarOrigem = useMutation({
    mutationFn: ({ rdId, origem }: { rdId: string; origem: string }) =>
      patch(`/revisoes/${revisaoId}/documentos/${rdId}`, { origem }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['revisao', revisaoId] }),
  });

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-3">
        {!situacaoFixa && (
          <select
            className="form-select form-select-sm w-auto"
            aria-label="Situação"
            value={situacao}
            onChange={(e) => setSituacao(e.target.value)}
          >
            <option value="">Todas as situações</option>
            {['EM_TRIAGEM', 'INCLUIDO', 'EXCLUIDO'].map((s) => (
              <option key={s} value={s}>
                {rotulo(s)}
              </option>
            ))}
          </select>
        )}
        <select
          className="form-select form-select-sm w-auto"
          aria-label="Origem"
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
        >
          <option value="">Todas as origens</option>
          {['BUSCA', 'REVISAO_ANTERIOR', 'INTEGRADO', 'MANUAL'].map((s) => (
            <option key={s} value={s}>
              {s === 'BUSCA' ? 'Busca' : rotulo(s)}
            </option>
          ))}
        </select>
        {q.data && <span className="small text-secondary align-self-center">{q.data.length} documento(s)</span>}
      </div>
      {q.isLoading && <Carregando />}
      <ErroAlerta erro={q.error ?? mudarCategoria.error ?? mudarOrigem.error ?? erroAcao} />
      {q.data?.length === 0 && <Vazio icone="bi-files">Nenhum documento.</Vazio>}
      {!!q.data?.length && (
        <div className="table-responsive">
          <table className="table table-sm small align-middle">
            <thead>
              <tr>
                <th>Título</th>
                <th>Ano</th>
                <th>Base / origem</th>
                <th>Situação</th>
                <th>Categoria</th>
                {acoes && edita && <th className="text-end">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {q.data.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.titulo}
                    {d.duplicadoDeId && <span className="badge text-bg-secondary ms-1">duplicado</span>}
                  </td>
                  <td>{d.ano ?? '—'}</td>
                  <td>
                    {d.baseNome && <div>{d.baseNome}</div>}
                    {edita ? (
                      <select
                        className="form-select form-select-sm"
                        aria-label={`Origem de ${d.titulo}`}
                        value={d.origem}
                        disabled={mudarOrigem.isPending}
                        onChange={(e) => mudarOrigem.mutate({ rdId: d.id, origem: e.target.value })}
                      >
                        {ORIGENS.map(([v, t]) => (
                          <option key={v} value={v}>
                            {t}
                          </option>
                        ))}
                      </select>
                    ) : (
                      !d.baseNome && (d.origem === 'BUSCA' ? '—' : rotulo(d.origem))
                    )}
                  </td>
                  <td>
                    <Situacao valor={d.situacao} />
                  </td>
                  <td>
                    {edita && categorias.data?.length ? (
                      <select
                        className="form-select form-select-sm"
                        aria-label={`Categoria de ${d.titulo}`}
                        value={categorias.data.find((c) => c.nome === d.categoriaNome)?.id ?? ''}
                        onChange={(e) => mudarCategoria.mutate({ rdId: d.id, categoriaId: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {categorias.data.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    ) : (
                      (d.categoriaNome ?? '—')
                    )}
                  </td>
                  {acoes && edita && (
                    <td className="text-end text-nowrap">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm me-1"
                        title="Editar documento"
                        aria-label={`Editar ${d.titulo}`}
                        onClick={() => editar(d)}
                      >
                        <i className="bi bi-pencil" aria-hidden="true" />
                      </button>
                      {d.origem !== 'BUSCA' ? (
                        <BotaoConfirmar
                          titulo={`Excluir ${d.titulo}`}
                          pergunta={
                            <>
                              Excluir <strong>{d.titulo}</strong> desta revisão? Se o documento não estiver em outra
                              revisão nem em análises, ele também é apagado do projeto.
                            </>
                          }
                          aoConfirmar={() => excluir(d)}
                        >
                          <i className="bi bi-trash" aria-hidden="true" />
                        </BotaoConfirmar>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          disabled
                          title="Documentos de busca saem da revisão pela triagem (exclusão com motivo)"
                          aria-label={`Excluir ${d.titulo} (indisponível: documento de busca)`}
                        >
                          <i className="bi bi-trash" aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal titulo="Editar documento" aberto={!!editando} aoFechar={() => setEditando(null)} tamanho="lg">
        {editando && (
          <FormDocumento
            inicial={editando}
            projetoId={projeto.id}
            aoSalvar={() => {
              setEditando(null);
              atualizar();
            }}
          />
        )}
      </Modal>
    </>
  );
}
