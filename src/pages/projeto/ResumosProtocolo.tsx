import { useEffect, useState } from 'react';
import { mensagemDeErro, post } from '../../lib/api';
import { useIdiomas } from '../../lib/consultas';
import type { ResumoRascunho } from './protocoloPassos';
import { BotaoIA } from '../../components/IA';

type Resposta = { traducoes: Record<string, string>; aviso?: string };

export const palavras = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

/** Limite de palavras dos resumos, quando ligado (vale para todos os idiomas) */
export const LIMITE_PALAVRAS = 250;

/** Corta o texto depois da palavra de número `max`, mantendo a formatação (quebras de linha) do que fica */
export function cortarPalavras(texto: string, max = LIMITE_PALAVRAS): string {
  const re = /\S+/g;
  let n = 0;
  while (re.exec(texto)) {
    if (++n === max) return /\S/.test(texto.slice(re.lastIndex)) ? texto.slice(0, re.lastIndex) : texto;
  }
  return texto;
}

const chaveLimite = (projetoId: string) => `konektron.resumo.limite250.${projetoId}`;
function lerLimite(projetoId: string) {
  try {
    return localStorage.getItem(chaveLimite(projetoId)) === '1';
  } catch {
    return false;
  }
}

/**
 * Passo "Resumo": um resumo por idioma (começa com português, inglês e espanhol), botão para
 * acrescentar outros idiomas do catálogo e tradução automática a partir de um resumo já escrito.
 */
