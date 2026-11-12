import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, mensagemDeErro, put } from '../../lib/api';
import { dataHora } from '../../lib/formato';
import { Carregando, ErroAlerta, IndicadorSalvo } from '../../components/ui';
import { LinksDoArquivo, useTarefa } from '../../components/BotaoTarefa';
import { useProjetoAtual } from './ProjetoLayout';
import {
  anosDe,
  completarCronograma,
  ETAPAS_PESQUISA,
  GRANULARIDADES,
  intervaloDaEtapa,
  LISTA_GRANULARIDADES,
  marcacoesForaDosAnos,
  marcarPeriodo,
  MAX_ANOS,
  mesCurto,
  moverEtapa,
  novaEtapa,
  paraSalvar,
  periodoMarcado,
  periodosDoAno,
  preencherPelasDatas,
  type DadosCronograma,
  type EtapaCronograma,
  type Granularidade,
  type Periodo,
  type SugestoesCronograma,
} from './cronogramaLogica';

type Resposta = { dados: DadosCronograma | null; atualizadoEm: string | null; sugestoes: SugestoesCronograma };
type Estado = 'ocioso' | 'salvando' | 'salvo' | 'erro';

/** Anos por bloco na tela: até 12 colunas de período por tabela, como na impressão */
const anosPorBloco = (g: Granularidade) =>
  g === 'ANUAL' ? MAX_ANOS : Math.max(1, Math.floor(12 / GRANULARIDADES[g].porAno));

/**
 * Cronograma das etapas do projeto: o usuário escolhe as etapas (das revisões, típicas de pesquisa ou
 * livres), a granularidade (mensal a anual) e os anos, e pinta de verde os períodos de execução —
 * clicando, arrastando ou com Shift + clique para um intervalo. Salva sozinho e imprime em PDF ou Word.
 */
