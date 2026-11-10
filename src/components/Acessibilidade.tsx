import { useEffect, useId, useRef, useState } from 'react';
import {
  aplicarPreferencias,
  ehPadrao,
  formatarTamanho,
  gravarPreferencias,
  lerPreferencias,
  PADRAO,
  proximoTamanho,
  TAMANHOS_FONTE,
  type PreferenciasAcessibilidade,
} from '../lib/acessibilidade';

type Opcao = Exclude<keyof PreferenciasAcessibilidade, 'fonte'>;
const OPCOES: { chave: Opcao; texto: string; ajuda: string; icone: string }[] = [
  {
    chave: 'contraste',
    texto: 'Alto contraste',
    ajuda: 'Fundo preto, texto branco, links em amarelo',
    icone: 'bi-circle-half',
  },
  {
    chave: 'fonteLegivel',
    texto: 'Fonte mais legível',
    ajuda: 'Letras mais abertas (baixa visão, dislexia)',
    icone: 'bi-fonts',
  },
  {
    chave: 'espacamento',
    texto: 'Mais espaço no texto',
    ajuda: 'Entre linhas, letras, palavras e parágrafos',
    icone: 'bi-text-paragraph',
  },
  { chave: 'sublinharLinks', texto: 'Sublinhar links', ajuda: 'Links não dependem só da cor', icone: 'bi-link-45deg' },
  {
    chave: 'focoReforcado',
    texto: 'Foco reforçado',
    ajuda: 'Moldura grossa no item com o foco do teclado',
    icone: 'bi-bounding-box',
  },
  { chave: 'cursorGrande', texto: 'Cursor grande', ajuda: 'Ponteiro do mouse maior', icone: 'bi-cursor' },
  {
    chave: 'guiaLeitura',
    texto: 'Guia de leitura',
    ajuda: 'Faixa que acompanha o mouse na linha lida',
    icone: 'bi-distribute-vertical',
  },
  { chave: 'semAnimacao', texto: 'Pausar animações', ajuda: 'Sem movimentos e transições', icone: 'bi-pause-circle' },
];

/** Abre o painel de outro lugar (ex.: link no topo da página) */
export const EVENTO_ABRIR = 'k-abrir-acessibilidade';
export const abrirAcessibilidade = () => document.dispatchEvent(new Event(EVENTO_ABRIR));

/** Link no topo, junto do "Pular para o conteúdo": aparece ao receber o foco do teclado */
export function LinkAcessibilidade() {
  return (
    <button
      type="button"
      className="btn btn-link visually-hidden-focusable position-absolute p-2"
      style={{ left: '12rem' }}
      onClick={abrirAcessibilidade}
    >
      Opções de acessibilidade (Alt+Shift+A)
    </button>
  );
}

/** Atalho do painel: Alt + Shift + A */
const ehAtalho = (e: KeyboardEvent) => e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyA';

/**
 * Botão de acessibilidade (fixo no canto da tela, em todas as páginas) com o painel de ajustes:
 * alto contraste, tamanho da fonte e as outras opções de {@link PreferenciasAcessibilidade}.
 */