export function ResumosProtocolo({
  projetoId,
  resumos,
  aoMudar,
  somenteLeitura,
  contextoIA,
}: {
  projetoId: string;
  resumos: ResumoRascunho[];
  aoMudar: (r: ResumoRascunho[]) => void;
  somenteLeitura: boolean;
  /** contexto do protocolo para o botão de IA */
  contextoIA?: () => string;
}) {
  const idiomas = useIdiomas();
  const lista = idiomas.data ?? [];
  const nome = (codigo: string) => lista.find((i) => i.codigo === codigo)?.nome ?? codigo;
  const livres = lista.filter((i) => !resumos.some((r) => r.idioma === i.codigo));
  const escritos = resumos.filter((r) => r.texto.trim());
  const [origem, setOrigem] = useState('');
  const [traduzindo, setTraduzindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // limite de 250 palavras: lembrado por projeto neste navegador
  const [limitar, setLimitar] = useState(() => lerLimite(projetoId));
  useEffect(() => {
    try {
      localStorage.setItem(chaveLimite(projetoId), limitar ? '1' : '0');
    } catch {
      // navegador sem localStorage: o limite vale só nesta tela
    }
  }, [limitar, projetoId]);
  const ajustar = (t: string) => (limitar ? cortarPalavras(t) : t);
  const acima = resumos.filter((r) => palavras(r.texto) > LIMITE_PALAVRAS);
  const fonte = escritos.find((r) => r.idioma === origem) ?? escritos.find((r) => r.idioma === 'pt') ?? escritos[0];

  const atualizar = (i: number, parcial: Partial<ResumoRascunho>) =>
    aoMudar(resumos.map((r, k) => (k === i ? { ...r, ...parcial } : r)));

  /** Traduz o resumo de origem para os idiomas pedidos e preenche os campos */
  const traduzir = async (para: string[], chave: string) => {
    if (!fonte || !para.length) return;
    setTraduzindo(chave);
    setErro(null);
    setAviso(null);
    try {
      const r = await post<Resposta>(`/projetos/${projetoId}/protocolo/traduzir`, {
        texto: fonte.texto,
        de: fonte.idioma,
        para,
      });
      aoMudar(
        resumos.map((x) => (r.traducoes[x.idioma] !== undefined ? { ...x, texto: ajustar(r.traducoes[x.idioma]) } : x)),
      );
      setAviso(
        `Traduzido do ${nome(fonte.idioma).toLowerCase()} para ${para.map((p) => nome(p).toLowerCase()).join(', ')}. ${r.aviso ?? 'Revise o texto.'}`,
      );
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setTraduzindo(null);
    }
  };
  const vazios = resumos.filter((r) => !r.texto.trim()).map((r) => r.idioma);

  return (
    <div>
      <p className="text-secondary small">
        Resumo do protocolo em cada idioma (resumo, abstract, resumen). Escreva em um idioma e use a tradução automática
        para os demais — ela é um ponto de partida e deve ser revisada.
      </p>

      <div className="d-flex flex-wrap align-items-center gap-2 border rounded p-2 mb-3 small">
        <div className="form-check form-switch mb-0">
          <input
            className="form-check-input"
            type="checkbox"
            role="switch"
            id="limite-resumo"
            checked={limitar}
            disabled={somenteLeitura}
            onChange={(e) => setLimitar(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="limite-resumo">
            Limitar a {LIMITE_PALAVRAS} palavras (todos os idiomas)
          </label>
        </div>
        {limitar && acima.length > 0 && (
          <>
            <span className="text-danger">
              <i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />
              {acima.length} resumo(s) passam do limite
            </span>
            {!somenteLeitura && (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => aoMudar(resumos.map((r) => ({ ...r, texto: cortarPalavras(r.texto) })))}
              >
                <i className="bi bi-scissors me-1" aria-hidden="true" />
                Cortar em {LIMITE_PALAVRAS} palavras
              </button>
            )}
          </>
        )}
      </div>

      {!somenteLeitura && escritos.length > 0 && (
        <div className="d-flex flex-wrap align-items-center gap-2 border rounded p-2 mb-3 small">
          <i className="bi bi-translate" aria-hidden="true" />
          <label htmlFor="origem-traducao">Traduzir a partir de</label>
          <select
            id="origem-traducao"
            className="form-select form-select-sm w-auto"
            value={fonte?.idioma ?? ''}
            onChange={(e) => setOrigem(e.target.value)}
          >
            {escritos.map((r) => (
              <option key={r.idioma} value={r.idioma}>
                {nome(r.idioma)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            disabled={!!traduzindo || !vazios.length}
            onClick={() => traduzir(vazios, 'vazios')}
            title={vazios.length ? undefined : 'Todos os resumos já têm texto'}
          >
            {traduzindo === 'vazios' && <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />}
            Preencher os vazios ({vazios.length})
          </button>
        </div>
      )}
      {erro && <div className="alert alert-danger small py-2">{erro}</div>}
      {aviso && (
        <div className="alert alert-info small py-2" role="status">
          {aviso}
        </div>
      )}

      {resumos.map((r, i) => (
        <div className="card mb-3" key={`${r.idioma}-${i}`}>
          <div className="card-header d-flex flex-wrap align-items-center gap-2 py-2">
            <label className="visually-hidden" htmlFor={`resumo-idioma-${i}`}>
              Idioma do resumo {i + 1}
            </label>
            <select
              id={`resumo-idioma-${i}`}
              className="form-select form-select-sm w-auto"
              value={r.idioma}
              disabled={somenteLeitura}
              onChange={(e) => atualizar(i, { idioma: e.target.value })}
            >
              {[...lista.filter((x) => x.codigo === r.idioma), ...livres].map((x) => (
                <option key={x.codigo} value={x.codigo}>
                  {x.nome}
                </option>
              ))}
              {!lista.some((x) => x.codigo === r.idioma) && <option value={r.idioma}>{r.idioma}</option>}
            </select>
            <span
              className={`small me-auto ${limitar && palavras(r.texto) > LIMITE_PALAVRAS ? 'text-danger fw-medium' : 'text-secondary'}`}
            >
              {limitar ? `${palavras(r.texto)} / ${LIMITE_PALAVRAS} palavras` : `${palavras(r.texto)} palavra(s)`}
            </span>
            {contextoIA && (
              <BotaoIA
                campo={`Resumo em ${nome(r.idioma)}`}
                orientacao={`Resumo estruturado do protocolo (objetivo, método, resultados esperados), ${limitar ? `com no máximo ${LIMITE_PALAVRAS} palavras` : 'entre 150 e 300 palavras'}, escrito em ${nome(r.idioma)}.`}
                contexto={contextoIA}
                valor={r.texto}
                aoAplicar={(texto) => atualizar(i, { texto: ajustar(texto) })}
                projetoId={projetoId}
                desabilitado={somenteLeitura}
              />
            )}
            {!somenteLeitura && fonte && fonte.idioma !== r.idioma && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={!!traduzindo}
                onClick={() => traduzir([r.idioma], r.idioma)}
              >
                {traduzindo === r.idioma ? (
                  <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                ) : (
                  <i className="bi bi-translate me-1" aria-hidden="true" />
                )}
                Traduzir do {nome(fonte.idioma).toLowerCase()}
              </button>
            )}
            {!somenteLeitura && (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                aria-label={`Remover resumo em ${nome(r.idioma)}`}
                onClick={() => aoMudar(resumos.filter((_, k) => k !== i))}
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="card-body">
            <label className="visually-hidden" htmlFor={`resumo-texto-${i}`}>
              Resumo em {nome(r.idioma)}
            </label>
            <textarea
              id={`resumo-texto-${i}`}
              className="form-control"
              rows={7}
              value={r.texto}
              readOnly={somenteLeitura}
              onChange={(e) => atualizar(i, { texto: ajustar(e.target.value) })}
            />
          </div>
        </div>
      ))}

      {!somenteLeitura && (
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={!livres.length}
          onClick={() => aoMudar([...resumos, { idioma: livres[0].codigo, texto: '' }])}
          title={livres.length ? undefined : 'Todos os idiomas do catálogo já têm resumo'}
        >
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          Adicionar resumo em outro idioma
        </button>
      )}
    </div>
  );
}