export default function Cronograma() {
  const { projeto, edita } = useProjetoAtual();
  const qc = useQueryClient();
  const chave = useMemo(() => ['projeto', projeto.id, 'cronograma'], [projeto.id]);
  const q = useQuery({ queryKey: chave, queryFn: () => get<Resposta>(`/projetos/${projeto.id}/cronograma`) });
  const [d, setD] = useState<DadosCronograma | null>(null);
  const [alterado, setAlterado] = useState(false);
  const [estado, setEstado] = useState<Estado>('ocioso');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [etapaRevisao, setEtapaRevisao] = useState('');
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);

  useEffect(() => {
    if (q.data && !d) {
      setD(completarCronograma(q.data.dados, q.data.sugestoes));
      setAtualizadoEm(q.data.atualizadoEm);
    }
  }, [q.data, d]);

  const salvar = async (dados: DadosCronograma) => {
    setEstado('salvando');
    setErro(null);
    try {
      const r = await put<{ atualizadoEm: string }>(`/projetos/${projeto.id}/cronograma`, { dados: paraSalvar(dados) });
      setAlterado(false);
      setEstado('salvo');
      setAtualizadoEm(r.atualizadoEm);
      qc.setQueryData<Resposta>(chave, (v) =>
        v ? { ...v, dados: paraSalvar(dados), atualizadoEm: r.atualizadoEm } : v,
      );
      return true;
    } catch (e) {
      setEstado('erro');
      setErro(mensagemDeErro(e));
      return false;
    }
  };

  // salvamento automático 1,2 s depois da última mudança
  useEffect(() => {
    if (!edita || !alterado || !d) return;
    const t = setTimeout(() => void salvar(d), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, alterado, edita]);

  useEffect(() => {
    if (!alterado) return;
    const antes = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', antes);
    return () => window.removeEventListener('beforeunload', antes);
  }, [alterado]);

  if (q.isLoading || (q.data && !d)) return <Carregando />;
  if (q.error || !d || !q.data) return <ErroAlerta erro={q.error ?? 'Não foi possível carregar o cronograma'} />;
  const sugestoes = q.data.sugestoes;

  const mudar = (novo: DadosCronograma) => {
    setD(novo);
    setAlterado(true);
    setAviso(null);
  };
  const mudarEtapa = (id: string, f: (e: EtapaCronograma) => EtapaCronograma) =>
    mudar({ ...d, etapas: d.etapas.map((e) => (e.id === id ? f(e) : e)) });

  const mudarAnos = (anoInicio: number, anoFim: number) => {
    if (!Number.isFinite(anoInicio) || !Number.isFinite(anoFim)) return;
    const fim = Math.min(Math.max(anoFim, anoInicio), anoInicio + MAX_ANOS - 1);
    const fora = marcacoesForaDosAnos(d, anoInicio, fim);
    if (
      fora &&
      !window.confirm(
        `${fora} mês(es) marcado(s) ficam fora de ${anoInicio}–${fim} e serão descartados ao salvar. Continuar?`,
      )
    )
      return;
    mudar({ ...d, anoInicio, anoFim: fim });
  };

  const adicionar = (nome: string, origem: EtapaCronograma['origem'], revisaoEtapaId: string | null = null) => {
    if (!nome.trim()) return;
    if (d.etapas.length >= 100) return setAviso('O cronograma aceita até 100 etapas.');
    mudar({ ...d, etapas: [...d.etapas, novaEtapa(nome, origem, revisaoEtapaId)] });
  };
  const adicionarLivre = () => {
    const nome = novoNome.trim();
    if (!nome) return;
    adicionar(nome, ETAPAS_PESQUISA.includes(nome) ? 'PESQUISA' : 'LIVRE');
    setNovoNome('');
  };
  const jaNoCronograma = new Set(d.etapas.map((e) => e.revisaoEtapaId).filter(Boolean));
  const revisoes = [...new Map(sugestoes.etapasRevisao.map((e) => [e.revisaoId, e.revisaoTitulo])).entries()];
  const adicionarDaRevisao = (valor: string) => {
    if (valor.startsWith('todas:')) {
      const rid = valor.slice(6);
      const novas = sugestoes.etapasRevisao
        .filter((e) => e.revisaoId === rid && !jaNoCronograma.has(e.id))
        .map((e) => novaEtapa(revisoes.length > 1 ? `${e.nome} (${e.revisaoTitulo})` : e.nome, 'REVISAO', e.id));
      mudar({ ...d, etapas: [...d.etapas, ...novas].slice(0, 100) });
    } else {
      const e = sugestoes.etapasRevisao.find((x) => x.id === valor);
      if (e) adicionar(revisoes.length > 1 ? `${e.nome} (${e.revisaoTitulo})` : e.nome, 'REVISAO', e.id);
    }
    setEtapaRevisao('');
  };
  const preencher = () => {
    const r = preencherPelasDatas(d, sugestoes.etapasRevisao);
    if (r.preenchidas) mudar(r.dados);
    setAviso(
      r.preenchidas
        ? `${r.preenchidas} etapa(s) preenchida(s) com as datas de início e conclusão registradas nas revisões.`
        : 'Nenhuma etapa vinda das revisões tem data de início registrada dentro dos anos do cronograma.',
    );
  };

  const anos = anosDe(d);
  const blocos: number[][] = [];
  for (let i = 0; i < anos.length; i += anosPorBloco(d.granularidade))
    blocos.push(anos.slice(i, i + anosPorBloco(d.granularidade)));
  const anoAtual = new Date().getFullYear();
  const opcoesAno = Array.from({ length: 41 }, (_, i) => anoAtual - 25 + i);
  const marcadas = d.etapas.filter((e) => e.meses.length).length;

  return (
    <div>
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2">
        <div>
          <h2 className="h4 mb-1">Cronograma</h2>
          <p className="text-secondary small mb-0">
            Escolha as etapas e o período e marque em verde quando cada etapa será executada. O cronograma entra no{' '}
            <Link to="../relatorio">relatório de pesquisa</Link>.
          </p>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2">
          {edita && <IndicadorSalvo estado={estado} />}
          {atualizadoEm && estado !== 'salvando' && (
            <span className="small text-secondary">Atualizado em {dataHora(atualizadoEm)}</span>
          )}
          <ImprimirCronograma
            projetoId={projeto.id}
            antes={async () => (edita && alterado ? salvar(d) : true)}
            vazio={!d.etapas.length}
          />
        </div>
      </div>
      <ErroAlerta erro={erro} />

      <section className="card mb-3" aria-labelledby="crono-periodo">
        <div className="card-body">
          <h3 id="crono-periodo" className="h6 k-label mb-3">
            Período
          </h3>
          <div className="row g-3 align-items-end">
            <fieldset className="col-lg-7" disabled={!edita}>
              <legend className="form-label fs-6 mb-1">Granularidade</legend>
              <div className="btn-group flex-wrap" role="group">
                {LISTA_GRANULARIDADES.map((g) => (
                  <Fragment key={g}>
                    <input
                      type="radio"
                      className="btn-check"
                      name="crono-granularidade"
                      id={`crono-g-${g}`}
                      checked={d.granularidade === g}
                      onChange={() => mudar({ ...d, granularidade: g })}
                    />
                    <label className="btn btn-outline-primary btn-sm" htmlFor={`crono-g-${g}`}>
                      {GRANULARIDADES[g].rotulo}
                    </label>
                  </Fragment>
                ))}
              </div>
            </fieldset>
            <div className="col-6 col-lg-2">
              <label className="form-label" htmlFor="crono-ano-ini">
                Ano inicial
              </label>
              <select
                id="crono-ano-ini"
                className="form-select"
                value={d.anoInicio}
                disabled={!edita}
                onChange={(e) => {
                  const ini = Number(e.target.value);
                  mudarAnos(ini, Math.max(d.anoFim, ini));
                }}
              >
                {[...new Set([...opcoesAno, d.anoInicio])].sort().map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-lg-2">
              <label className="form-label" htmlFor="crono-ano-fim">
                Ano final
              </label>
              <select
                id="crono-ano-fim"
                className="form-select"
                value={d.anoFim}
                disabled={!edita}
                onChange={(e) => mudarAnos(d.anoInicio, Number(e.target.value))}
              >
                {Array.from({ length: MAX_ANOS }, (_, i) => d.anoInicio + i).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-check mt-3 mb-0">
            <input
              id="crono-ocultar"
              type="checkbox"
              className="form-check-input"
              checked={d.ocultarVazias !== false}
              disabled={!edita}
              onChange={(e) => mudar({ ...d, ocultarVazias: e.target.checked })}
            />
            <label className="form-check-label small" htmlFor="crono-ocultar">
              Na impressão, mostrar em cada bloco de anos só as etapas executadas nele (como no modelo do projeto de
              pesquisa)
            </label>
          </div>
        </div>
      </section>

      {edita && (
        <section className="card mb-3" aria-labelledby="crono-etapas">
          <div className="card-body">
            <h3 id="crono-etapas" className="h6 k-label mb-3">
              Etapas
            </h3>
            <div className="row g-3">
              <div className="col-lg-6">
                <label className="form-label" htmlFor="crono-nova">
                  Etapa da pesquisa ou outra etapa
                </label>
                <div className="input-group">
                  <input
                    id="crono-nova"
                    className="form-control"
                    list="crono-sugestoes"
                    maxLength={200}
                    value={novoNome}
                    placeholder="Ex.: Qualificação, Testes com usuários…"
                    onChange={(e) => setNovoNome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        adicionarLivre();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={adicionarLivre}
                    disabled={!novoNome.trim()}
                  >
                    <i className="bi bi-plus-lg me-1" aria-hidden="true" />
                    Adicionar
                  </button>
                </div>
                <datalist id="crono-sugestoes">
                  {ETAPAS_PESQUISA.filter((n) => !d.etapas.some((e) => e.nome === n)).map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <div className="d-flex flex-wrap gap-1 mt-2" aria-label="Sugestões de etapas de pesquisa">
                  {ETAPAS_PESQUISA.filter((n) => !d.etapas.some((e) => e.nome === n))
                    .slice(0, 8)
                    .map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => adicionar(n, 'PESQUISA')}
                      >
                        <i className="bi bi-plus me-1" aria-hidden="true" />
                        {n}
                      </button>
                    ))}
                </div>
              </div>
              <div className="col-lg-6">
                <label className="form-label" htmlFor="crono-revisao">
                  Etapa das revisões do projeto
                </label>
                {sugestoes.etapasRevisao.length ? (
                  <>
                    <select
                      id="crono-revisao"
                      className="form-select"
                      value={etapaRevisao}
                      onChange={(e) => {
                        setEtapaRevisao(e.target.value);
                        if (e.target.value) adicionarDaRevisao(e.target.value);
                      }}
                    >
                      <option value="">Escolha para adicionar…</option>
                      {revisoes.map(([rid, titulo]) => (
                        <optgroup key={rid} label={titulo}>
                          <option value={`todas:${rid}`}>Todas as etapas de “{titulo}”</option>
                          {sugestoes.etapasRevisao
                            .filter((e) => e.revisaoId === rid)
                            .map((e) => (
                              <option key={e.id} value={e.id} disabled={jaNoCronograma.has(e.id)}>
                                {e.ordem}. {e.nome}
                                {jaNoCronograma.has(e.id) ? ' (já no cronograma)' : ''}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                    <button type="button" className="btn btn-sm btn-outline-primary mt-2" onClick={preencher}>
                      <i className="bi bi-calendar-check me-1" aria-hidden="true" />
                      Preencher pelas datas das revisões
                    </button>
                    <div className="form-text">
                      Marca os meses entre o início e a conclusão registrados em cada etapa (em andamento: até o mês
                      atual).
                    </div>
                  </>
                ) : (
                  <p className="small text-secondary mb-0" id="crono-revisao">
                    Nenhuma revisão cadastrada. <Link to="../revisoes">Cadastre uma revisão</Link> para usar as etapas
                    dela.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <div role="status" aria-live="polite" className="small mb-2">
        {aviso && <span className="text-success">{aviso}</span>}
      </div>

      {d.etapas.length ? (
        <>
          <p className="small text-secondary mb-2" id="crono-ajuda">
            <span className="k-crono-legenda me-1" aria-hidden="true" />
            Em execução · {marcadas} de {d.etapas.length} etapa(s) com período marcado.
            {edita && (
              <>
                {' '}
                Clique numa célula para marcar ou desmarcar, arraste para pintar vários períodos, use Shift + clique
                para preencher um intervalo e as setas para navegar.
              </>
            )}
          </p>
          {blocos.map((b) => (
            <GradeCronograma
              key={`${d.granularidade}-${b[0]}`}
              d={d}
              anos={b}
              edita={edita}
              aoMarcar={(id, ps, marcar) =>
                mudarEtapa(id, (e) => ps.reduce((acc, p) => marcarPeriodo(acc, p, marcar), e))
              }
              aoRenomear={(id, nome) => mudarEtapa(id, (e) => ({ ...e, nome }))}
              aoMover={(id, delta) => mudar(moverEtapa(d, id, delta))}
              aoLimpar={(id) => mudarEtapa(id, (e) => ({ ...e, meses: [] }))}
              aoRemover={(id) => mudar({ ...d, etapas: d.etapas.filter((e) => e.id !== id) })}
            />
          ))}
        </>
      ) : (
        <div className="text-center text-secondary border rounded p-4">
          <i className="bi bi-calendar3 fs-3 d-block mb-2" aria-hidden="true" />
          Nenhuma etapa no cronograma. {edita ? 'Adicione etapas acima.' : ''}
        </div>
      )}
    </div>
  );
}

/** Uma tabela por bloco de anos; cada célula é um botão de alternância (aria-pressed) */
function GradeCronograma({
  d,
  anos,
  edita,
  aoMarcar,
  aoRenomear,
  aoMover,
  aoLimpar,
  aoRemover,
}: {
  d: DadosCronograma;
  anos: number[];
  edita: boolean;
  aoMarcar: (etapaId: string, periodos: Periodo[], marcar: boolean) => void;
  aoRenomear: (etapaId: string, nome: string) => void;
  aoMover: (etapaId: string, delta: -1 | 1) => void;
  aoLimpar: (etapaId: string) => void;
  aoRemover: (etapaId: string) => void;
}) {
  const periodos = anos.flatMap((a) => periodosDoAno(d.granularidade, a));
  const porAno = GRANULARIDADES[d.granularidade].porAno;
  const tabela = useRef<HTMLTableElement>(null);
  // arraste: modo (marcar/desmarcar) definido pela primeira célula; células já pintadas no gesto
  const arraste = useRef<{ marcar: boolean; feitos: Set<string> } | null>(null);
  const ultimo = useRef<{ etapaId: string; coluna: number } | null>(null);

  useEffect(() => {
    const parar = () => (arraste.current = null);
    window.addEventListener('pointerup', parar);
    window.addEventListener('pointercancel', parar);
    return () => {
      window.removeEventListener('pointerup', parar);
      window.removeEventListener('pointercancel', parar);
    };
  }, []);

  const celulaEm = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-crono-celula]');
    return el && tabela.current?.contains(el) ? el : null;
  };
  const aplicar = (el: HTMLElement) => {
    const a = arraste.current;
    const k = `${el.dataset.etapa}|${el.dataset.coluna}`;
    if (!a || a.feitos.has(k)) return;
    a.feitos.add(k);
    aoMarcar(el.dataset.etapa!, [periodos[Number(el.dataset.coluna)]], a.marcar);
  };

  const inicio = (e: PointerEvent<HTMLButtonElement>, etapa: EtapaCronograma, coluna: number) => {
    if (!edita || e.button !== 0) return;
    e.preventDefault(); // sem seleção de texto durante o arraste
    const p = periodos[coluna];
    const marcar = !periodoMarcado(etapa, p);
    // Shift + clique: preenche do último período clicado na mesma etapa até este
    if (e.shiftKey && ultimo.current?.etapaId === etapa.id) {
      const [a, b] = [ultimo.current.coluna, coluna].sort((x, y) => x - y);
      aoMarcar(etapa.id, periodos.slice(a, b + 1), true);
      ultimo.current = { etapaId: etapa.id, coluna };
      return;
    }
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); // toque: deixa o movimento chegar às outras células
    arraste.current = { marcar, feitos: new Set() };
    aplicar(e.currentTarget);
    ultimo.current = { etapaId: etapa.id, coluna };
  };
  const mover = (e: PointerEvent<HTMLTableElement>) => {
    if (!arraste.current) return;
    const el = celulaEm(e.clientX, e.clientY);
    if (el) aplicar(el);
  };
  // teclado: Enter/Espaço alternam (clique do botão); setas movem o foco pela grade
  const teclas = (e: KeyboardEvent<HTMLButtonElement>, linha: number, coluna: number) => {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };
    const m =
      delta[e.key] ?? (e.key === 'Home' ? [0, -coluna] : e.key === 'End' ? [0, periodos.length - 1 - coluna] : null);
    if (!m) return;
    e.preventDefault();
    tabela.current
      ?.querySelector<HTMLButtonElement>(`[data-linha="${linha + m[0]}"][data-coluna="${coluna + m[1]}"]`)
      ?.focus();
  };
  const alternarTeclado = (etapa: EtapaCronograma, coluna: number, detalhe: number) => {
    if (detalhe !== 0) return; // clique do mouse já tratado no pointerdown
    aoMarcar(etapa.id, [periodos[coluna]], !periodoMarcado(etapa, periodos[coluna]));
    ultimo.current = { etapaId: etapa.id, coluna };
  };

  const titulo = anos.length > 1 ? `${anos[0]}–${anos[anos.length - 1]}` : String(anos[0]);
  return (
    <div className="table-responsive mb-3 k-crono">
      <table
        ref={tabela}
        className="table table-bordered table-sm align-middle mb-0"
        onPointerMove={mover}
        aria-describedby="crono-ajuda"
      >
        <caption className="visually-hidden">Cronograma {titulo}</caption>
        <thead>
          {d.granularidade !== 'ANUAL' && (
            <tr>
              <th scope="col" rowSpan={2} className="k-crono-etapa k-crono-cab">
                Etapa
              </th>
              {anos.map((a) => (
                <th key={a} scope="colgroup" colSpan={porAno} className="k-crono-cab">
                  {a}
                </th>
              ))}
              {edita && <th rowSpan={2} className="k-crono-cab" aria-label="Ações" />}
            </tr>
          )}
          <tr>
            {d.granularidade === 'ANUAL' && (
              <th scope="col" className="k-crono-etapa k-crono-cab">
                Etapa
              </th>
            )}
            {periodos.map((p) => (
              <th key={p.chave} scope="col" className="k-crono-cab text-center small fw-normal" title={p.descricao}>
                {p.rotulo}
              </th>
            ))}
            {d.granularidade === 'ANUAL' && edita && <th className="k-crono-cab" aria-label="Ações" />}
          </tr>
        </thead>
        <tbody>
          {d.etapas.map((e, linha) => {
            const intervalo = intervaloDaEtapa(e);
            return (
              <tr key={e.id}>
                <th scope="row" className="k-crono-etapa fw-normal">
                  {edita ? (
                    <input
                      className="form-control form-control-sm"
                      value={e.nome}
                      maxLength={200}
                      aria-label={`Nome da etapa ${linha + 1}`}
                      onChange={(ev) => aoRenomear(e.id, ev.target.value)}
                    />
                  ) : (
                    e.nome
                  )}
                  <div className="small text-secondary">
                    {e.origem === 'REVISAO' && (
                      <i className="bi bi-journal-text me-1" title="Etapa de revisão" aria-hidden="true" />
                    )}
                    {intervalo
                      ? intervalo.inicio === intervalo.fim
                        ? mesCurto(intervalo.inicio)
                        : `${mesCurto(intervalo.inicio)} a ${mesCurto(intervalo.fim)}`
                      : 'sem período'}
                  </div>
                </th>
                {periodos.map((p, coluna) => {
                  const marcado = periodoMarcado(e, p);
                  return (
                    <td key={p.chave} className={`p-0 ${p.indice === 0 && coluna > 0 ? 'k-crono-ano-inicio' : ''}`}>
                      {edita ? (
                        <button
                          type="button"
                          className="k-crono-celula"
                          data-crono-celula=""
                          data-etapa={e.id}
                          data-linha={linha}
                          data-coluna={coluna}
                          aria-pressed={marcado}
                          aria-label={`${e.nome}: ${p.descricao}`}
                          tabIndex={linha === 0 && coluna === 0 ? 0 : -1}
                          onPointerDown={(ev) => inicio(ev, e, coluna)}
                          onClick={(ev) => alternarTeclado(e, coluna, ev.detail)}
                          onKeyDown={(ev) => teclas(ev, linha, coluna)}
                        >
                          {marcado && <i className="bi bi-check-lg" aria-hidden="true" />}
                        </button>
                      ) : (
                        <span
                          className={`k-crono-celula ${marcado ? 'marcada' : ''}`}
                          title={`${e.nome}: ${p.descricao}`}
                        >
                          {marcado ? (
                            <>
                              <i className="bi bi-check-lg" aria-hidden="true" />
                              <span className="visually-hidden">em execução</span>
                            </>
                          ) : null}
                        </span>
                      )}
                    </td>
                  );
                })}
                {edita && (
                  <td className="text-nowrap px-1">
                    <div className="btn-group btn-group-sm" role="group" aria-label={`Ações da etapa ${e.nome}`}>
                      <button
                        type="button"
                        className="btn btn-link px-1"
                        disabled={linha === 0}
                        onClick={() => aoMover(e.id, -1)}
                        title="Subir"
                      >
                        <i className="bi bi-arrow-up" aria-hidden="true" />
                        <span className="visually-hidden">Subir {e.nome}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-link px-1"
                        disabled={linha === d.etapas.length - 1}
                        onClick={() => aoMover(e.id, 1)}
                        title="Descer"
                      >
                        <i className="bi bi-arrow-down" aria-hidden="true" />
                        <span className="visually-hidden">Descer {e.nome}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-link px-1"
                        disabled={!e.meses.length}
                        onClick={() => aoLimpar(e.id)}
                        title="Limpar períodos"
                      >
                        <i className="bi bi-eraser" aria-hidden="true" />
                        <span className="visually-hidden">Limpar períodos de {e.nome}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-link px-1 text-danger"
                        onClick={() => aoRemover(e.id)}
                        title="Remover etapa"
                      >
                        <i className="bi bi-trash" aria-hidden="true" />
                        <span className="visually-hidden">Remover {e.nome}</span>
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** PDF ou Word só com o cronograma (sem capa), pela mesma geração do relatório */
function ImprimirCronograma({
  projetoId,
  antes,
  vazio,
}: {
  projetoId: string;
  antes: () => Promise<boolean>;
  vazio: boolean;
}) {
  const t = useTarefa();
  const [formato, setFormato] = useState<'pdf' | 'docx'>('pdf');
  const gerar = async (f: 'pdf' | 'docx') => {
    setFormato(f);
    if (!(await antes())) return;
    await t.iniciar(`/projetos/${projetoId}/relatorio/gerar`, {
      formato: f,
      opcoes: { secoes: ['cronograma'], capa: false, orientacoes: false },
    });
  };
  return (
    <span className="d-inline-flex flex-wrap align-items-center gap-2">
      <span className="btn-group" role="group" aria-label="Imprimir o cronograma">
        <button
          type="button"
          className="btn btn-outline-primary"
          disabled={t.andamento || vazio}
          onClick={() => gerar('pdf')}
        >
          {t.andamento && formato === 'pdf' ? (
            <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
          ) : (
            <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
          )}
          PDF
        </button>
        <button
          type="button"
          className="btn btn-outline-primary"
          disabled={t.andamento || vazio}
          onClick={() => gerar('docx')}
        >
          {t.andamento && formato === 'docx' ? (
            <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
          ) : (
            <i className="bi bi-file-earmark-word me-1" aria-hidden="true" />
          )}
          Word
        </button>
      </span>
      {t.url && (
        <LinksDoArquivo
          url={t.url}
          pdf={t.pdf}
          texto={t.pdf ? 'Abrir PDF' : 'Baixar DOCX'}
          nome={t.nome ?? (t.pdf ? 'cronograma.pdf' : 'cronograma.docx')}
        />
      )}
      {t.erro && (
        <span className="text-danger small" role="alert">
          {t.erro}
        </span>
      )}
    </span>
  );
}
