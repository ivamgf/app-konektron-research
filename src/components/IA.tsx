import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { post } from '../lib/api';
import {
  ACOES_TEXTO,
  ASSISTENTES,
  abrirNoAssistente,
  gerarComIA,
  iaConfigurada,
  lerConfigIA,
  montarPedidoCampo,
  pedidoParaAssistente,
  PROVEDORES,
  type AcaoTexto,
  type AssistenteId,
  type ConfigIA,
  type PedidoIA,
} from '../lib/ia';
import { ErroAlerta, Modal } from './ui';

/** Configuração de IA do usuário neste navegador (atualiza quando muda no Perfil) */
export function useConfigIA() {
  const [config, setConfig] = useState<ConfigIA | null>(lerConfigIA);
  useEffect(() => {
    const atualizar = () => setConfig(lerConfigIA());
    window.addEventListener('konektron-ia', atualizar);
    window.addEventListener('storage', atualizar);
    return () => {
      window.removeEventListener('konektron-ia', atualizar);
      window.removeEventListener('storage', atualizar);
    };
  }, []);
  return iaConfigurada(config) ? config : null;
}

/** Registra na auditoria do projeto que um texto foi gerado com IA (sem o conteúdo nem a chave) */
export function registrarUsoIA(
  projetoId: string | undefined,
  recurso: string,
  config: ConfigIA | null,
  entidade?: { entidade: string; entidadeId?: string },
) {
  if (!projetoId) return;
  post(`/projetos/${projetoId}/uso-ia`, {
    recurso: recurso.slice(0, 120),
    modo: config ? 'API' : 'ASSISTENTE',
    provedor: config?.provedor ?? null,
    modelo: config?.modelo ?? null,
    ...entidade,
  }).catch(() => {
    /* a auditoria nunca impede o uso */
  });
}

export const AVISO_IA =
  'Texto gerado por IA pode conter erros, generalizações e referências inventadas. Revise antes de usar e declare o uso de IA conforme as regras do periódico ou da instituição.';

/**
 * Painel comum aos botões de IA: gera com a conta do usuário (caminho 2) ou copia o pedido e abre
 * um assistente na web (caminho 1), e mostra o resultado editável antes de aplicar.
 */
