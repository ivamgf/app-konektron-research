import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, mensagemDeErro, post, put } from '../../lib/api';
import { dataHora, rotulo } from '../../lib/formato';
import { Carregando, ErroAlerta } from '../../components/ui';
import { LinksDoArquivo, useTarefa } from '../../components/BotaoTarefa';
import { useProjetoAtual } from './ProjetoLayout';
import {
  alternarSecao,
  CAMPOS,
  chaveTextos,
  contarPalavras,
  NOME_SECAO,
  opcoesIniciais,
  ORIENTACAO_SINTESE,
  ORIGEM_SECAO,
  pendentes,
  SECOES,
  secoesPadrao,
  type CampoTexto,
  type Opcoes,
  type Rascunho,
  type Secao,
  type Textos,
} from './relatorioLogica';

type RevisaoOpcao = { id: string; titulo: string; status: string; tipoNome: string; sistematica: boolean };
type Resposta = {
  dados: Rascunho | null;
  atualizadoEm: string | null;
  revisoes: RevisaoOpcao[];
  revisaoId: string | null;
  questoes: { id: string; codigo: string; enunciado: string }[];
  secoesPadrao: Secao[];
};

/**
 * Relatório de pesquisa no modelo Konektron: os campos vêm do banco (projeto, protocolo, revisão,
 * buscas, triagem, análises, checklist, cronograma) e o pesquisador escreve só o que o banco não tem.
 * Prévia no app; PDF e Word gerados no worker.
 */
