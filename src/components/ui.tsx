import { useEffect, useId, useRef, useState, type KeyboardEvent as TecladoEvento, type ReactNode } from 'react';
import { mensagemDeErro } from '../lib/api';
import { corDaSituacao, ICONE_SITUACAO, rotulo } from '../lib/formato';

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="d-flex justify-content-center align-items-center gap-2 text-secondary py-5" role="status">
      <span className="spinner-border spinner-border-sm text-primary" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

/** Tela cheia ao abrir o app: logo no centro de um spinner do Bootstrap, nome e mensagem, centralizados */
export function TelaCarregando({ texto = 'Abrindo o Konektron Research…' }: { texto?: string }) {
  return (
    <div
      className="min-vh-100 d-flex flex-column justify-content-center align-items-center gap-4 bg-body-tertiary px-3 text-center"
      role="status"
      aria-live="polite"
    >
      <div
        className="position-relative d-flex justify-content-center align-items-center"
        style={{ width: 128, height: 128 }}
      >
        <span
          className="spinner-border text-primary position-absolute top-0 start-0"
          style={{ width: 128, height: 128, borderWidth: 6 }}
          aria-hidden="true"
        />
        <img
          src="/brand/konektron.png"
          alt=""
          width={76}
          height={76}
          className="rounded-circle bg-body shadow-sm p-1"
        />
      </div>
      <div>
        <div className="fs-4 fw-bold notranslate" translate="no">
          KoneKtron <span className="text-primary">Research</span>
        </div>
        <div className="text-secondary">{texto}</div>
      </div>
      <div className="progress w-100" style={{ maxWidth: 240, height: 4 }} aria-hidden="true">
        <div className="progress-bar progress-bar-striped progress-bar-animated w-100" />
      </div>
    </div>
  );
}

export function ErroAlerta({ erro, className = '' }: { erro: unknown; className?: string }) {
  if (!erro) return null;
  return (
    <div className={`alert alert-danger d-flex gap-2 ${className}`} role="alert">
      <i className="bi bi-x-circle-fill" aria-hidden="true" />
      <div>{typeof erro === 'string' ? erro : mensagemDeErro(erro)}</div>
    </div>
  );
}

export function Vazio({ icone = 'bi-inbox', children }: { icone?: string; children: ReactNode }) {
  return (
    <div className="text-center text-secondary py-5 border rounded bg-body">
      <i className={`bi ${icone} fs-2 d-block mb-2`} aria-hidden="true" />
      {children}
    </div>
  );
}

/** Badge de situação com o ícone da ERS 8.3 */
export function Situacao({ valor, texto }: { valor: string | null | undefined; texto?: string }) {
  const cor = corDaSituacao(valor);
  const fundoClaro = cor === 'warning' || cor === 'secondary';
  return (
    <span className={`badge text-bg-${cor} ${fundoClaro ? '' : ''}`}>
      <i className={`bi ${ICONE_SITUACAO[cor] ?? 'bi-circle'} me-1`} aria-hidden="true" />
      {texto ?? rotulo(valor)}
    </span>
  );
}

export function Cabecalho({
  titulo,
  subtitulo,
  children,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
      <div>
        <h1 className="k-display mb-1">{titulo}</h1>
        {subtitulo && <div className="text-secondary small">{subtitulo}</div>}
      </div>
      {children && <div className="d-flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

const FOCAVEIS =
  'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), summary';

/** Modal controlado pelo React com a aparência do Bootstrap (sem o JS do Bootstrap) */
export function Modal({
  titulo,
  aberto,
  aoFechar,
  children,
  rodape,
  tamanho,
}: {
  titulo: ReactNode;
  aberto: boolean;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  tamanho?: 'sm' | 'lg' | 'xl';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button:not(.btn-close)')?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        aoFechar();
        return;
      }
      // WCAG 2.4.3 / APG Dialog: o Tab fica preso dentro do modal
      if (e.key !== 'Tab' || !ref.current) return;
      const focaveis = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
        (el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0,
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement;
      if (e.shiftKey && (ativo === primeiro || !ref.current.contains(ativo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (ativo === ultimo || !ref.current.contains(ativo))) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', esc);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.classList.remove('modal-open');
      anterior?.focus?.();
    };
  }, [aberto, aoFechar]);
  if (!aberto) return null;
  return (
    <>
      <div className="modal-backdrop show" />
      <div
        className="modal d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}
      >
        <div className={`modal-dialog modal-dialog-scrollable ${tamanho ? `modal-${tamanho}` : ''}`} ref={ref}>
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5" id={idTitulo}>
                {titulo}
              </h2>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={aoFechar} />
            </div>
            <div className="modal-body">{children}</div>
            {rodape && <div className="modal-footer">{rodape}</div>}
          </div>
        </div>
      </div>
    </>
  );
}

/** Botão que pede confirmação antes de executar (exclusões etc.) */
export function BotaoConfirmar({
  pergunta,
  aoConfirmar,
  children,
  className = 'btn btn-outline-danger btn-sm',
  disabled,
  titulo,
}: {
  pergunta: ReactNode;
  aoConfirmar: () => Promise<unknown> | unknown;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  titulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [ocupado, setOcupado] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled}
        title={titulo}
        aria-label={titulo}
        onClick={() => setAberto(true)}
      >
        {children}
      </button>
      <Modal
        titulo="Confirmar"
        aberto={aberto}
        aoFechar={() => {
          setAberto(false);
          setErro(null);
        }}
        tamanho="sm"
        rodape={
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setAberto(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={ocupado}
              onClick={async () => {
                setOcupado(true);
                try {
                  await aoConfirmar();
                  setAberto(false);
                } catch (e) {
                  setErro(e);
                } finally {
                  setOcupado(false);
                }
              }}
            >
              Confirmar
            </button>
          </>
        }
      >
        <p className="mb-0">{pergunta}</p>
        <ErroAlerta erro={erro} className="mt-3 mb-0" />
      </Modal>
    </>
  );
}

export function Paginacao({
  page,
  pageSize,
  total,
  aoMudar,
}: {
  page: number;
  pageSize: number;
  total: number;
  aoMudar: (p: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / pageSize));
  if (paginas <= 1) return null;
  return (
    <nav aria-label="Paginação" className="d-flex align-items-center gap-2 mt-3">
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        disabled={page <= 1}
        onClick={() => aoMudar(page - 1)}
      >
        <i className="bi bi-chevron-left" aria-hidden="true" /> Anterior
      </button>
      <span className="small text-secondary" aria-live="polite">
        Página {page} de {paginas} · {total} registros
      </span>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        disabled={page >= paginas}
        onClick={() => aoMudar(page + 1)}
      >
        Próxima <i className="bi bi-chevron-right" aria-hidden="true" />
      </button>
    </nav>
  );
}

export function BarraProgresso({ valor, rotulo: texto }: { valor: number; rotulo?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(valor)));
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={texto ?? 'Progresso'}
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ height: 8 }}
    >
      <div className="progress-bar" style={{ width: `${v}%` }} />
    </div>
  );
}

