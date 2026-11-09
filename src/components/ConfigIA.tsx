import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  concluirOpenRouter,
  conectarOpenRouter,
  gerarComIA,
  gravarConfigIA,
  lerConfigIA,
  PROVEDORES,
  type ConfigIA,
  type Provedor,
} from '../lib/ia';
import { ErroAlerta } from './ui';

const nova = (provedor: Provedor = 'anthropic'): ConfigIA => ({
  provedor,
  chave: '',
  modelo: PROVEDORES[provedor].modelos[0],
  lembrar: false,
  url: provedor === 'ollama' ? 'http://localhost:11434' : undefined,
});

/** Perfil: conectar a conta de IA do usuário (chave só neste navegador) */
export function ConfigIAForm() {
  const id = useId();
  const [c, setC] = useState<ConfigIA>(() => lerConfigIA() ?? nova());
  const [salvo, setSalvo] = useState(!!lerConfigIA());
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [testando, setTestando] = useState(false);
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const tratouCodigo = useRef(false);
  const p = PROVEDORES[c.provedor];

  // volta do OpenRouter com ?code=...
  useEffect(() => {
    const codigo = params.get('code');
    if (!codigo || tratouCodigo.current) return;
    tratouCodigo.current = true;
    concluirOpenRouter(codigo)
      .then((chave) => {
        const cfg = { ...nova('openrouter'), chave };
        gravarConfigIA(cfg);
        setC(cfg);
        setSalvo(true);
        setMsg('Conta do OpenRouter conectada. A chave fica só nesta sessão do navegador.');
      })
      .catch((e) => setErro(e instanceof Error ? e.message : e))
      .finally(() => navegar('/perfil#ia', { replace: true }));
  }, [params, navegar]);

  const mudar = (parcial: Partial<ConfigIA>) => {
    setC((atual) => ({ ...atual, ...parcial }));
    setSalvo(false);
  };
  const salvar = () => {
    gravarConfigIA(c);
    setSalvo(true);
    setMsg(c.lembrar ? 'Conta de IA salva neste navegador.' : 'Conta de IA salva até fechar o navegador.');
  };
  const testar = async () => {
    setTestando(true);
    setErro(null);
    setMsg(null);
    try {
      const t = await gerarComIA(c, { sistema: 'Responda só com a palavra OK.', mensagem: 'Teste de conexão.' });
      setMsg(`Conexão funcionando (${p.nome} respondeu: "${t.trim().slice(0, 40)}").`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : e);
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="card mb-4" id="ia">
      <div className="card-body">
        <h2 className="h5">
          <i className="bi bi-stars me-1" aria-hidden="true" />
          Assistente de IA
        </h2>
        <p className="small text-secondary">
          Use a sua própria conta de IA para gerar textos do protocolo e da análise. O custo fica na sua conta; a chave
          fica só neste navegador e é enviada direto ao provedor, nunca ao servidor do Konektron. Sem chave, os botões
          de IA copiam o pedido e abrem o ChatGPT, Claude, Gemini ou Copilot na web.
        </p>
        <ErroAlerta erro={erro} />
        {msg && (
          <div className="alert alert-success py-2 small" role="status">
            {msg}
          </div>
        )}
        <label htmlFor={`${id}-prov`} className="form-label">
          Provedor
        </label>
        <select
          id={`${id}-prov`}
          className="form-select mb-2"
          value={c.provedor}
          onChange={(e) => {
            setC({ ...nova(e.target.value as Provedor), lembrar: c.lembrar });
            setSalvo(false);
          }}
        >
          {(Object.keys(PROVEDORES) as Provedor[]).map((k) => (
            <option key={k} value={k}>
              {PROVEDORES[k].nome}
            </option>
          ))}
        </select>
        <div className="form-text mb-3" id={`${id}-ajuda`}>
          {p.ajuda}{' '}
          {p.chaveUrl && (
            <a href={p.chaveUrl} target="_blank" rel="noopener noreferrer">
              Criar chave
              <span className="visually-hidden"> (abre em nova aba)</span>
            </a>
          )}
        </div>
        {c.provedor === 'openrouter' && (
          <button type="button" className="btn btn-outline-primary btn-sm mb-3" onClick={() => conectarOpenRouter()}>
            <i className="bi bi-link-45deg me-1" aria-hidden="true" />
            Conectar com OpenRouter
          </button>
        )}
        {c.provedor === 'ollama' ? (
          <>
            <label htmlFor={`${id}-url`} className="form-label">
              Endereço do Ollama
            </label>
            <input
              id={`${id}-url`}
              className="form-control mb-3 k-mono"
              value={c.url ?? ''}
              onChange={(e) => mudar({ url: e.target.value })}
            />
          </>
        ) : (
          <>
            <label htmlFor={`${id}-chave`} className="form-label">
              Chave de API
            </label>
            <input
              id={`${id}-chave`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="form-control mb-3 k-mono"
              aria-describedby={`${id}-ajuda`}
              value={c.chave}
              onChange={(e) => mudar({ chave: e.target.value.trim() })}
            />
          </>
        )}
        <label htmlFor={`${id}-modelo`} className="form-label">
          Modelo
        </label>
        <input
          id={`${id}-modelo`}
          className="form-control k-mono"
          list={`${id}-modelos`}
          aria-describedby={`${id}-modelo-ajuda`}
          value={c.modelo}
          onChange={(e) => mudar({ modelo: e.target.value.trim() })}
        />
        <datalist id={`${id}-modelos`}>
          {p.modelos.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <div className="form-text mb-3" id={`${id}-modelo-ajuda`}>
          Sugestões na lista; você pode digitar outro modelo do provedor.
        </div>
        <div className="form-check mb-3">
          <input
            id={`${id}-lembrar`}
            type="checkbox"
            className="form-check-input"
            checked={c.lembrar}
            onChange={(e) => mudar({ lembrar: e.target.checked })}
          />
          <label htmlFor={`${id}-lembrar`} className="form-check-label">
            Lembrar neste navegador (não use em computador compartilhado)
          </label>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvo}>
            Salvar
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={testar} disabled={testando}>
            {testando && <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />}
            Testar conexão
          </button>
          {lerConfigIA() && (
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={() => {
                gravarConfigIA(null);
                setC(nova(c.provedor));
                setSalvo(false);
                setMsg('Conta de IA removida deste navegador.');
              }}
            >
              Desconectar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