export function Acessibilidade() {
  const [p, setP] = useState(lerPreferencias);
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState('');
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const titulo = useId();

  const mudar = (novo: PreferenciasAcessibilidade, mensagem: string) => {
    setP(novo);
    aplicarPreferencias(novo);
    gravarPreferencias(novo);
    setAviso(mensagem);
  };
  const alternar = (k: Opcao, texto: string) =>
    mudar({ ...p, [k]: !p[k] }, `${texto}: ${p[k] ? 'desligado' : 'ligado'}`);
  const fonte = (passo: 1 | -1) => {
    const t = proximoTamanho(p.fonte, passo);
    mudar({ ...p, fonte: t }, `Tamanho do texto: ${formatarTamanho(t)}`);
  };
  const fechar = () => {
    setAberto(false);
    botao.current?.focus();
  };

  // atalho Alt+Shift+A abre e fecha o painel
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!ehAtalho(e)) return;
      e.preventDefault();
      setAberto((a) => !a);
    };
    const abrir = () => setAberto(true);
    document.addEventListener('keydown', tecla);
    document.addEventListener(EVENTO_ABRIR, abrir);
    return () => {
      document.removeEventListener('keydown', tecla);
      document.removeEventListener(EVENTO_ABRIR, abrir);
    };
  }, []);

  // aberto: foco no título; Esc fecha; clique fora fecha
  useEffect(() => {
    if (!aberto) return;
    painel.current?.querySelector<HTMLElement>('[data-foco-inicial]')?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setAberto(false);
        botao.current?.focus();
      }
    };
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!painel.current?.contains(alvo) && !botao.current?.contains(alvo)) setAberto(false);
    };
    document.addEventListener('keydown', esc, true);
    document.addEventListener('pointerdown', fora);
    return () => {
      document.removeEventListener('keydown', esc, true);
      document.removeEventListener('pointerdown', fora);
    };
  }, [aberto]);

  const minimo = p.fonte === TAMANHOS_FONTE[0];
  const maximo = p.fonte === TAMANHOS_FONTE[TAMANHOS_FONTE.length - 1];
  const ativos = (Object.keys(PADRAO) as (keyof PreferenciasAcessibilidade)[]).filter((k) => p[k] !== PADRAO[k]).length;

  return (
    <div className="k-a11y">
      <button
        ref={botao}
        type="button"
        className="k-a11y-botao btn btn-primary rounded-circle shadow"
        aria-expanded={aberto}
        aria-controls="painel-acessibilidade"
        aria-keyshortcuts="Alt+Shift+A"
        title="Acessibilidade (Alt+Shift+A)"
        onClick={() => setAberto((a) => !a)}
      >
        <i className="bi bi-universal-access-circle" aria-hidden="true" />
        <span className="visually-hidden">Acessibilidade{ativos ? ` (${ativos} ajuste(s) ativo(s))` : ''}</span>
        {ativos > 0 && (
          <span className="k-a11y-ativos badge rounded-pill text-bg-warning" aria-hidden="true">
            {ativos}
          </span>
        )}
      </button>
      <div
        ref={painel}
        id="painel-acessibilidade"
        role="dialog"
        aria-labelledby={titulo}
        className="k-a11y-painel card shadow"
        hidden={!aberto}
      >
        <div className="card-header d-flex align-items-center gap-2">
          <h2 id={titulo} className="h6 mb-0 me-auto" tabIndex={-1} data-foco-inicial>
            <i className="bi bi-universal-access-circle me-1" aria-hidden="true" />
            Acessibilidade
          </h2>
          <button type="button" className="btn-close" aria-label="Fechar acessibilidade" onClick={() => fechar()} />
        </div>
        <div className="card-body">
          <div className="mb-3" role="group" aria-labelledby={`${titulo}-fonte`}>
            <div id={`${titulo}-fonte`} className="small fw-medium mb-1">
              Tamanho do texto: <span>{formatarTamanho(p.fonte)}</span>
            </div>
            <div className="btn-group w-100">
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={minimo}
                aria-label="Diminuir o texto"
                onClick={() => fonte(-1)}
              >
                A<sup>−</sup>
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={p.fonte === 100}
                aria-label="Texto no tamanho normal"
                onClick={() => mudar({ ...p, fonte: 100 }, 'Tamanho do texto: normal')}
              >
                A
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={maximo}
                aria-label="Aumentar o texto"
                onClick={() => fonte(1)}
              >
                A<sup>+</sup>
              </button>
            </div>
          </div>
          <ul className="list-unstyled mb-3 d-grid gap-2">
            {OPCOES.map((o) => (
              <li key={o.chave} className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id={`${titulo}-${o.chave}`}
                  checked={p[o.chave]}
                  aria-describedby={`${titulo}-${o.chave}-ajuda`}
                  onChange={() => alternar(o.chave, o.texto)}
                />
                <label className="form-check-label" htmlFor={`${titulo}-${o.chave}`}>
                  <i className={`bi ${o.icone} me-1`} aria-hidden="true" />
                  {o.texto}
                </label>
                <div id={`${titulo}-${o.chave}-ajuda`} className="small text-secondary">
                  {o.ajuda}
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm w-100"
            disabled={ehPadrao(p)}
            onClick={() => mudar({ ...PADRAO }, 'Ajustes de acessibilidade restaurados')}
          >
            <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true" />
            Restaurar o padrão
          </button>
          <p className="small text-secondary mt-2 mb-0">
            Atalho: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd>. Os ajustes ficam salvos neste navegador. A
            tradução em Libras está no botão VLibras.
          </p>
        </div>
      </div>
      <div className="visually-hidden" role="status" aria-live="polite">
        {aviso}
      </div>
      {p.guiaLeitura && <GuiaDeLeitura />}
    </div>
  );
}

/** Faixa horizontal que acompanha o ponteiro e escurece o resto da tela */
function GuiaDeLeitura() {
  const [y, setY] = useState<number | null>(null);
  useEffect(() => {
    const mover = (e: PointerEvent) => setY(e.clientY);
    document.addEventListener('pointermove', mover);
    return () => document.removeEventListener('pointermove', mover);
  }, []);
  if (y === null) return null;
  return (
    <>
      <div className="k-guia-sombra" style={{ top: 0, height: Math.max(0, y - 28) }} aria-hidden="true" />
      <div className="k-guia-faixa" style={{ top: y - 28 }} aria-hidden="true" />
      <div className="k-guia-sombra" style={{ top: y + 28, bottom: 0 }} aria-hidden="true" />
    </>
  );
}
