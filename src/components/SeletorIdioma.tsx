import { useId } from 'react';
import { IDIOMAS_SITE, idiomaAtual, trocarIdioma, type IdiomaSite } from '../lib/traducaoSite';

/** Escolha do idioma da interface (tradução automática para inglês e espanhol) */
export function SeletorIdioma({ className = '' }: { className?: string }) {
  const id = useId();
  const atual = idiomaAtual();
  return (
    <div className={`d-inline-flex align-items-center gap-1 notranslate ${className}`} translate="no">
      <label htmlFor={id} className="mb-0" title="Idioma / Language / Idioma">
        <i className="bi bi-translate" aria-hidden="true" />
        <span className="visually-hidden">Idioma da interface / Interface language / Idioma de la interfaz</span>
      </label>
      <select
        id={id}
        className="form-select form-select-sm w-auto"
        value={atual}
        onChange={(e) => trocarIdioma(e.target.value as IdiomaSite)}
      >
        {IDIOMAS_SITE.map((i) => (
          <option key={i.codigo} value={i.codigo} lang={i.lang}>
            {i.nome}
          </option>
        ))}
      </select>
      {atual !== 'pt' && (
        <span className="small text-secondary d-none d-xl-inline" lang="en" title="Machine translation by Google">
          auto<span className="visually-hidden"> (machine translation by Google)</span>
        </span>
      )}
    </div>
  );
}
