import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, get, mensagemDeErro, put } from '../../lib/api';
import { dataHora } from '../../lib/formato';
import { Carregando, ErroAlerta } from '../../components/ui';
import { useProjetoAtual } from './ProjetoLayout';
import {
  AVISO_TEXTO_BASE,
  citacao,
  completarRascunho,
  DECLARACOES,
  modeloDeclaracao,
  FRASE_CAPES,
  ITENS_INTRODUCAO,
  MARCADOR_FUNDACOES,
  modeloAgradecimentos,
  modeloDeclaracaoIa,
  montarDocumento,
  nomeFerramenta,
  rotuloResumo,
  textoMetodologia,
  textoRevisao,
  type DadosArtigo,
  type DocAnalisado,
  type FontesArtigo,
} from './artigoLogica';

type Resposta = { dados: Partial<DadosArtigo> | null; atualizadoEm: string | null; fontes: FontesArtigo };

/** Textos que guiam o autor em cada seção */
export const GUIA: Record<string, ReactNode> = {
  titulo: (
    <>
      Claro, específico e informativo (de 10 a 20 palavras). Diga o objeto, o contexto e, se couber, o método. Evite
      siglas e abreviações. Vem do cadastro do projeto e pode ser ajustado aqui só para o artigo.
    </>
  ),
  autores: (
    <>
      O autor principal (quem criou o projeto) vem primeiro, seguido dos membros. Instituição, e-mail e ORCID vêm do
      perfil de cada pessoa: quem estiver com dados em falta deve completar o próprio perfil. Inclua só quem contribuiu
      de forma significativa (Portaria CNPq nº 2.664/2026, art. 9º, II, “p” e “q”).
    </>
  ),
  resumo: (
    <>
      Vem do resumo do protocolo, em cada idioma, com as palavras-chave do idioma. Um bom resumo de artigo traz
      objetivo, método, principais resultados e conclusão em 150 a 250 palavras, no passado. Para mudar o texto, edite o
      passo “Resumo” do <Link to="../protocolo">protocolo</Link>.
    </>
  ),
  introducao: (
    <>
      Contextualize o tema, mostre o problema e a lacuna na literatura e termine com a questão de pesquisa, os objetivos
      e a justificativa. Escreva abaixo o texto de abertura; os itens marcados entram depois dele, já redigidos a partir
      do protocolo.
    </>
  ),
  fundamentacao: (
    <>
      Conceitos e teorias que sustentam o estudo. Aqui entram os <strong>resumos do assunto</strong> escritos (ou
      gerados com IA) na análise dos textos de revisões anteriores e do referencial teórico, e não os resumos
      (abstracts) originais dos documentos. Use-os como ponto de partida: relacione as ideias com suas palavras e cite
      os autores.
    </>
  ),
  metodologia: (
    <>
      Tipo de pesquisa, etapas e procedimentos, com detalhe suficiente para que outra pessoa consiga reproduzir o
      estudo. O texto inicial vem da metodologia do protocolo.
    </>
  ),
  revisao: (
    <>
      Montada a partir das revisões do projeto: bases, strings de busca, critérios e os números de cada etapa (F1, F2,
      F3), os mesmos do diagrama de fluxo. Logo depois do texto entra um quadro com os artigos incluídos (selecionados
      nas buscas, de revisão anterior e integrados), com autor e ano, título, periódico e origem. Confira os números e,
      se o periódico pedir, inclua o diagrama como figura.
    </>
  ),
  analise: (
    <>
      O que os estudos incluídos mostram, organizado por questão de pesquisa ou por categoria. Os resumos do assunto dos
      documentos analisados (escritos ou gerados com IA na análise) podem entrar como base. Depois, sintetize e compare
      os estudos em vez de só listá-los.
    </>
  ),
  discussao: (
    <>
      Interprete os resultados à luz da fundamentação teórica: semelhanças e divergências com outros estudos, limitações
      e implicações para a pesquisa e a prática. Os pontos de discussão registrados nas análises podem ser incluídos.
    </>
  ),
  conclusoes: (
    <>
      Retome o objetivo e responda à questão de pesquisa. Destaque as contribuições, as limitações e as sugestões de
      trabalhos futuros. Não apresente dados novos.
    </>
  ),
  agradecimentos: (
    <>
      Agradeça às agências de fomento (com o número do processo), às instituições e às pessoas que apoiaram o trabalho.
      O nome escrito no campo “Fundações” substitui {MARCADOR_FUNDACOES} no texto. Bolsistas CAPES devem incluir a frase
      obrigatória.
    </>
  ),
  declaracaoIa: (
    <>
      Exigida pela Portaria CNPq nº 2.664/2026 (art. 9º, I, “c”, “d” e “f”): informe a ferramenta, a fase (concepção,
      redação, análise de dados, submissão) e a finalidade de cada uso de IA Generativa. A lista vem dos usos de IA
      registrados neste projeto; acrescente os usos feitos fora do Konektron. A portaria não traz um texto oficial: este
      é um modelo não oficial que segue os requisitos dela e deve ser revisado pelos autores.
    </>
  ),
  declaracoes: (
    <>
      Declarações que a Portaria CNPq nº 2.664/2026 pede para a publicação: contribuição de cada autor (art. 9º, II, “p”
      a “s”), conflito de interesses, disponibilidade dos dados em repositório confiável (art. 9º, I, “g”) e divulgação
      prévia ou versões anteriores (art. 9º, II, “e” e “u”). Os textos são modelos não oficiais: troque o que está entre
      colchetes e confira as exigências do periódico.
    </>
  ),
  referencias: (
    <>
      Vêm da aba <Link to="../referencias">Referências</Link> do projeto, em ordem alfabética. Confira se todas as obras
      citadas no texto estão na lista e se todas as da lista foram citadas.
    </>
  ),
};

