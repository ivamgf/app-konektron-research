import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, mensagemDeErro, post, put } from '../../lib/api';
import { chaves, useBases, useIdiomas, useProtocolo } from '../../lib/consultas';
import { dataHora, rotulo } from '../../lib/formato';
import type { Pendencia, Protocolo as TProtocolo, VersaoProtocolo } from '../../lib/tipos';
import { Carregando, ErroAlerta, IndicadorSalvo, Modal, Situacao } from '../../components/ui';
import { ListaEditavel } from '../../components/ListaEditavel';
import { BotaoTarefa } from '../../components/BotaoTarefa';
import { BotaoImprimir } from '../../components/BotaoImprimir';
import { useProjetoAtual } from './ProjetoLayout';
import {
  corpoDoPasso,
  METODOLOGIAS,
  PASSOS,
  passosPreenchidos,
  rascunhoDe,
  TOTAL_PASSOS,
  type Rascunho,
} from './protocoloPassos';
import { Tcle } from './Tcle';
import { ResumosProtocolo } from './ResumosProtocolo';

const CONCLUIR = TOTAL_PASSOS + 1; // passo extra: revisão, conclusão e impressão

export default function Protocolo() {
  const { projeto } = useProjetoAtual();
  const q = useProtocolo(projeto.id);
  if (q.isLoading) return <Carregando />;
  if (q.error || !q.data) return <ErroAlerta erro={q.error ?? 'Protocolo não encontrado'} />;
  return <Assistente protocolo={q.data} />;
}