function PainelIA({
  pedido,
  aoGerar,
  resultado,
  setResultado,
  rotuloResultado,
  linhasResultado = 8,
  children,
}: {
  pedido: PedidoIA;
  aoGerar?: (texto: string) => void;
  resultado: string;
  setResultado: (v: string) => void;
  rotuloResultado: string;
  linhasResultado?: number;
  children?: ReactNode;
}) {
  const config = useConfigIA();
  const id = useId();
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [assistente, setAssistente] = useState<AssistenteId>('chatgpt');
  const [aviso, setAviso] = useState<string | null>(null);

  const gerar = async () => {
    if (!config) return;
    setGerando(true);
    setErro(null);
    try {
      const t = await gerarComIA(config, pedido);
      setResultado(t.trim());
      aoGerar?.(t);
    } catch (e) {
      setErro(e instanceof Error ? e.message : e);
    } finally {
      setGerando(false);
    }
  };

  const abrir = async () => {
    const copiou = await abrirNoAssistente(assistente, pedidoParaAssistente(pedido));
    setAviso(
      copiou
        ? 'Pedido copiado. Cole no assistente (Ctrl+V), depois copie a resposta e cole no campo abaixo.'
        : 'Não foi possível copiar automaticamente. Copie o pedido mostrado em "Ver pedido".',
    );
  };

  return (
    <>
      {children}
      <div className="border rounded p-3 mb-3 bg-body-tertiary">
        {config ? (
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button type="button" className="btn btn-primary" onClick={gerar} disabled={gerando}>
              {gerando ? (
                <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
              ) : (
                <i className="bi bi-stars me-1" aria-hidden="true" />
              )}
              {gerando ? 'Gerando…' : 'Gerar com minha conta'}
            </button>
            <span className="small text-secondary">
              {PROVEDORES[config.provedor].nome} · <span className="k-mono">{config.modelo}</span>
            </span>
          </div>
        ) : (
          <p className="small mb-2">
            Para gerar direto aqui, conecte sua conta de IA no <Link to="/perfil#ia">Perfil</Link>. Ou use um assistente
            na web:
          </p>
        )}
        <div className={`d-flex flex-wrap align-items-end gap-2 ${config ? 'mt-3' : ''}`}>
          <div>
            <label htmlFor={`${id}-assistente`} className="form-label small mb-1">
              {config ? 'Ou use um assistente na web' : 'Assistente'}
            </label>
            <select
              id={`${id}-assistente`}
              className="form-select form-select-sm"
              value={assistente}
              onChange={(e) => setAssistente(e.target.value as AssistenteId)}
            >
              {ASSISTENTES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={abrir}>
            <i className="bi bi-box-arrow-up-right me-1" aria-hidden="true" />
            {assistente === 'copiar' ? 'Copiar pedido' : 'Copiar pedido e abrir'}
            {assistente !== 'copiar' && <span className="visually-hidden"> (abre em nova aba)</span>}
          </button>
        </div>
        {aviso && (
          <div className="small text-success mt-2" role="status">
            {aviso}
          </div>
        )}
        <details className="small mt-2">
          <summary>Ver pedido enviado à IA</summary>
          <pre
            className="k-leitura small border rounded p-2 mt-2 mb-0 bg-body"
            style={{ maxHeight: 220, overflow: 'auto' }}
          >
            {pedidoParaAssistente(pedido)}
          </pre>
        </details>
      </div>
      <ErroAlerta erro={erro} />
      <label htmlFor={`${id}-resultado`} className="form-label fw-medium">
        {rotuloResultado}
      </label>
      <textarea
        id={`${id}-resultado`}
        className="form-control"
        rows={linhasResultado}
        value={resultado}
        onChange={(e) => setResultado(e.target.value)}
        placeholder="O texto gerado aparece aqui. Se usou um assistente na web, cole a resposta aqui."
        aria-describedby={`${id}-aviso`}
      />
      <div id={`${id}-aviso`} className="form-text">
        <i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />
        {AVISO_IA}
      </div>
    </>
  );
}

/** Botão "IA" ao lado de um campo de texto: gera, melhora, resume ou traduz o conteúdo do campo */
export function BotaoIA({
  campo,
  orientacao,
  contexto,
  valor,
  aoAplicar,
  projetoId,
  desabilitado,
  className = 'btn btn-outline-primary btn-sm py-0',
}: {
  campo: string;
  orientacao?: string;
  /** monta o contexto só quando o painel abre */
  contexto: () => string;
  valor: string;
  aoAplicar: (texto: string) => void;
  projetoId?: string;
  desabilitado?: boolean;
  className?: string;
}) {
  const config = useConfigIA();
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [acao, setAcao] = useState<AcaoTexto>(valor.trim() ? 'melhorar' : 'gerar');
  const [extra, setExtra] = useState('');
  const [resultado, setResultado] = useState('');
  const [ctx, setCtx] = useState('');
  const pedido = montarPedidoCampo({ campo, orientacao, contexto: ctx, atual: valor, acao, extra });

  const aplicar = (modo: 'substituir' | 'acrescentar') => {
    const t = resultado.trim();
    if (!t) return;
    aoAplicar(modo === 'acrescentar' && valor.trim() ? `${valor.trim()}\n\n${t}` : t);
    registrarUsoIA(projetoId, `${ACOES_TEXTO.find((a) => a.id === acao)!.nome}: ${campo}`, config);
    setAberto(false);
    setResultado('');
  };

  if (desabilitado) return null;
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setCtx(contexto());
          setAcao(valor.trim() ? 'melhorar' : 'gerar');
          setAberto(true);
        }}
        aria-label={`Assistente de IA para o campo ${campo}`}
        title="Gerar ou melhorar com IA"
      >
        <i className="bi bi-stars me-1" aria-hidden="true" />
        IA
      </button>
      <Modal
        titulo={`IA · ${campo}`}
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        tamanho="lg"
        rodape={
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setAberto(false)}>
              Cancelar
            </button>
            {valor.trim() && (
              <button
                type="button"
                className="btn btn-outline-primary"
                disabled={!resultado.trim()}
                onClick={() => aplicar('acrescentar')}
              >
                Acrescentar ao texto
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!resultado.trim()}
              onClick={() => aplicar('substituir')}
            >
              {valor.trim() ? 'Substituir o texto' : 'Usar este texto'}
            </button>
          </>
        }
      >
        <PainelIA pedido={pedido} resultado={resultado} setResultado={setResultado} rotuloResultado="Resultado">
          <div className="row g-2 mb-3">
            <div className="col-sm-5">
              <label htmlFor={`${id}-acao`} className="form-label small mb-1">
                O que fazer
              </label>
              <select
                id={`${id}-acao`}
                className="form-select"
                value={acao}
                onChange={(e) => setAcao(e.target.value as AcaoTexto)}
              >
                {ACOES_TEXTO.filter((a) => a.id === 'gerar' || valor.trim()).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-sm-7">
              <label htmlFor={`${id}-extra`} className="form-label small mb-1">
                Pedido adicional (opcional)
              </label>
              <input
                id={`${id}-extra`}
                className="form-control"
                value={extra}
                maxLength={1000}
                placeholder="Ex.: foque em saúde pública; até 150 palavras"
                onChange={(e) => setExtra(e.target.value)}
              />
            </div>
          </div>
        </PainelIA>
      </Modal>
    </>
  );
}