const SECOES = [
  ['titulo', 'Título e subtítulo'],
  ['autores', 'Autores'],
  ['resumo', 'Resumo'],
  ['introducao', 'Introdução'],
  ['fundamentacao', 'Fundamentação teórica'],
  ['metodologia', 'Metodologia'],
  ['revisao', 'Revisão de literatura'],
  ['analise', 'Análise'],
  ['discussao', 'Discussão'],
  ['conclusoes', 'Conclusões'],
  ['agradecimentos', 'Agradecimentos'],
  ['declaracoes', 'Declarações (autoria, dados…)'],
  ['declaracaoIa', 'Declaração de uso de IA'],
  ['referencias', 'Referências'],
] as const;

function Secao({
  id,
  titulo,
  children,
  acoes,
  base,
}: {
  id: string;
  titulo: string;
  children: ReactNode;
  acoes?: ReactNode;
  /** a seção traz texto montado pelo sistema (modelo, protocolo, resumos do assunto ou IA) */
  base?: boolean;
}) {
  return (
    <section className="card mb-3" id={`artigo-${id}`} aria-labelledby={`artigo-${id}-titulo`}>
      <div className="card-header d-flex flex-wrap align-items-center gap-2">
        <h2 id={`artigo-${id}-titulo`} className="h6 mb-0 me-auto">
          {titulo}
        </h2>
        {acoes}
      </div>
      <div className="card-body">
        <div className="alert alert-light border small py-2 mb-3">
          <i className="bi bi-lightbulb me-1 text-warning" aria-hidden="true" />
          {GUIA[id]}
        </div>
        {base && (
          <p className="small k-texto-base mb-3">
            <i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />
            <strong>Texto-base, não oficial:</strong> o que o sistema monta nesta seção serve só para revisão. Reescreva
            com suas palavras antes de submeter.
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

function Texto({
  id,
  rotulo,
  valor,
  aoMudar,
  linhas = 6,
  dica,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  linhas?: number;
  dica?: string;
}) {
  return (
    <div className="mb-2">
      <label htmlFor={id} className="form-label small fw-medium">
        {rotulo}
      </label>
      <textarea
        id={id}
        className="form-control"
        rows={linhas}
        value={valor}
        aria-describedby={`${id}-dica`}
        onChange={(e) => aoMudar(e.target.value)}
      />
      <div id={`${id}-dica`} className="form-text">
        {dica ?? 'Separe os parágrafos com uma linha em branco. Linhas começando com “- ” viram lista.'}
      </div>
    </div>
  );
}

function BotaoRestaurar({ aoClicar, texto = 'Refazer a partir do projeto' }: { aoClicar: () => void; texto?: string }) {
  return (
    <button
      type="button"
      className="btn btn-outline-secondary btn-sm"
      onClick={() => {
        if (
          window.confirm('Substituir o texto desta seção pelo gerado a partir do projeto? O texto atual será perdido.')
        )
          aoClicar();
      }}
    >
      <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
      {texto}
    </button>
  );
}

/** Lista de documentos analisados com caixa de marcar e o resumo do assunto */
function ListaDocs({
  id,
  docs,
  marcados,
  aoMudar,
  vazio,
}: {
  id: string;
  docs: DocAnalisado[];
  marcados: string[];
  aoMudar: (ids: string[]) => void;
  vazio: ReactNode;
}) {
  if (!docs.length) return <p className="small text-secondary mb-0">{vazio}</p>;
  const todos = docs.every((d) => marcados.includes(d.id));
  return (
    <fieldset>
      <legend className="small fw-medium">
        Resumos do assunto para incluir ({marcados.filter((m) => docs.some((d) => d.id === m)).length} de {docs.length})
      </legend>
      <div className="form-check small mb-1">
        <input
          id={`${id}-todos`}
          type="checkbox"
          className="form-check-input"
          checked={todos}
          onChange={() =>
            aoMudar(
              todos
                ? marcados.filter((m) => !docs.some((d) => d.id === m))
                : [...new Set([...marcados, ...docs.map((d) => d.id)])],
            )
          }
        />
        <label htmlFor={`${id}-todos`} className="form-check-label">
          Marcar todos
        </label>
      </div>
      <ul className="list-unstyled d-grid gap-2 mb-0" style={{ maxHeight: 360, overflow: 'auto' }}>
        {docs.map((d) => (
          <li key={d.id} className="border rounded p-2 small">
            <div className="form-check mb-0">
              <input
                id={`${id}-${d.id}`}
                type="checkbox"
                className="form-check-input"
                checked={marcados.includes(d.id)}
                onChange={(e) => aoMudar(e.target.checked ? [...marcados, d.id] : marcados.filter((m) => m !== d.id))}
              />
              <label htmlFor={`${id}-${d.id}`} className="form-check-label fw-medium">
                {d.titulo} <span className="text-secondary fw-normal">{citacao(d.autores, d.ano)}</span>
              </label>
            </div>
            <details className="ms-4">
              <summary className="text-secondary">Resumo do assunto ({d.analiseNome})</summary>
              <p className="mb-0 mt-1 k-leitura">{d.resumoAssunto}</p>
            </details>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

async function baixarDocx(projetoId: string, documento: ReturnType<typeof montarDocumento>) {
  const r = await api.post(`/projetos/${projetoId}/artigo/docx`, documento, { responseType: 'blob', timeout: 120_000 });
  const nome = /filename="([^"]+)"/.exec(String(r.headers['content-disposition'] ?? ''))?.[1] ?? 'artigo.docx';
  const url = URL.createObjectURL(r.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Gerador de artigo em Word (DOCX) a partir do projeto, com guia em cada seção */
export default function Artigo() {
  const { projeto, edita } = useProjetoAtual();
  const qc = useQueryClient();
  const chave = ['projeto', projeto.id, 'artigo'];
  const q = useQuery({ queryKey: chave, queryFn: () => get<Resposta>(`/projetos/${projeto.id}/artigo`) });
  const [d, setD] = useState<DadosArtigo | null>(null);
  const [alterado, setAlterado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const f = q.data?.fontes;

  useEffect(() => {
    if (q.data && !d) setD(completarRascunho(q.data.dados, q.data.fontes));
  }, [q.data, d]);

  // aviso ao sair com alterações não salvas
  useEffect(() => {
    if (!alterado) return;
    const antes = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', antes);
    return () => window.removeEventListener('beforeunload', antes);
  }, [alterado]);

  const salvar = useMutation({
    mutationFn: (dados: DadosArtigo) => put<{ atualizadoEm: string }>(`/projetos/${projeto.id}/artigo`, { dados }),
    onSuccess: (r) => {
      setAlterado(false);
      setAviso(`Rascunho salvo em ${dataHora(r.atualizadoEm)}.`);
      qc.setQueryData<Resposta>(chave, (v) => (v ? { ...v, atualizadoEm: r.atualizadoEm } : v));
    },
  });
  const gerar = useMutation({
    mutationFn: async () => {
      if (edita && alterado) await salvar.mutateAsync(d!);
      await baixarDocx(projeto.id, montarDocumento(d!, f!));
    },
    onSuccess: () => setAviso('Artigo gerado em Word (DOCX). Revise o arquivo antes de submeter.'),
  });

  const documento = useMemo(() => (d && f ? montarDocumento(d, f) : null), [d, f]);
  if (q.isLoading || (q.data && !d)) return <Carregando />;
  if (q.error || !f || !d) return <ErroAlerta erro={q.error ?? 'Não foi possível carregar o artigo'} />;

  const mudar = (parcial: Partial<DadosArtigo>) => {
    setD({ ...d, ...parcial });
    setAlterado(true);
    setAviso(null);
  };
  const autoresPorId = new Map(f.autores.map((a) => [a.usuarioId, a]));
  const teoricos = f.analisados.filter((x) => x.teorico);
  const outros = f.analisados.filter((x) => !x.teorico);
  const palavras =
    documento?.secoes.reduce(
      (s, x) =>
        s +
        x.blocos.reduce(
          (t, b) => t + `${b.texto ?? ''} ${(b.itens ?? []).join(' ')}`.split(/\s+/).filter(Boolean).length,
          0,
        ),
      0,
    ) ?? 0;

  return (
    <div className="row g-4">
      <div className="col-lg-3">
        <nav aria-label="Seções do artigo" className="position-sticky" style={{ top: '1rem' }}>
          <ol className="list-unstyled small d-grid gap-1 mb-3">
            {SECOES.map(([id, nome]) => (
              <li key={id}>
                <a href={`#artigo-${id}`}>{nome}</a>
              </li>
            ))}
          </ol>
          <div className="d-grid gap-2">
            {edita && (
              <button
                className="btn btn-outline-primary"
                disabled={salvar.isPending || !alterado}
                onClick={() => salvar.mutate(d)}
              >
                <i className="bi bi-save me-1" aria-hidden="true" />
                {alterado ? 'Salvar rascunho' : 'Rascunho salvo'}
              </button>
            )}
            <button className="btn btn-primary" disabled={gerar.isPending} onClick={() => gerar.mutate()}>
              {gerar.isPending ? (
                <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
              ) : (
                <i className="bi bi-file-earmark-word me-1" aria-hidden="true" />
              )}
              Gerar artigo (DOCX)
            </button>
            <div className="small text-secondary">
              Cerca de {palavras.toLocaleString('pt-BR')} palavras
              {q.data?.atualizadoEm && <> · salvo em {dataHora(q.data.atualizadoEm)}</>}
            </div>
            <div role="status" aria-live="polite" className="small">
              {aviso && <span className="text-success">{aviso}</span>}
            </div>
            <ErroAlerta
              erro={salvar.error ? mensagemDeErro(salvar.error) : gerar.error ? mensagemDeErro(gerar.error) : null}
            />
          </div>
        </nav>
      </div>

      <div className="col-lg-9">
        <p className="text-secondary">
          Monte o artigo a partir dos dados do projeto. Cada seção traz uma orientação, o que veio do projeto e um campo
          para o seu texto. O rascunho fica salvo no projeto e o arquivo final sai em Word (.docx), com Times New Roman
          12.
        </p>
        <div className="alert alert-warning small" role="note">
          <i className="bi bi-exclamation-triangle-fill me-1" aria-hidden="true" />
          <strong>Atenção:</strong> {AVISO_TEXTO_BASE}
          <div className="form-check mt-2 mb-0">
            <input
              id="art-destacar"
              type="checkbox"
              className="form-check-input"
              checked={d.destacarGerados}
              onChange={(e) => mudar({ destacarGerados: e.target.checked })}
            />
            <label htmlFor="art-destacar" className="form-check-label">
              Destacar em amarelo, no Word, os trechos montados pelo sistema que ainda não foram reescritos (o que você
              alterar aqui deixa de ser destacado)
            </label>
          </div>
        </div>

        <Secao id="titulo" titulo="Título e subtítulo">
          <div className="mb-2">
            <label htmlFor="art-titulo" className="form-label small fw-medium">
              Título
            </label>
            <input
              id="art-titulo"
              className="form-control"
              value={d.titulo}
              onChange={(e) => mudar({ titulo: e.target.value })}
            />
          </div>
          <label htmlFor="art-subtitulo" className="form-label small fw-medium">
            Subtítulo
          </label>
          <input
            id="art-subtitulo"
            className="form-control"
            value={d.subtitulo}
            placeholder={
              f.projeto.subtitulo ? undefined : 'Cadastre o subtítulo em Visão geral › Editar, ou escreva aqui'
            }
            onChange={(e) => mudar({ subtitulo: e.target.value })}
          />
          <button
            type="button"
            className="btn btn-link btn-sm px-0"
            onClick={() => mudar({ titulo: f.projeto.titulo, subtitulo: f.projeto.subtitulo ?? '' })}
          >
            Usar o título e o subtítulo do projeto
          </button>
        </Secao>

        <Secao id="autores" titulo="Autores">
          <ol className="list-unstyled d-grid gap-2 mb-0">
            {d.autores.map((a, i) => {
              const x = autoresPorId.get(a.usuarioId);
              if (!x) return null;
              const falta = [!x.instituicao && 'instituição', !x.orcid && 'ORCID'].filter(Boolean) as string[];
              const mover = (k: number) => {
                const l = [...d.autores];
                [l[i], l[i + k]] = [l[i + k], l[i]];
                mudar({ autores: l });
              };
              return (
                <li key={a.usuarioId} className="border rounded p-2 d-flex flex-wrap gap-2 align-items-start">
                  <div className="form-check mb-0 me-auto">
                    <input
                      id={`autor-${a.usuarioId}`}
                      type="checkbox"
                      className="form-check-input"
                      checked={a.incluir}
                      onChange={(e) =>
                        mudar({
                          autores: d.autores.map((y) =>
                            y.usuarioId === a.usuarioId ? { ...y, incluir: e.target.checked } : y,
                          ),
                        })
                      }
                    />
                    <label htmlFor={`autor-${a.usuarioId}`} className="form-check-label">
                      <strong>{x.nome}</strong>
                      {x.principal && <span className="badge text-bg-primary ms-2">Autor principal</span>}
                      <span className="d-block small text-secondary">
                        {[x.instituicao, x.email, x.orcid && `ORCID ${x.orcid}`].filter(Boolean).join(' · ')}
                      </span>
                      {!!falta.length && (
                        <span className="d-block small k-incompleto">
                          <i className="bi bi-exclamation-circle me-1" aria-hidden="true" />
                          Sem {falta.join(' e ')} no perfil
                        </span>
                      )}
                    </label>
                  </div>
                  <div className="btn-group btn-group-sm">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={i === 0}
                      aria-label={`Subir ${x.nome}`}
                      onClick={() => mover(-1)}
                    >
                      <i className="bi bi-arrow-up" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={i === d.autores.length - 1}
                      aria-label={`Descer ${x.nome}`}
                      onClick={() => mover(1)}
                    >
                      <i className="bi bi-arrow-down" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </Secao>

        <Secao id="resumo" titulo="Resumo">
          {f.protocolo?.resumos.length ? (
            <>
              {f.protocolo.resumos.map((r) => {
                const [rotulo, rotuloPc] = rotuloResumo(r.idiomaCodigo, r.idiomaNome);
                const pcs = f.protocolo!.palavrasChave.filter((k) => k.idiomaId === r.idiomaId).map((k) => k.termo);
                return (
                  <div key={r.idiomaId} className="border rounded p-2 mb-2">
                    <div className="form-check">
                      <input
                        id={`resumo-${r.idiomaId}`}
                        type="checkbox"
                        className="form-check-input"
                        checked={d.resumoIdiomas.includes(r.idiomaId)}
                        onChange={(e) =>
                          mudar({
                            resumoIdiomas: e.target.checked
                              ? [...d.resumoIdiomas, r.idiomaId]
                              : d.resumoIdiomas.filter((x) => x !== r.idiomaId),
                          })
                        }
                      />
                      <label htmlFor={`resumo-${r.idiomaId}`} className="form-check-label fw-medium">
                        {rotulo} ({r.idiomaNome})
                      </label>
                    </div>
                    <p className="small k-leitura mb-1">{r.texto}</p>
                    {!!pcs.length && (
                      <p className="small mb-0">
                        <strong>{rotuloPc}:</strong> {pcs.join('; ')}
                      </p>
                    )}
                  </div>
                );
              })}
              <div className="form-check">
                <input
                  id="art-pc"
                  type="checkbox"
                  className="form-check-input"
                  checked={d.palavrasChave}
                  onChange={(e) => mudar({ palavrasChave: e.target.checked })}
                />
                <label htmlFor="art-pc" className="form-check-label small">
                  Incluir as palavras-chave de cada idioma
                </label>
              </div>
            </>
          ) : (
            <p className="small k-incompleto mb-0">
              O protocolo não tem resumo. Escreva-o no passo “Resumo” do protocolo.
            </p>
          )}
        </Secao>

        <Secao base id="introducao" titulo="Introdução">
          <Texto
            id="art-intro"
            rotulo="Texto de abertura (contexto, problema e lacuna)"
            valor={d.introducao.texto}
            aoMudar={(v) => mudar({ introducao: { ...d.introducao, texto: v } })}
          />
          <fieldset>
            <legend className="small fw-medium">Incluir na introdução, a partir do protocolo</legend>
            <div className="row row-cols-1 row-cols-md-2 g-1">
              {ITENS_INTRODUCAO.map(([k, nome]) => (
                <div className="col" key={k}>
                  <div className="form-check small mb-0">
                    <input
                      id={`intro-${k}`}
                      type="checkbox"
                      className="form-check-input"
                      checked={d.introducao.incluir.includes(k)}
                      onChange={(e) =>
                        mudar({
                          introducao: {
                            ...d.introducao,
                            incluir: e.target.checked
                              ? [...d.introducao.incluir, k]
                              : d.introducao.incluir.filter((x) => x !== k),
                          },
                        })
                      }
                    />
                    <label htmlFor={`intro-${k}`} className="form-check-label">
                      {nome}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
          <Previa titulo="Introdução" documento={documento} />
        </Secao>

        <Secao base id="fundamentacao" titulo="Fundamentação teórica">
          <Texto
            id="art-fund"
            rotulo="Seu texto"
            valor={d.fundamentacao.texto}
            aoMudar={(v) => mudar({ fundamentacao: { ...d.fundamentacao, texto: v } })}
          />
          <ListaDocs
            id="fund"
            docs={teoricos}
            marcados={d.fundamentacao.documentos}
            aoMudar={(ids) => mudar({ fundamentacao: { ...d.fundamentacao, documentos: ids } })}
            vazio="Nenhum resumo do assunto de textos de revisão anterior ou do referencial teórico. Escreva-os nas análises (aba Análises) para trazê-los para cá."
          />
        </Secao>

        <Secao
          base
          id="metodologia"
          titulo="Metodologia"
          acoes={<BotaoRestaurar aoClicar={() => mudar({ metodologia: { texto: textoMetodologia(f) } })} />}
        >
          <Texto
            id="art-metodo"
            rotulo="Texto da seção"
            linhas={8}
            valor={d.metodologia.texto}
            aoMudar={(v) => mudar({ metodologia: { texto: v } })}
          />
        </Secao>

        <Secao
          base
          id="revisao"
          titulo="Revisão de literatura"
          acoes={<BotaoRestaurar aoClicar={() => mudar({ revisao: { ...d.revisao, texto: textoRevisao(f) } })} />}
        >
          {f.revisoes.length ? (
            <>
              <Texto
                id="art-revisao"
                rotulo="Texto da seção"
                linhas={10}
                valor={d.revisao.texto}
                aoMudar={(v) => mudar({ revisao: { ...d.revisao, texto: v } })}
              />
              <div className="form-check small">
                <input
                  id="art-tabela"
                  type="checkbox"
                  className="form-check-input"
                  checked={d.revisao.tabela}
                  onChange={(e) => mudar({ revisao: { ...d.revisao, tabela: e.target.checked } })}
                />
                <label htmlFor="art-tabela" className="form-check-label">
                  Incluir o quadro dos artigos incluídos:{' '}
                  {f.revisoes
                    .map((r) => {
                      const l = r.incluidos ?? [];
                      const n = (o: string) => l.filter((x) => x.origem === o).length;
                      return `${f.revisoes.length > 1 ? `${r.titulo}: ` : ''}${l.length} (${n('BUSCA') + n('MANUAL')} das buscas, ${n('REVISAO_ANTERIOR')} de revisão anterior, ${n('INTEGRADO')} integrados)`;
                    })
                    .join('; ')}
                </label>
              </div>
              <Previa titulo="Revisão de literatura" documento={documento} />
            </>
          ) : (
            <p className="small text-secondary mb-0">O projeto ainda não tem revisões de literatura.</p>
          )}
        </Secao>

        <Secao base id="analise" titulo="Análise">
          <Texto
            id="art-analise"
            rotulo="Seu texto"
            valor={d.analise.texto}
            aoMudar={(v) => mudar({ analise: { ...d.analise, texto: v } })}
          />
          <ListaDocs
            id="analise"
            docs={outros}
            marcados={d.analise.documentos}
            aoMudar={(ids) => mudar({ analise: { ...d.analise, documentos: ids } })}
            vazio="Nenhum resumo do assunto nos documentos analisados. Escreva-os ou gere-os com IA na análise de cada documento."
          />
        </Secao>

        <Secao base id="discussao" titulo="Discussão">
          <Texto
            id="art-discussao"
            rotulo="Seu texto"
            valor={d.discussao.texto}
            aoMudar={(v) => mudar({ discussao: { ...d.discussao, texto: v } })}
          />
          {f.discussoes.length ? (
            <fieldset>
              <legend className="small fw-medium">Pontos de discussão registrados nas análises</legend>
              <ul className="list-unstyled d-grid gap-2 mb-0" style={{ maxHeight: 320, overflow: 'auto' }}>
                {f.discussoes.map((x) => (
                  <li key={x.id} className="border rounded p-2 small">
                    <div className="form-check mb-0">
                      <input
                        id={`disc-${x.id}`}
                        type="checkbox"
                        className="form-check-input"
                        checked={d.discussao.itens.includes(x.id)}
                        onChange={(e) =>
                          mudar({
                            discussao: {
                              ...d.discussao,
                              itens: e.target.checked
                                ? [...d.discussao.itens, x.id]
                                : d.discussao.itens.filter((i) => i !== x.id),
                            },
                          })
                        }
                      />
                      <label htmlFor={`disc-${x.id}`} className="form-check-label">
                        <strong>{x.pontoPrincipal || x.titulo}</strong>{' '}
                        <span className="text-secondary">{citacao(x.autores, x.ano)}</span>
                        {x.discussao && <span className="d-block">{x.discussao}</span>}
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : (
            <p className="small text-secondary mb-0">Nenhum ponto de discussão registrado nas análises.</p>
          )}
        </Secao>

        <Secao id="conclusoes" titulo="Conclusões">
          <Texto
            id="art-conclusoes"
            rotulo="Texto da seção"
            linhas={8}
            valor={d.conclusoes.texto}
            aoMudar={(v) => mudar({ conclusoes: { texto: v } })}
          />
        </Secao>

        <Secao
          base
          id="agradecimentos"
          titulo="Agradecimentos"
          acoes={
            <BotaoRestaurar
              texto="Restaurar o modelo"
              aoClicar={() =>
                mudar({ agradecimentos: { ...d.agradecimentos, texto: modeloAgradecimentos(f.projeto.instituicao) } })
              }
            />
          }
        >
          <div className="mb-2">
            <label htmlFor="art-fundacoes" className="form-label small fw-medium">
              Fundações e agências de fomento (com o número do processo)
            </label>
            <input
              id="art-fundacoes"
              className="form-control"
              placeholder="Ex.: Fundação de Amparo à Pesquisa e Inovação do Estado de Santa Catarina (FAPESC), processo nº ..."
              value={d.agradecimentos.fundacoes}
              onChange={(e) => mudar({ agradecimentos: { ...d.agradecimentos, fundacoes: e.target.value } })}
            />
          </div>
          <Texto
            id="art-agradecimentos"
            rotulo="Texto"
            linhas={4}
            valor={d.agradecimentos.texto}
            aoMudar={(v) => mudar({ agradecimentos: { ...d.agradecimentos, texto: v } })}
            dica={`${MARCADOR_FUNDACOES} é trocado pelo que estiver no campo acima.`}
          />
          <div className="form-check small">
            <input
              id="art-capes"
              type="checkbox"
              className="form-check-input"
              checked={d.agradecimentos.capes}
              onChange={(e) => mudar({ agradecimentos: { ...d.agradecimentos, capes: e.target.checked } })}
            />
            <label htmlFor="art-capes" className="form-check-label">
              Incluir a frase obrigatória da CAPES: “{FRASE_CAPES}”
            </label>
          </div>
        </Secao>

        <Secao base id="declaracoes" titulo="Declarações (Portaria CNPq nº 2.664/2026)">
          {DECLARACOES.map(([k, nome, artigo]) => (
            <div key={k} className="border rounded p-2 mb-2">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <div className="form-check mb-0 me-auto">
                  <input
                    id={`decl-${k}`}
                    type="checkbox"
                    className="form-check-input"
                    checked={d.declaracoes[k].incluir}
                    onChange={(e) =>
                      mudar({
                        declaracoes: { ...d.declaracoes, [k]: { ...d.declaracoes[k], incluir: e.target.checked } },
                      })
                    }
                  />
                  <label htmlFor={`decl-${k}`} className="form-check-label fw-medium">
                    {nome} <span className="text-secondary fw-normal small">({artigo})</span>
                  </label>
                </div>
                <BotaoRestaurar
                  texto="Restaurar o modelo"
                  aoClicar={() =>
                    mudar({
                      declaracoes: {
                        ...d.declaracoes,
                        [k]: {
                          ...d.declaracoes[k],
                          texto: modeloDeclaracao(
                            k,
                            f,
                            d.autores.filter((a) => a.incluir).map((a) => autoresPorId.get(a.usuarioId)?.nome ?? ''),
                          ),
                        },
                      },
                    })
                  }
                />
              </div>
              {d.declaracoes[k].incluir && (
                <Texto
                  id={`decl-texto-${k}`}
                  rotulo={`Texto: ${nome.toLowerCase()}`}
                  linhas={4}
                  valor={d.declaracoes[k].texto}
                  aoMudar={(v) => mudar({ declaracoes: { ...d.declaracoes, [k]: { ...d.declaracoes[k], texto: v } } })}
                  dica="Troque o que estiver entre colchetes. Linhas começando com “- ” viram lista."
                />
              )}
            </div>
          ))}
        </Secao>

        <Secao
          base
          id="declaracaoIa"
          titulo="Declaração de uso de IA"
          acoes={
            <BotaoRestaurar
              texto="Restaurar o modelo"
              aoClicar={() =>
                mudar({ declaracaoIa: { ...d.declaracaoIa, texto: modeloDeclaracaoIa(d.declaracaoIa.usou, f.usosIa) } })
              }
            />
          }
        >
          <fieldset className="mb-2">
            <legend className="small fw-medium">Houve uso de IA Generativa no trabalho?</legend>
            {[true, false].map((usou) => (
              <div className="form-check form-check-inline small" key={String(usou)}>
                <input
                  id={`ia-${usou}`}
                  type="radio"
                  name="art-usou-ia"
                  className="form-check-input"
                  checked={d.declaracaoIa.usou === usou}
                  onChange={() => mudar({ declaracaoIa: { usou, texto: modeloDeclaracaoIa(usou, f.usosIa) } })}
                />
                <label htmlFor={`ia-${usou}`} className="form-check-label">
                  {usou ? 'Sim, houve uso' : 'Não houve uso'}
                </label>
              </div>
            ))}
          </fieldset>
          {f.usosIa.length > 0 && (
            <p className="small">
              <strong>Usos registrados no projeto:</strong>{' '}
              {f.usosIa.map((u) => `${nomeFerramenta(u)} (${u.vezes}×)`).join('; ')}.
              {!d.declaracaoIa.usou && (
                <span className="k-incompleto"> Há usos registrados: confira a resposta acima.</span>
              )}
            </p>
          )}
          <Texto
            id="art-ia"
            rotulo="Texto da declaração"
            linhas={10}
            valor={d.declaracaoIa.texto}
            aoMudar={(v) => mudar({ declaracaoIa: { ...d.declaracaoIa, texto: v } })}
            dica="Troque o que estiver entre colchetes, confira a fase e descreva a finalidade de cada uso (ex.: revisão linguística, tradução, resumo do assunto, organização de dados)."
          />
        </Secao>

        <Secao id="referencias" titulo="Referências">
          <fieldset className="mb-2">
            <legend className="small fw-medium">Estilo</legend>
            {(['ABNT', 'APA'] as const).map((e) => (
              <div className="form-check form-check-inline small" key={e}>
                <input
                  id={`ref-${e}`}
                  type="radio"
                  name="art-estilo"
                  className="form-check-input"
                  checked={d.referencias.estilo === e}
                  onChange={() => mudar({ referencias: { ...d.referencias, estilo: e } })}
                />
                <label htmlFor={`ref-${e}`} className="form-check-label">
                  {e === 'ABNT' ? 'ABNT NBR 6023' : 'APA 7ª ed.'}
                </label>
              </div>
            ))}
          </fieldset>
          {f.referencias.length ? (
            <details>
              <summary className="small">
                {f.referencias.length - d.referencias.excluidas.length} de {f.referencias.length} referências incluídas
              </summary>
              <ul className="list-unstyled d-grid gap-1 mt-2 mb-0" style={{ maxHeight: 360, overflow: 'auto' }}>
                {f.referencias.map((r) => (
                  <li key={r.id} className="form-check small">
                    <input
                      id={`ref-${r.id}`}
                      type="checkbox"
                      className="form-check-input"
                      checked={!d.referencias.excluidas.includes(r.id)}
                      onChange={(e) =>
                        mudar({
                          referencias: {
                            ...d.referencias,
                            excluidas: e.target.checked
                              ? d.referencias.excluidas.filter((x) => x !== r.id)
                              : [...d.referencias.excluidas, r.id],
                          },
                        })
                      }
                    />
                    <label htmlFor={`ref-${r.id}`} className="form-check-label">
                      {(d.referencias.estilo === 'APA' ? r.apa || r.abnt : r.abnt || r.apa) ?? '—'}
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="small k-incompleto mb-0">Nenhuma referência no projeto.</p>
          )}
        </Secao>
      </div>
    </div>
  );
}

/** Prévia do texto montado de uma seção (como vai para o Word) */
function Previa({ titulo, documento }: { titulo: string; documento: ReturnType<typeof montarDocumento> | null }) {
  const s = documento?.secoes.find((x) => x.titulo.replace(/^\d+\s+/, '') === titulo);
  return (
    <details className="mt-2">
      <summary className="small">Prévia da seção no artigo</summary>
      {s ? (
        <div className="border rounded p-2 mt-1 small k-leitura bg-body-tertiary">
          <strong>{s.titulo}</strong>
          {s.blocos.map((b, i) =>
            b.tipo === 'tabela' ? (
              <div key={i} className="mb-2">
                <div className="fw-medium">{b.texto}</div>
                <div className="table-responsive" style={{ maxHeight: 260 }}>
                  <table className="table table-sm table-bordered mb-1">
                    <thead>
                      <tr>
                        {b.cabecalho?.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {b.linhas?.map((l, j) => (
                        <tr key={j}>
                          {l.map((c, k) => (
                            <td key={k}>{c}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-secondary">{b.fonte}</div>
              </div>
            ) : b.tipo === 'lista' ? (
              <ul key={i} className="mb-2">
                {b.itens?.map((x, j) => (
                  <li key={j}>{x}</li>
                ))}
              </ul>
            ) : (
              <p key={i} className="mb-2">
                {b.gerado ? <mark title="Montado pelo sistema: reescreva com suas palavras">{b.texto}</mark> : b.texto}
              </p>
            ),
          )}
        </div>
      ) : (
        <p className="small text-secondary mt-1 mb-0">A seção ainda está vazia e não entra no artigo.</p>
      )}
    </details>
  );
}
