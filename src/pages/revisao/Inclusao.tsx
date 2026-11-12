import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../../lib/api';
import type { DocumentoResumo, EtapaRevisao, Pagina } from '../../lib/tipos';
import { Carregando, ErroAlerta } from '../../components/ui';
import { useProjetoAtual } from '../projeto/ProjetoLayout';
import { chaveDocsRevisao, DocumentosDaRevisao } from './DocumentosDaRevisao';
import { chaveEtapas } from './Revisao';
import { baixarModeloOrigem, ImportarCsvEtapa } from './AcoesEtapa';

/**
 * RF31/UC07 5a: revisão anterior e integrados (busca manual, snowballing) entram direto como incluídos.
 * Ao concluir a etapa, os selecionados na última triagem também passam a incluídos (RN13).
 */
export function Inclusao({ revisaoId, etapa }: { revisaoId: string; etapa: EtapaRevisao }) {
  const { projeto, edita } = useProjetoAtual();
  const qc = useQueryClient();
  const [origem, setOrigem] = useState<'INTEGRADO' | 'REVISAO_ANTERIOR'>('INTEGRADO');
  const [ids, setIds] = useState<string[]>([]);
  const [importar, setImportar] = useState(false);
  const candidatos = useQuery({
    queryKey: ['projeto', projeto.id, 'documentos', 'sem-revisao'],
    queryFn: () =>
      get<Pagina<DocumentoResumo>>(`/projetos/${projeto.id}/documentos`, {
        semRevisao: true,
        pageSize: 200,
        sort: 'titulo',
      }),
    enabled: edita,
  });
  const incluir = useMutation({
    mutationFn: () => post<{ incluidos: number }>(`/revisoes/${revisaoId}/documentos`, { documentoIds: ids, origem }),
    onSuccess: () => {
      setIds([]);
      qc.invalidateQueries({ queryKey: chaveDocsRevisao(revisaoId) });
      qc.invalidateQueries({ queryKey: ['projeto', projeto.id, 'documentos'] });
      qc.invalidateQueries({ queryKey: chaveEtapas(revisaoId) });
    },
  });
  return (
    <div className="row g-4">
      <div className="col-xl-7">
        <h4 className="h6">Incluídos nesta revisão</h4>
        <DocumentosDaRevisao revisaoId={revisaoId} situacaoFixa="INCLUIDO" acoes />
        {etapa.status === 'EM_ANDAMENTO' && (
          <p className="small text-secondary mt-2">
            Ao concluir esta etapa, os selecionados na última triagem também passam a incluídos.
          </p>
        )}
      </div>
      {edita && etapa.status === 'EM_ANDAMENTO' && (
        <div className="col-xl-5">
          <div className="card bg-body-tertiary border-0">
            <div className="card-body">
              <h4 className="h6">Adicionar de outras origens</h4>
              <div className="btn-group btn-group-sm mb-2" role="group" aria-label="Origem">
                {(['INTEGRADO', 'REVISAO_ANTERIOR'] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`btn ${origem === o ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setOrigem(o)}
                  >
                    {o === 'INTEGRADO' ? 'Integrados' : 'Revisão anterior'}
                  </button>
                ))}
              </div>
              <div className="border rounded bg-body p-2 mb-3 small">
                <div className="fw-medium mb-1">
                  Importar planilha ({origem === 'INTEGRADO' ? 'integrados' : 'revisão anterior'})
                </div>
                <p className="text-secondary mb-2">
                  {origem === 'INTEGRADO'
                    ? 'Colunas: N°, Título, Autores, Resumo, Palavras-chave, Ano, Periódico, Idioma, Link, Como citar, Citações e Base.'
                    : 'Colunas: N°, Título, Autores, Resumo, Palavras-chave, Tipo, Ano, Link, Como citar, Referências, Citações e Base.'}{' '}
                  Os documentos entram direto como incluídos.
                </p>
                <div className="d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setImportar(true)}>
                    <i className="bi bi-filetype-csv me-1" aria-hidden="true" />
                    Importar CSV
                  </button>
                  <button type="button" className="btn btn-link btn-sm" onClick={() => baixarModeloOrigem(origem)}>
                    Baixar modelo
                  </button>
                </div>
              </div>
              <p className="small text-secondary">
                Ou escolha documentos do projeto que ainda não estão em nenhuma revisão. Cadastre novos na aba
                Documentos.
              </p>
              <ErroAlerta erro={candidatos.error ?? incluir.error} />
              {incluir.data && (
                <div className="alert alert-success small py-2">{incluir.data.incluidos} documento(s) incluído(s).</div>
              )}
              <div className="border rounded bg-body p-2 mb-2" style={{ maxHeight: 260, overflowY: 'auto' }}>
                {candidatos.isLoading && <Carregando />}
                {candidatos.data?.itens.length === 0 && (
                  <div className="small text-secondary">Nenhum documento disponível.</div>
                )}
                {candidatos.data?.itens.map((d) => (
                  <div className="form-check small" key={d.id}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`inc-${d.id}`}
                      checked={ids.includes(d.id)}
                      onChange={(e) => setIds(e.target.checked ? [...ids, d.id] : ids.filter((x) => x !== d.id))}
                    />
                    <label className="form-check-label" htmlFor={`inc-${d.id}`}>
                      {d.titulo} {d.ano ? `(${d.ano})` : ''}
                    </label>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-primary btn-sm"
                disabled={!ids.length || incluir.isPending}
                onClick={() => incluir.mutate()}
              >
                Incluir {ids.length || ''}
              </button>
              {importar && (
                <ImportarCsvEtapa
                  revisaoId={revisaoId}
                  etapa={etapa}
                  entrada={etapa.categoria !== 'INCLUSAO'}
                  aberto
                  origemInicial={origem}
                  aoFechar={() => {
                    setImportar(false);
                    qc.invalidateQueries({ queryKey: ['projeto', projeto.id, 'documentos'] });
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