function Assistente({ protocolo }: { protocolo: TProtocolo }) {
  const { projeto, edita } = useProjetoAtual();
  const qc = useQueryClient();
  const [passo, setPasso] = useState(() => Math.min(TOTAL_PASSOS, Math.max(1, protocolo.passoAtual || 1)));
  const [r, setR] = useState<Rascunho>(() => rascunhoDe(protocolo));
  const [sujo, setSujo] = useState(false);
  const [estado, setEstado] = useState<'ocioso' | 'salvando' | 'salvo' | 'erro'>('ocioso');
  const [erro, setErro] = useState<string | null>(null);
  const versao = useRef(0); // muda a cada edição: evita marcar como salvo o que mudou durante o envio
  const somenteLeitura = !edita;
  const concluido = protocolo.status === 'CONCLUIDO' || protocolo.status === 'APROVADO';

  const alterar = (parcial: Partial<Rascunho>) => {
    setR((atual) => ({ ...atual, ...parcial }));
    setSujo(true);
    versao.current++;
  };

  const salvar = useCallback(
    async (passoSalvo: number, proximo: number, dados: Rascunho) => {
      const v = versao.current;
      setEstado('salvando');
      setErro(null);
      try {
        const atualizado = await put<TProtocolo>(
          `/projetos/${projeto.id}/protocolo`,
          corpoDoPasso(passoSalvo, dados, proximo),
        );
        qc.setQueryData(chaves.protocolo(projeto.id), atualizado);
        qc.invalidateQueries({ queryKey: chaves.projeto(projeto.id) });
        if (versao.current === v) setSujo(false);
        setEstado('salvo');
        return true;
      } catch (e) {
        setEstado('erro');
        setErro(mensagemDeErro(e));
        return false;
      }
    },
    [projeto.id, qc],
  );

  // Salvamento automático 1,5 s depois da última alteração (RNF11)
  useEffect(() => {
    if (!sujo || somenteLeitura || passo === CONCLUIR) return;
    const t = setTimeout(() => salvar(passo, passo, r), 1500);
    return () => clearTimeout(t);
  }, [r, sujo, passo, salvar, somenteLeitura]);

  // Aviso antes de sair com alterações pendentes (RNF11)
  useEffect(() => {
    if (!sujo) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [sujo]);

  const irPara = async (destino: number) => {
    if (sujo && !somenteLeitura && passo !== CONCLUIR) {
      const ok = await salvar(passo, Math.min(TOTAL_PASSOS, destino), r);
      if (!ok) return;
    }
    setPasso(destino);
    window.scrollTo({ top: 0 });
  };

  const preenchidos = passosPreenchidos(r);
  const pendencias = protocolo.pendencias ?? [];

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <Situacao valor={protocolo.status} />
        <span className="small text-secondary">
          {protocolo.versaoAtual ? `Versão ${protocolo.versaoAtual}` : 'Ainda sem versão concluída'}
        </span>
        <span className="ms-auto">
          <IndicadorSalvo estado={sujo && estado !== 'salvando' ? 'ocioso' : estado} />
          {sujo && estado !== 'salvando' && <span className="small text-warning-emphasis">Alterações não salvas</span>}
        </span>
      </div>

      {protocolo.status === 'DEVOLVIDO' && protocolo.parecer && (
        <div className="alert alert-warning">
          <strong>Devolvido pelo orientador:</strong> {protocolo.parecer}
        </div>
      )}
      {concluido && edita && (
        <div className="alert alert-info small">
          Este protocolo está {rotulo(protocolo.status).toLowerCase()}. Qualquer alteração o volta para rascunho, e a
          próxima conclusão gera a versão {protocolo.versaoAtual + 1}, com justificativa (RN04).
        </div>
      )}
      {somenteLeitura && (
        <div className="alert alert-secondary small">Seu papel no projeto permite só a leitura do protocolo.</div>
      )}

      <nav className="k-stepper mb-4" aria-label="Passos do protocolo">
        {PASSOS.map((s) => (
          <button
            key={s.n}
            type="button"
            className={`k-step ${passo === s.n ? 'atual' : preenchidos[s.n] ? 'feito' : ''}`}
            aria-current={passo === s.n ? 'step' : undefined}
            onClick={() => irPara(s.n)}
          >
            <span className="k-step-n">
              {preenchidos[s.n] && passo !== s.n ? <i className="bi bi-check-lg" aria-hidden="true" /> : s.n}
            </span>
            <span className="d-block">{s.titulo}</span>
          </button>
        ))}
        <button
          type="button"
          className={`k-step ${passo === CONCLUIR ? 'atual' : concluido ? 'feito' : ''}`}
          aria-current={passo === CONCLUIR ? 'step' : undefined}
          onClick={() => irPara(CONCLUIR)}
        >
          <span className="k-step-n">
            <i className="bi bi-flag" aria-hidden="true" />
          </span>
          <span className="d-block">Concluir</span>
        </button>
      </nav>

      {erro && <ErroAlerta erro={erro} />}

      <div className="card">
        <div className="card-body">
          {passo === CONCLUIR ? (
            <Conclusao protocolo={protocolo} pendencias={pendencias} irPara={irPara} sujo={sujo} />
          ) : (
            <>
              <h2 className="h5 mb-3">
                Passo {passo} de {TOTAL_PASSOS} · {PASSOS[passo - 1].titulo}
              </h2>
              <fieldset disabled={somenteLeitura}>
                <ConteudoDoPasso
                  passo={passo}
                  r={r}
                  alterar={alterar}
                  somenteLeitura={somenteLeitura}
                  projetoId={projeto.id}
                />
              </fieldset>
            </>
          )}
        </div>
        {passo !== CONCLUIR && (
          <div className="card-footer d-flex flex-wrap gap-2 justify-content-between">
            <button className="btn btn-outline-secondary" disabled={passo === 1} onClick={() => irPara(passo - 1)}>
              <i className="bi bi-arrow-left me-1" aria-hidden="true" />
              Voltar
            </button>
            <div className="d-flex gap-2">
              {!somenteLeitura && (
                <button
                  className="btn btn-outline-primary"
                  disabled={!sujo || estado === 'salvando'}
                  onClick={() => salvar(passo, passo, r)}
                >
                  Salvar
                </button>
              )}
              <button className="btn btn-primary" onClick={() => irPara(passo + 1)}>
                {passo === TOTAL_PASSOS ? 'Revisar e concluir' : 'Avançar'}
                <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Campo({
  id,
  rotulo: texto,
  valor,
  aoMudar,
  linhas = 3,
  ajuda,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  linhas?: number;
  ajuda?: string;
}) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label fw-medium">
        {texto}
      </label>
      <textarea
        id={id}
        className="form-control"
        rows={linhas}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        aria-describedby={ajuda ? `${id}-ajuda` : undefined}
      />
      {ajuda && (
        <div id={`${id}-ajuda`} className="form-text">
          {ajuda}
        </div>
      )}
    </div>
  );
}

function ConteudoDoPasso({
  passo,
  r,
  alterar,
  somenteLeitura,
  projetoId,
}: {
  passo: number;
  r: Rascunho;
  alterar: (p: Partial<Rascunho>) => void;
  somenteLeitura: boolean;
  projetoId: string;
}) {
  const bases = useBases();
  const idiomas = useIdiomas();
  const qc = useQueryClient();
  const converter = useMutation({
    mutationFn: () => post<unknown[]>(`/projetos/${projetoId}/questoes/de-outras-questoes`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.protocolo(projetoId) }),
  });

  switch (passo) {
    case 1:
      return (
        <>
          <Campo id="tema" rotulo="Tema *" valor={r.tema} aoMudar={(v) => alterar({ tema: v })} />
          <Campo
            id="questao"
            rotulo="Questão de pesquisa *"
            valor={r.questaoPesquisa}
            aoMudar={(v) => alterar({ questaoPesquisa: v })}
          />
        </>
      );
    case 2:
      return (
        <>
          <p className="text-secondary small">
            Questões complementares. Depois de salvas, podem virar questões de análise (QA1, QA2…).
          </p>
          <ListaEditavel
            itens={r.outrasQuestoes}
            aoMudar={(v) => alterar({ outrasQuestoes: v })}
            novo={() => ({ texto: '' })}
            rotuloItem={(i) => `Questão ${i + 1}`}
            somenteLeitura={somenteLeitura}
            textoAdicionar="Adicionar questão"
            max={50}
            render={(it, set, i) => (
              <textarea
                className="form-control"
                rows={2}
                aria-label={`Questão ${i + 1}`}
                value={it.texto}
                onChange={(e) => set({ texto: e.target.value })}
              />
            )}
          />
          {!somenteLeitura && (
            <div className="mt-3">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                disabled={converter.isPending || !r.outrasQuestoes.length}
                onClick={() => converter.mutate()}
              >
                <i className="bi bi-arrow-right-square me-1" aria-hidden="true" />
                Converter em questões de análise (QA)
              </button>
              {converter.data && (
                <span className="small text-success ms-2">
                  {converter.data.length} questão(ões) criadas. <Link to="../questoes">Ver questões</Link>
                </span>
              )}
              <ErroAlerta erro={converter.error} className="mt-2" />
            </div>
          )}
        </>
      );
    case 3:
      return (
        <Campo
          id="hipotese"
          rotulo="Hipótese (opcional)"
          valor={r.hipotese}
          aoMudar={(v) => alterar({ hipotese: v })}
          linhas={4}
        />
      );
    case 4:
      return (
        <>
          <Campo
            id="objetivoGeral"
            rotulo="Objetivo geral *"
            valor={r.objetivoGeral}
            aoMudar={(v) => alterar({ objetivoGeral: v })}
          />
          <div className="fw-medium mb-2">Objetivos específicos * (ao menos 1)</div>
          <ListaEditavel
            itens={r.objetivos}
            aoMudar={(v) => alterar({ objetivos: v })}
            novo={() => ({ texto: '' })}
            rotuloItem={(i) => `Objetivo específico ${i + 1}`}
            somenteLeitura={somenteLeitura}
            textoAdicionar="Adicionar objetivo"
            max={50}
            render={(it, set, i) => (
              <textarea
                className="form-control"
                rows={2}
                aria-label={`Objetivo específico ${i + 1}`}
                value={it.texto}
                onChange={(e) => set({ texto: e.target.value })}
              />
            )}
          />
        </>
      );
    case 5:
      return (
        <Campo
          id="justificativa"
          rotulo="Justificativa (opcional)"
          valor={r.justificativa}
          aoMudar={(v) => alterar({ justificativa: v })}
          linhas={6}
          ajuda='Se não se aplica, escreva "N/D".'
        />
      );
    case 6:
      return (
        <>
          <p className="text-secondary small">Ao menos 3 palavras-chave para concluir o protocolo.</p>
          <ListaEditavel
            itens={r.palavrasChave}
            aoMudar={(v) => alterar({ palavrasChave: v })}
            novo={() => ({ termo: '', idiomaId: null })}
            rotuloItem={(i) => `Palavra-chave ${i + 1}`}
            somenteLeitura={somenteLeitura}
            textoAdicionar="Adicionar palavra-chave"
            render={(it, set, i) => (
              <div className="row g-2">
                <div className="col-sm-8">
                  <input
                    className="form-control"
                    aria-label={`Termo ${i + 1}`}
                    maxLength={150}
                    value={it.termo}
                    onChange={(e) => set({ termo: e.target.value })}
                  />
                </div>
                <div className="col-sm-4">
                  <select
                    className="form-select"
                    aria-label={`Idioma do termo ${i + 1}`}
                    value={it.idiomaId ?? ''}
                    onChange={(e) => set({ idiomaId: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">Idioma…</option>
                    {idiomas.data?.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          />
        </>
      );
    case 7:
      return (
        <>
          <p className="text-secondary small">Strings por base de dados e campo (RF11). Ao menos 1 para concluir.</p>
          <ListaEditavel
            itens={r.strings}
            aoMudar={(v) => alterar({ strings: v })}
            novo={() => ({ baseDadosId: null, campo: 'TODOS' as const, expressao: '' })}
            rotuloItem={(i) => `String ${i + 1}`}
            somenteLeitura={somenteLeitura}
            textoAdicionar="Adicionar string"
            max={50}
            render={(it, set, i) => (
              <div className="row g-2">
                <div className="col-sm-6">
                  <select
                    className="form-select"
                    aria-label={`Base da string ${i + 1}`}
                    value={it.baseDadosId ?? ''}
                    onChange={(e) => set({ baseDadosId: e.target.value || null })}
                  >
                    <option value="">Todas as bases</option>
                    {bases.data
                      ?.filter((b) => b.ativo)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nome}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="col-sm-6">
                  <select
                    className="form-select"
                    aria-label={`Campo da string ${i + 1}`}
                    value={it.campo}
                    onChange={(e) => set({ campo: e.target.value as typeof it.campo })}
                  >
                    {(['TODOS', 'TITULO', 'RESUMO', 'PALAVRAS_CHAVE'] as const).map((c) => (
                      <option key={c} value={c}>
                        {rotulo(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12">
                  <textarea
                    className="form-control k-mono"
                    rows={2}
                    aria-label={`Expressão da string ${i + 1}`}
                    placeholder='("ontology" OR "ontologia") AND "water"'
                    value={it.expressao}
                    onChange={(e) => set({ expressao: e.target.value })}
                  />
                </div>
              </div>
            )}
          />
        </>
      );
    case 8:
      return (
        <>
          <p className="text-secondary small">Descritores controlados (DeCS/MeSH) ou livres. Opcional.</p>
          <ListaEditavel
            itens={r.descritores}
            aoMudar={(v) => alterar({ descritores: v })}
            novo={() => ({ termo: '', vocabulario: 'DECS' as const, codigo: '' })}
            rotuloItem={(i) => `Descritor ${i + 1}`}
            somenteLeitura={somenteLeitura}
            textoAdicionar="Adicionar descritor"
            render={(it, set, i) => (
              <div className="row g-2">
                <div className="col-sm-6">
                  <input
                    className="form-control"
                    aria-label={`Termo do descritor ${i + 1}`}
                    maxLength={200}
                    value={it.termo}
                    onChange={(e) => set({ termo: e.target.value })}
                  />
                </div>
                <div className="col-sm-3">
                  <select
                    className="form-select"
                    aria-label={`Vocabulário do descritor ${i + 1}`}
                    value={it.vocabulario}
                    onChange={(e) => set({ vocabulario: e.target.value as typeof it.vocabulario })}
                  >
                    <option value="DECS">DeCS</option>
                    <option value="MESH">MeSH</option>
                    <option value="LIVRE">Livre</option>
                  </select>
                </div>
                <div className="col-sm-3">
                  <input
                    className="form-control k-mono"
                    placeholder="Código"
                    aria-label={`Código do descritor ${i + 1}`}
                    maxLength={50}
                    value={it.codigo}
                    onChange={(e) => set({ codigo: e.target.value })}
                  />
                </div>
              </div>
            )}
          />
        </>
      );
    case 9:
      return (
        <>
          <div className="mb-3">
            <label htmlFor="metodologia-tipo" className="form-label fw-medium">
              Tipo de pesquisa / metodologia
            </label>
            <select
              id="metodologia-tipo"
              className="form-select"
              value={r.metodologiaTipo}
              onChange={(e) => alterar({ metodologiaTipo: e.target.value })}
            >
              <option value="">Escolha…</option>
              {METODOLOGIAS.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {r.metodologiaTipo === 'OUTRA' && (
            <div className="mb-3">
              <label htmlFor="metodologia-outro" className="form-label fw-medium">
                Qual metodologia? *
              </label>
              <input
                id="metodologia-outro"
                className="form-control"
                maxLength={200}
                value={r.metodologiaOutro}
                onChange={(e) => alterar({ metodologiaOutro: e.target.value })}
              />
            </div>
          )}
          <Campo
            id="metodologia"
            rotulo="Descrição da metodologia"
            valor={r.metodologia}
            aoMudar={(v) => alterar({ metodologia: v })}
            linhas={8}
            ajuda="Abordagem, etapas, participantes, instrumentos de coleta (questionário, entrevista, testes) e forma de análise dos dados."
          />
        </>
      );
    case 10:
      return (
        <>
          <Campo
            id="resultados"
            rotulo="Principais resultados esperados *"
            valor={r.resultadosEsperados}
            aoMudar={(v) => alterar({ resultadosEsperados: v })}
            linhas={5}
          />
          <Campo
            id="riscos"
            rotulo="Riscos (opcional)"
            valor={r.riscos}
            aoMudar={(v) => alterar({ riscos: v })}
            linhas={4}
            ajuda="Riscos e desconfortos previsíveis para os participantes e as medidas para minimizá-los (pesquisas com seres humanos)."
          />
          <Campo
            id="beneficios"
            rotulo="Benefícios da pesquisa (opcional)"
            valor={r.beneficios}
            aoMudar={(v) => alterar({ beneficios: v })}
            linhas={4}
          />
          <Tcle projetoId={projetoId} somenteLeitura={somenteLeitura} />
        </>
      );
    case 11:
      return (
        <ResumosProtocolo
          projetoId={projetoId}
          resumos={r.resumos}
          aoMudar={(resumos) => alterar({ resumos })}
          somenteLeitura={somenteLeitura}
        />
      );
    default:
      return null;
  }
}

const SECOES = [
  { id: 'identificacao', texto: 'Identificação do projeto e da equipe' },
  { id: 'definicoes', texto: 'Definições' },
  { id: 'estrategia', texto: 'Estratégia de busca' },
  { id: 'questoes', texto: 'Questões de análise' },
  { id: 'criterios', texto: 'Critérios' },
  { id: 'revisoes', texto: 'Revisões previstas' },
  { id: 'historico', texto: 'Histórico e aprovação' },
  { id: 'referencias', texto: 'Referências (ABNT e APA)' },
];

function Conclusao({
  protocolo,
  pendencias,
  irPara,
  sujo,
}: {
  protocolo: TProtocolo;
  pendencias: Pendencia[];
  irPara: (p: number) => void;
  sujo: boolean;
}) {
  const { projeto, edita, papel } = useProjetoAtual();
  const qc = useQueryClient();
  const [justificativa, setJustificativa] = useState('');
  const [erro, setErro] = useState<unknown>(null);
  const [imprimir, setImprimir] = useState(false);
  const versoes = useQuery({
    queryKey: ['projeto', projeto.id, 'versoes'],
    queryFn: () => get<VersaoProtocolo[]>(`/projetos/${projeto.id}/protocolo/versoes`),
  });
  const precisaJustificar = protocolo.versaoAtual > 0;
  const concluir = useMutation({
    mutationFn: () =>
      post<TProtocolo>(`/projetos/${projeto.id}/protocolo/concluir`, precisaJustificar ? { justificativa } : {}),
    onSuccess: async () => {
      setErro(null);
      setJustificativa('');
      await Promise.all([
        qc.invalidateQueries({ queryKey: chaves.protocolo(projeto.id) }),
        qc.invalidateQueries({ queryKey: chaves.projeto(projeto.id) }),
        qc.invalidateQueries({ queryKey: ['projeto', projeto.id, 'versoes'] }),
      ]);
      setImprimir(true); // UC03 passo 8: exibe Imprimir protocolo
    },
    onError: setErro,
  });
  const inclusao = protocolo.criterios.filter((c) => c.tipo === 'INCLUSAO').length;
  const podeConcluir =
    edita && pendencias.length === 0 && protocolo.status !== 'CONCLUIDO' && protocolo.status !== 'APROVADO';

  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <h2 className="h5">Revisão do protocolo</h2>
        <ul className="list-unstyled small">
          <li>
            <i className="bi bi-question-circle me-1" aria-hidden="true" />
            {protocolo.questoes.length} questão(ões) de análise · <Link to="../questoes">editar</Link>
          </li>
          <li>
            <i className="bi bi-funnel me-1" aria-hidden="true" />
            {inclusao} critério(s) de inclusão e {protocolo.criterios.length - inclusao} de exclusão ·{' '}
            <Link to="../criterios">editar</Link>
          </li>
        </ul>

        {pendencias.length > 0 ? (
          <div className="alert alert-warning">
            <div className="fw-bold mb-1">Faltam itens obrigatórios (RN02):</div>
            <ul className="mb-0">
              {pendencias.map((p) => (
                <li key={p.campo}>
                  {p.campo === 'criterios' ? (
                    <Link to="../criterios">{p.mensagem}</Link>
                  ) : (
                    <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => irPara(p.passo)}>
                      {p.mensagem} (passo {p.passo})
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="alert alert-success">Todos os itens obrigatórios estão preenchidos.</div>
        )}
        {sujo && <div className="alert alert-warning small">Há alterações não salvas no assistente.</div>}

        {edita && (protocolo.status === 'RASCUNHO' || protocolo.status === 'DEVOLVIDO') && (
          <div className="mt-3">
            {precisaJustificar && (
              <div className="mb-3">
                <label htmlFor="justificativa" className="form-label">
                  Justificativa da alteração (versão {protocolo.versaoAtual + 1}) *
                </label>
                <textarea
                  id="justificativa"
                  className="form-control"
                  rows={3}
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                />
              </div>
            )}
            <ErroAlerta erro={erro} />
            <button
              className="btn btn-primary"
              disabled={!podeConcluir || concluir.isPending || (precisaJustificar && justificativa.trim().length < 3)}
              onClick={() => concluir.mutate()}
            >
              <i className="bi bi-check2-circle me-1" aria-hidden="true" />
              Concluir protocolo
            </button>
          </div>
        )}

        <Aprovacao protocolo={protocolo} papel={papel} />
      </div>

      <div className="col-lg-5">
        <div className="card bg-body-tertiary border-0">
          <div className="card-body">
            <h2 className="h6">Imprimir</h2>
            <p className="small text-secondary">
              PDF com o layout Konektron: só o protocolo de pesquisa ou o projeto inteiro (protocolo, revisões e
              análises).{' '}
              {protocolo.status === 'RASCUNHO' || protocolo.status === 'DEVOLVIDO'
                ? 'Rascunho sai com marca d’água “RASCUNHO” (RN03).'
                : ''}
            </p>
            <BotaoImprimir
              projetoId={projeto.id}
              aoImprimirProtocolo={() => setImprimir(true)}
              className={`btn ${protocolo.status === 'CONCLUIDO' || protocolo.status === 'APROVADO' ? 'btn-primary' : 'btn-outline-primary'}`}
            />
          </div>
        </div>
        <Versoes versoes={versoes.data ?? []} projetoId={projeto.id} carregando={versoes.isLoading} />
      </div>

      <ModalImprimir
        aberto={imprimir}
        aoFechar={() => setImprimir(false)}
        versoes={versoes.data ?? []}
        projetoId={projeto.id}
      />
    </div>
  );
}

/** UC04 passo 2: escolhe a versão e as seções */
function ModalImprimir({
  aberto,
  aoFechar,
  versoes,
  projetoId,
}: {
  aberto: boolean;
  aoFechar: () => void;
  versoes: VersaoProtocolo[];
  projetoId: string;
}) {
  const [versao, setVersao] = useState<string>('');
  const [secoes, setSecoes] = useState<string[]>(SECOES.map((s) => s.id));
  const corpo = {
    ...(versao ? { versao: Number(versao) } : {}),
    ...(secoes.length === SECOES.length ? {} : { secoes }),
  };
  return (
    <Modal titulo="Imprimir protocolo" aberto={aberto} aoFechar={aoFechar}>
      <div className="mb-3">
        <label htmlFor="versaoPdf" className="form-label">
          Versão
        </label>
        <select id="versaoPdf" className="form-select" value={versao} onChange={(e) => setVersao(e.target.value)}>
          <option value="">Atual</option>
          {versoes.map((v) => (
            <option key={v.id} value={v.versao}>
              Versão {v.versao} ({dataHora(v.criadoEm)})
            </option>
          ))}
        </select>
      </div>
      <fieldset className="mb-3">
        <legend className="form-label fs-6">Seções (a capa sempre sai)</legend>
        {SECOES.map((s) => (
          <div className="form-check" key={s.id}>
            <input
              className="form-check-input"
              type="checkbox"
              id={`sec-${s.id}`}
              checked={secoes.includes(s.id)}
              onChange={(e) =>
                setSecoes((atual) => (e.target.checked ? [...atual, s.id] : atual.filter((x) => x !== s.id)))
              }
            />
            <label className="form-check-label" htmlFor={`sec-${s.id}`}>
              {s.texto}
            </label>
          </div>
        ))}
      </fieldset>
      <div className="d-flex flex-wrap gap-2">
        <BotaoTarefa
          url={`/projetos/${projetoId}/protocolo/pdf`}
          corpo={corpo}
          className="btn btn-primary"
          textoPronto="Abrir PDF"
        >
          <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
          Gerar PDF
        </BotaoTarefa>
        <BotaoTarefa
          url={`/projetos/${projetoId}/protocolo/pdf`}
          corpo={{ ...corpo, formato: 'docx' }}
          className="btn btn-outline-primary"
          textoPronto="Baixar DOCX"
        >
          <i className="bi bi-file-earmark-word me-1" aria-hidden="true" />
          Gerar Word (DOCX)
        </BotaoTarefa>
      </div>
    </Modal>
  );
}

function Versoes({
  versoes,
  projetoId,
  carregando,
}: {
  versoes: VersaoProtocolo[];
  projetoId: string;
  carregando: boolean;
}) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const cmp = useQuery({
    queryKey: ['projeto', projetoId, 'comparar', a, b],
    queryFn: () =>
      get<{ diferencas: { campo: string; antes: unknown; depois: unknown }[] }>(
        `/projetos/${projetoId}/protocolo/versoes/comparar`,
        { a, b },
      ),
    enabled: !!a && !!b && a !== b,
  });
  const mostrar = (v: unknown) =>
    Array.isArray(v)
      ? v.map((x: any) => x.texto ?? x.termo ?? x.expressao ?? x.enunciado ?? x.nome ?? '').join('; ')
      : String(v ?? '—');
  return (
    <div className="mt-4">
      <h2 className="h6">Histórico de versões (RF14)</h2>
      {carregando && <Carregando />}
      {!carregando && versoes.length === 0 && <div className="small text-secondary">Nenhuma versão concluída.</div>}
      <ul className="list-group list-group-flush small mb-3">
        {versoes.map((v) => (
          <li key={v.id} className="list-group-item px-0">
            <strong>Versão {v.versao}</strong> · {dataHora(v.criadoEm)} · {v.criadoPorNome ?? '—'}
            {v.justificativa && <div className="text-secondary">{v.justificativa}</div>}
          </li>
        ))}
      </ul>
      {versoes.length > 1 && (
        <>
          <div className="input-group input-group-sm mb-2">
            <span className="input-group-text">Comparar</span>
            <select className="form-select" aria-label="Versão A" value={a} onChange={(e) => setA(e.target.value)}>
              <option value="">A…</option>
              {versoes.map((v) => (
                <option key={v.id} value={v.versao}>
                  v{v.versao}
                </option>
              ))}
            </select>
            <select className="form-select" aria-label="Versão B" value={b} onChange={(e) => setB(e.target.value)}>
              <option value="">B…</option>
              {versoes.map((v) => (
                <option key={v.id} value={v.versao}>
                  v{v.versao}
                </option>
              ))}
            </select>
          </div>
          <ErroAlerta erro={cmp.error} />
          {cmp.data && cmp.data.diferencas.length === 0 && (
            <div className="small text-secondary">As versões são iguais.</div>
          )}
          {cmp.data && cmp.data.diferencas.length > 0 && (
            <div className="table-responsive">
              <table className="table table-sm small">
                <thead>
                  <tr>
                    <th>Campo</th>
                    <th>v{a}</th>
                    <th>v{b}</th>
                  </tr>
                </thead>
                <tbody>
                  {cmp.data.diferencas.map((d) => (
                    <tr key={d.campo}>
                      <td>{d.campo}</td>
                      <td>{mostrar(d.antes)}</td>
                      <td>{mostrar(d.depois)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** RF15/UC15: o orientador aprova ou devolve o protocolo concluído */
function Aprovacao({ protocolo, papel }: { protocolo: TProtocolo; papel: string }) {
  const { projeto } = useProjetoAtual();
  const qc = useQueryClient();
  const [parecer, setParecer] = useState('');
  const decidir = useMutation({
    mutationFn: (decisao: 'APROVAR' | 'DEVOLVER') =>
      post(`/projetos/${projeto.id}/protocolo/aprovacao`, { decisao, parecer: parecer.trim() || undefined }),
    onSuccess: () => {
      setParecer('');
      qc.invalidateQueries({ queryKey: chaves.protocolo(projeto.id) });
      qc.invalidateQueries({ queryKey: chaves.projeto(projeto.id) });
    },
  });
  if (protocolo.status === 'APROVADO')
    return (
      <div className="alert alert-success mt-4 mb-0">
        <i className="bi bi-patch-check-fill me-1" aria-hidden="true" />
        Aprovado em {dataHora(protocolo.aprovadoEm)}.
        {protocolo.parecer && <div className="small mt-1">{protocolo.parecer}</div>}
      </div>
    );
  if (papel !== 'ORIENTADOR' || protocolo.status !== 'CONCLUIDO') return null;
  return (
    <div className="card mt-4">
      <div className="card-body">
        <h2 className="h6">Avaliação do orientador</h2>
        <label htmlFor="parecer" className="form-label small">
          Parecer (obrigatório para devolver)
        </label>
        <textarea
          id="parecer"
          className="form-control mb-2"
          rows={3}
          value={parecer}
          onChange={(e) => setParecer(e.target.value)}
        />
        <ErroAlerta erro={decidir.error} />
        <div className="d-flex gap-2">
          <button className="btn btn-success" disabled={decidir.isPending} onClick={() => decidir.mutate('APROVAR')}>
            Aprovar
          </button>
          <button
            className="btn btn-outline-danger"
            disabled={decidir.isPending || !parecer.trim()}
            onClick={() => decidir.mutate('DEVOLVER')}
          >
            Devolver com parecer
          </button>
        </div>
      </div>
    </div>
  );
}