/** Indicador "Salvo" do salvamento automático (ERS 8.4) */
export function IndicadorSalvo({ estado }: { estado: 'ocioso' | 'salvando' | 'salvo' | 'erro' }) {
  if (estado === 'ocioso') return null;
  if (estado === 'salvando')
    return (
      <span className="small text-secondary" role="status">
        <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
        Salvando…
      </span>
    );
  if (estado === 'erro')
    return (
      <span className="small text-danger" role="status">
        <i className="bi bi-x-circle me-1" aria-hidden="true" />
        Não foi possível salvar
      </span>
    );
  return (
    <span className="small text-success" role="status">
      <i className="bi bi-check-circle-fill me-1" aria-hidden="true" />
      Salvo
    </span>
  );
}

/**
 * Abas no padrão WAI-ARIA (APG Tabs): role tablist/tab/tabpanel, aria-selected, tabindex móvel e
 * navegação por setas, Home e End. Ativação automática: a seta já mostra o painel.
 */
export function Abas<T extends string>({
  abas,
  atual,
  aoMudar,
  rotulo,
  className = 'nav nav-tabs mb-3',
  classeBotao = '',
  idBase,
  children,
}: {
  abas: readonly { id: T; texto: ReactNode; icone?: string }[];
  atual: T;
  aoMudar: (id: T) => void;
  rotulo: string;
  className?: string;
  classeBotao?: string;
  /** quando o painel fica em outro ponto da tela: use <PainelAba idBase=... atual=...> com o mesmo id */
  idBase?: string;
  children?: ReactNode;
}) {
  const automatico = useId();
  const base = idBase ?? automatico;
  const idAba = (id: string) => `${base}-aba-${id}`;
  const idPainel = `${base}-painel`;
  const teclado = (e: TecladoEvento<HTMLButtonElement>, i: number) => {
    const n = abas.length;
    const destino =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? (i + 1) % n
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? (i - 1 + n) % n
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : -1;
    if (destino < 0) return;
    e.preventDefault();
    aoMudar(abas[destino].id);
    document.getElementById(idAba(abas[destino].id))?.focus();
  };
  return (
    <>
      <ul className={className} role="tablist" aria-label={rotulo}>
        {abas.map((a, i) => (
          <li className="nav-item" role="presentation" key={a.id}>
            <button
              type="button"
              role="tab"
              id={idAba(a.id)}
              aria-selected={atual === a.id}
              aria-controls={idPainel}
              tabIndex={atual === a.id ? 0 : -1}
              className={`nav-link ${classeBotao} ${atual === a.id ? 'active' : ''}`}
              onClick={() => aoMudar(a.id)}
              onKeyDown={(e) => teclado(e, i)}
            >
              {a.icone && <i className={`bi ${a.icone} me-1`} aria-hidden="true" />}
              {a.texto}
            </button>
          </li>
        ))}
      </ul>
      {children !== undefined && (
        <PainelAba idBase={base} atual={atual}>
          {children}
        </PainelAba>
      )}
    </>
  );
}

/** Painel das <Abas> quando ele não fica logo abaixo da lista de abas */
export function PainelAba({
  idBase,
  atual,
  className,
  children,
}: {
  idBase: string;
  atual: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="tabpanel" id={`${idBase}-painel`} aria-labelledby={`${idBase}-aba-${atual}`} className={className}>
      {children}
    </div>
  );
}
