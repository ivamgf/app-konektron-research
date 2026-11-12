import { useEffect, useId, useRef, useState } from 'react';
import { IDIOMAS_SITE, idiomaAtual, trocarIdioma, type IdiomaSite } from '../lib/traducaoSite';

/**
 * Escolha do idioma da interface (português original; inglês, espanhol e francês por tradução automática).
 * Botão compacto com a sigla do idioma e um menu com o nome de cada idioma na própria língua.
 */
export function SeletorIdioma({
  className = '',
  direcao = 'baixo',
  largo = false,
}: {
  className?: string;
  /** para onde o menu abre: "cima" no rodapé do menu lateral */
  direcao?: 'cima' | 'baixo';
  /** ocupa a largura toda (menu lateral) */
  largo?: boolean;
}) {
  const id = useId();
  const atual = idiomaAtual();
  const info = IDIOMAS_SITE.find((i) => i.codigo === atual) ?? IDIOMAS_SITE[0];
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  // fecha com Esc (devolvendo o foco) e com clique fora
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setAberto(false);
      botao.current?.focus();
    };
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('keydown', tecla, true);
    document.addEventListener('mousedown', fora);
    // foco no idioma atual ao abrir
    raiz.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus();
    return () => {
      document.removeEventListener('keydown', tecla, true);
      document.removeEventListener('mousedown', fora);
    };
  }, [aberto]);

  // setas para navegar entre os idiomas do menu
  const navegar = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const itens = [...(raiz.current?.querySelectorAll<HTMLButtonElement>('.k-idioma-opcao') ?? [])];
    const i = itens.indexOf(document.activeElement as HTMLButtonElement);
    const prox =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? itens.length - 1
          : (i + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length;
    itens[prox]?.focus();
  };

  const escolher = (codigo: IdiomaSite) => {
    setAberto(false);
    if (codigo !== atual) trocarIdioma(codigo);
  };

  return (
    <div
      ref={raiz}
      className={`k-idioma position-relative notranslate ${largo ? 'd-block' : 'd-inline-block'} ${className}`}
      translate="no"
    >
      <button
        ref={botao}
        type="button"
        className={`k-idioma-botao btn btn-sm d-inline-flex align-items-center gap-2 ${largo ? 'w-100' : ''}`}
        aria-haspopup="true"
        aria-expanded={aberto}
        aria-controls={id}
        title="Idioma / Language / Idioma / Langue"
        onClick={() => setAberto((v) => !v)}
      >
        <i className="bi bi-globe2" aria-hidden="true" />
        <span className="visually-hidden">Idioma da interface / Interface language / Langue de l'interface: </span>
        <span className="k-idioma-sigla" lang={info.lang}>
          {info.curto}
        </span>
        {largo && (
          <span className="me-auto" lang={info.lang}>
            {info.nome}
          </span>
        )}
        <i className={`bi ${aberto ? 'bi-chevron-up' : 'bi-chevron-down'} small`} aria-hidden="true" />
      </button>
      {aberto && (
        <div
          id={id}
          className={`k-idioma-menu shadow ${direcao === 'cima' ? 'k-idioma-cima' : ''} ${largo ? 'k-idioma-largo' : ''}`}
        >
          <ul className="list-unstyled mb-0" onKeyDown={navegar} aria-label="Idiomas / Languages">
            {IDIOMAS_SITE.map((i) => (
              <li key={i.codigo}>
                <button
                  type="button"
                  className={`k-idioma-opcao ${i.codigo === atual ? 'ativo' : ''}`}
                  lang={i.lang}
                  aria-current={i.codigo === atual ? 'true' : undefined}
                  onClick={() => escolher(i.codigo)}
                >
                  <span className="k-idioma-sigla">{i.curto}</span>
                  <span className="me-auto">{i.nome}</span>
                  {i.codigo === atual && <i className="bi bi-check2" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="k-idioma-rodape" lang="en">
            <i className="bi bi-translate me-1" aria-hidden="true" />
            {atual === 'pt' ? 'Original em português · auto-translate by Google' : 'Machine translation by Google'}
          </div>
        </div>
      )}
    </div>
  );
}