/** Botão de IA que sugere itens para uma lista (questões, objetivos, palavras-chave, strings) */
export function BotaoIALista({
  rotulo,
  pedido,
  aoAplicar,
  projetoId,
  desabilitado,
}: {
  rotulo: string;
  /** pedido montado na hora: deve pedir um item por linha */
  pedido: () => PedidoIA;
  aoAplicar: (itens: string[]) => void;
  projetoId?: string;
  desabilitado?: boolean;
}) {
  const config = useConfigIA();
  const [aberto, setAberto] = useState(false);
  const [p, setP] = useState<PedidoIA>({ sistema: '', mensagem: '' });
  const [resultado, setResultado] = useState('');
  const itens = resultado
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);

  if (desabilitado) return null;
  return (
    <>
      <button
        type="button"
        className="btn btn-outline-primary btn-sm"
        onClick={() => {
          setP(pedido());
          setAberto(true);
        }}
      >
        <i className="bi bi-stars me-1" aria-hidden="true" />
        {rotulo}
      </button>
      <Modal
        titulo={rotulo}
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        tamanho="lg"
        rodape={
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setAberto(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!itens.length}
              onClick={() => {
                aoAplicar(itens);
                registrarUsoIA(projetoId, rotulo, config);
                setAberto(false);
                setResultado('');
              }}
            >
              Adicionar {itens.length || ''} item(ns)
            </button>
          </>
        }
      >
        <PainelIA
          pedido={p}
          resultado={resultado}
          setResultado={setResultado}
          rotuloResultado="Itens sugeridos (um por linha; edite ou apague antes de adicionar)"
        />
      </Modal>
    </>
  );
}

/** Pede à IA uma lista com um item por linha */
export function pedidoDeLista(o: {
  oQue: string;
  quantos: string;
  contexto: string;
  existentes: string[];
  regras?: string;
}): PedidoIA {
  return {
    sistema:
      'Você é um assistente de pesquisa científica. Responda apenas com a lista pedida, um item por linha, ' +
      'sem numeração, sem marcadores e sem comentários. Não invente dados nem referências.',
    mensagem: [
      `Sugira ${o.quantos} ${o.oQue}.`,
      o.regras ?? '',
      o.contexto.trim() ? `Contexto da pesquisa:\n${o.contexto.trim()}` : '',
      o.existentes.length ? `Já cadastrados (não repita):\n${o.existentes.join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}