export default function Relatorio() {
  const { projeto, edita } = useProjetoAtual();
  const qc = useQueryClient();
  const [revisaoId, setRevisaoId] = useState<string | null | undefined>(undefined);
  const chave = ['projeto', projeto.id, 'relatorio', revisaoId ?? null];
  const q = useQuery({
    queryKey: chave,
    queryFn: () => get<Resposta>(`/projetos/${projeto.id}/relatorio`, revisaoId ? { revisaoId } : undefined),
    placeholderData: (anterior) => anterior, // troca de revisão sem piscar a tela
  });
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [alterado, setAlterado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);

  // primeira carga: rascunho salvo e revisão escolhida
  useEffect(() => {
    if (!q.data) return;
    if (!rascunho) {
      setRascunho(q.data.dados ?? {});
      setOpcoes(opcoesIniciais(q.data.dados?.opcoes, q.data.secoesPadrao));
    }
    if (revisaoId === undefined) setRevisaoId(q.data.revisaoId);
  }, [q.data, rascunho, revisaoId]);

  useEffect(() => {
    if (!alterado) return;
    const antes = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', antes);
    return () => window.removeEventListener('beforeunload', antes);
  }, [alterado]);

  const atual = revisaoId ?? q.data?.revisaoId ?? null;
  const textos: Textos = rascunho?.textos?.[chaveTextos(atual)] ?? {};
  const montado = (): Rascunho => ({ ...rascunho, revisaoId: atual, opcoes: opcoes ?? undefined });

  const salvar = useMutation({
    mutationFn: (dados: Rascunho) => put<{ atualizadoEm: string }>(`/projetos/${projeto.id}/relatorio`, { dados }),
    onSuccess: (r) => {
      setAlterado(false);
      setAviso(`Rascunho salvo em ${dataHora(r.atualizadoEm)}.`);
      qc.setQueryData<Resposta>(chave, (v) => (v ? { ...v, atualizadoEm: r.atualizadoEm } : v));
    },
  });
  const verPrevia = useMutation({
    mutationFn: () =>
      post<{ html: string }>(`/projetos/${projeto.id}/relatorio/previa`, { revisaoId: atual, opcoes, textos }),
    onSuccess: (r) => setPrevia(r.html),
  });
  const tarefa = useTarefa();
  const [formato, setFormato] = useState<'pdf' | 'docx'>('pdf');
  const gerar = async (f: 'pdf' | 'docx') => {
    setFormato(f);
    setAviso(null);
    // o worker usa os textos salvos: salva antes
    if (edita && alterado) {
      try {
        await salvar.mutateAsync(montado());
      } catch {
        return;
      }
    }
    await tarefa.iniciar(`/projetos/${projeto.id}/relatorio/gerar`, { revisaoId: atual, formato: f, opcoes });
  };

  const questoes = useMemo(() => q.data?.questoes ?? [], [q.data]);
  if (q.isLoading && !rascunho) return <Carregando />;
  if (q.error && !rascunho) return <ErroAlerta erro={q.error} />;
  if (!rascunho || !opcoes || !q.data) return <Carregando />;

  const revisoes = q.data.revisoes;
  const revisao = revisoes.find((r) => r.id === atual) ?? null;
  const mudarTextos = (t: Textos) => {
    setRascunho({ ...rascunho, textos: { ...rascunho.textos, [chaveTextos(atual)]: t } });
    setAlterado(true);
    setAviso(null);
  };
  const mudarCampo = (c: CampoTexto, v: string) => mudarTextos({ ...textos, [c]: v });
  const mudarOpcoes = (o: Partial<Opcoes>) => {
    setOpcoes({ ...opcoes, ...o });
    setAlterado(true);
    setAviso(null);
  };
  const trocarRevisao = (id: string) => {
    const r = revisoes.find((x) => x.id === id);
    setRevisaoId(id);
    setPrevia(null);
    setAlterado(true);
    // revisão narrativa x sistemática muda as seções padrão; mantém o que o usuário já escolheu
    if (r && !rascunho.opcoes?.secoes?.length) setOpcoes({ ...opcoes, secoes: secoesPadrao(r.sistematica) });
  };
  const inclui = (s: Secao) => opcoes.secoes.includes(s);
  const faltam = pendentes(textos, opcoes.secoes, questoes);
  const palavrasResumo = contarPalavras(textos.resumoAchados, textos.resumoConclusao);

  return (
    <div className="row g-4">
      <div className="col-lg-4 col-xl-3">
        <div className="position-sticky d-grid gap-3" style={{ top: '1rem' }}>
          <section aria-labelledby="rel-revisao">
            <h2 id="rel-revisao" className="h6 k-label">
              Revisão
            </h2>
            {revisoes.length ? (
              <>
                <label className="visually-hidden" htmlFor="rel-revisao-sel">
                  Revisão do relatório
                </label>
                <select
                  id="rel-revisao-sel"
                  className="form-select"
                  value={atual ?? ''}
                  onChange={(e) => trocarRevisao(e.target.value)}
                >
                  {revisoes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.titulo}
                    </option>
                  ))}
                </select>
                {revisao && (
                  <div className="small text-secondary mt-1">
                    {revisao.tipoNome} · {rotulo(revisao.status)} ·{' '}
                    {revisao.sistematica ? 'sistemática' : 'não sistemática'}
                  </div>
                )}
              </>
            ) : (
              <p className="small text-secondary mb-0">
                Nenhuma revisão no projeto: o relatório sai com os dados do protocolo e o cronograma.{' '}
                <Link to="../revisoes">Cadastrar revisão</Link>
              </p>
            )}
          </section>

          <fieldset>
            <legend className="h6 k-label">Seções</legend>
            <div className="d-grid gap-1 small">
              {SECOES.map((s) => (
                <div className="form-check mb-0" key={s}>
                  <input
                    id={`rel-s-${s}`}
                    type="checkbox"
                    className="form-check-input"
                    checked={inclui(s)}
                    onChange={(e) => mudarOpcoes({ secoes: alternarSecao(opcoes.secoes, s, e.target.checked) })}
                    aria-describedby={`rel-s-${s}-origem`}
                  />
                  <label className="form-check-label" htmlFor={`rel-s-${s}`}>
                    {NOME_SECAO[s]}
                  </label>
                  <span id={`rel-s-${s}-origem`} className="visually-hidden">
                    {ORIGEM_SECAO[s]}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-link btn-sm px-0"
              onClick={() => mudarOpcoes({ secoes: q.data.secoesPadrao })}
            >
              Restaurar seções padrão
            </button>
            {revisao && !revisao.sistematica && (
              <div className="form-text">
                Revisão não sistemática: a seleção em fases e o checklist ficam de fora por padrão.
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend className="h6 k-label">Opções</legend>
            <div className="d-flex gap-3 small mb-2" role="radiogroup" aria-label="Norma das referências">
              {(['ABNT', 'APA'] as const).map((n) => (
                <div className="form-check mb-0" key={n}>
                  <input
                    id={`rel-norma-${n}`}
                    type="radio"
                    name="rel-norma"
                    className="form-check-input"
                    checked={opcoes.norma === n}
                    onChange={() => mudarOpcoes({ norma: n })}
                  />
                  <label className="form-check-label" htmlFor={`rel-norma-${n}`}>
                    {n === 'ABNT' ? 'ABNT NBR 6023' : 'APA (7ª ed.)'}
                  </label>
                </div>
              ))}
            </div>
            <div className="form-check small mb-1">
              <input
                id="rel-capa"
                type="checkbox"
                className="form-check-input"
                checked={opcoes.capa}
                onChange={(e) => mudarOpcoes({ capa: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="rel-capa">
                Capa
              </label>
            </div>
            <div className="form-check small mb-0">
              <input
                id="rel-orientacoes"
                type="checkbox"
                className="form-check-input"
                checked={opcoes.orientacoes}
                onChange={(e) => mudarOpcoes({ orientacoes: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="rel-orientacoes">
                Orientações em itálico onde falta texto
              </label>
              <div className="form-text mt-0">Desligue na versão final.</div>
            </div>
          </fieldset>

          <div className="d-grid gap-2">
            {edita && (
              <button
                className="btn btn-outline-primary"
                disabled={salvar.isPending || !alterado}
                onClick={() => salvar.mutate(montado())}
              >
                <i className="bi bi-save me-1" aria-hidden="true" />
                {alterado ? 'Salvar rascunho' : 'Rascunho salvo'}
              </button>
            )}
            <button
              className="btn btn-outline-primary"
              disabled={verPrevia.isPending || !opcoes.secoes.length}
              onClick={() => verPrevia.mutate()}
            >
              {verPrevia.isPending ? (
                <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
              ) : (
                <i className="bi bi-eye me-1" aria-hidden="true" />
              )}
              {previa ? 'Atualizar prévia' : 'Ver prévia'}
            </button>
            <div className="btn-group" role="group" aria-label="Gerar o relatório">
              <button
                className="btn btn-primary"
                disabled={tarefa.andamento || !opcoes.secoes.length}
                onClick={() => gerar('pdf')}
              >
                {tarefa.andamento && formato === 'pdf' ? (
                  <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                ) : (
                  <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
                )}
                PDF
              </button>
              <button
                className="btn btn-primary"
                disabled={tarefa.andamento || !opcoes.secoes.length}
                onClick={() => gerar('docx')}
              >
                {tarefa.andamento && formato === 'docx' ? (
                  <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                ) : (
                  <i className="bi bi-file-earmark-word me-1" aria-hidden="true" />
                )}
                Word (DOCX)
              </button>
            </div>
            {tarefa.url && (
              <LinksDoArquivo
                url={tarefa.url}
                pdf={tarefa.pdf}
                texto={tarefa.pdf ? 'Abrir PDF do relatório' : 'Baixar DOCX do relatório'}
                nome={tarefa.nome ?? (tarefa.pdf ? 'relatorio_pesquisa.pdf' : 'relatorio_pesquisa.docx')}
              />
            )}
            {q.data.atualizadoEm && (
              <div className="small text-secondary">Salvo em {dataHora(q.data.atualizadoEm)}</div>
            )}
            <div role="status" aria-live="polite" className="small">
              {aviso && <span className="text-success">{aviso}</span>}
            </div>
            <ErroAlerta
              erro={
                salvar.error
                  ? mensagemDeErro(salvar.error)
                  : verPrevia.error
                    ? mensagemDeErro(verPrevia.error)
                    : tarefa.erro
              }
            />
          </div>
        </div>
      </div>

      <div className="col-lg-8 col-xl-9">
        <h2 className="h4 mb-1">Relatório de pesquisa</h2>
        <p className="text-secondary">
          Os dados do projeto entram sozinhos em cada seção: protocolo, revisão, buscas, triagem, estudos incluídos,
          análises, checklist e o <Link to="../cronograma">cronograma</Link>. Escreva abaixo só o que o banco não tem.
          Os textos ficam salvos por revisão.
        </p>
        {faltam.length > 0 && (
          <div className="alert alert-info small" role="note">
            <i className="bi bi-info-circle me-1" aria-hidden="true" />
            Ainda sem texto: {faltam.join(', ')}.{' '}
            {opcoes.orientacoes
              ? 'No relatório, esses pontos saem com a orientação em itálico.'
              : 'No relatório, esses pontos ficam em branco.'}
          </div>
        )}

        {SECOES.filter((s) => CAMPOS.some((c) => c.secao === s) || s === 'analise').map((s) => {
          const campos = CAMPOS.filter((c) => c.secao === s);
          if (s === 'analise' && !questoes.length) return null;
          return (
            <fieldset key={s} className={`card mb-3 ${inclui(s) ? '' : 'opacity-50'}`} disabled={!edita}>
              <div className="card-body">
                <legend className="h5 mb-1">{NOME_SECAO[s]}</legend>
                <p className="small text-secondary mb-3">
                  Do projeto: {ORIGEM_SECAO[s]}.{!inclui(s) && ' Seção fora do relatório.'}
                </p>
                {campos.map((c) => (
                  <div className="mb-3" key={c.campo}>
                    <label className="form-label fw-semibold" htmlFor={`rel-${c.campo}`}>
                      {c.rotulo}
                    </label>
                    <textarea
                      id={`rel-${c.campo}`}
                      className="form-control"
                      rows={c.linhas ?? 5}
                      maxLength={50_000}
                      value={textos[c.campo] ?? ''}
                      placeholder={c.orientacao}
                      aria-describedby={`rel-${c.campo}-ajuda`}
                      onChange={(e) => mudarCampo(c.campo, e.target.value)}
                    />
                    <div id={`rel-${c.campo}-ajuda`} className="form-text">
                      {c.orientacao}
                      {c.campo === 'resumoAchados' && (
                        <span className={palavrasResumo > 180 ? 'text-warning-emphasis' : ''}>
                          {' '}
                          {palavrasResumo} palavra(s) nos seus textos do resumo; objetivo, método e números já vêm do
                          projeto.
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {s === 'analise' &&
                  questoes.map((qa) => (
                    <div className="mb-3" key={qa.id}>
                      <label className="form-label fw-semibold" htmlFor={`rel-sintese-${qa.codigo}`}>
                        Síntese {qa.codigo} — {qa.enunciado}
                      </label>
                      <textarea
                        id={`rel-sintese-${qa.codigo}`}
                        className="form-control"
                        rows={4}
                        maxLength={50_000}
                        value={textos.sintese?.[qa.codigo] ?? ''}
                        placeholder={ORIENTACAO_SINTESE}
                        onChange={(e) =>
                          mudarTextos({ ...textos, sintese: { ...textos.sintese, [qa.codigo]: e.target.value } })
                        }
                      />
                    </div>
                  ))}
              </div>
            </fieldset>
          );
        })}

        {previa && (
          <section aria-labelledby="rel-previa" className="mb-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 id="rel-previa" className="h5 mb-0">
                Prévia
              </h2>
              <button type="button" className="btn btn-sm btn-link" onClick={() => setPrevia(null)}>
                Fechar prévia
              </button>
            </div>
            <iframe
              title="Prévia do relatório de pesquisa"
              className="w-100 border rounded bg-white"
              style={{ height: '80vh' }}
              sandbox=""
              srcDoc={previa}
            />
          </section>
        )}
      </div>
    </div>
  );
}
