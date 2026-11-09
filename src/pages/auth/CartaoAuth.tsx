import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Marca } from '../../components/Layout';

/** Card centralizado sobre fundo secondary-100 (ERS 8.4: Login / cadastro) */
export function CartaoAuth({
  titulo,
  children,
  largura = 420,
}: {
  titulo: string;
  children: ReactNode;
  largura?: number;
}) {
  return (
    <main className="k-auth d-flex flex-column align-items-center justify-content-center p-3">
      <div className="card shadow-sm w-100" style={{ maxWidth: largura }}>
        <div className="card-body p-4">
          <div className="text-center mb-3">
            <Link to="/" className="text-decoration-none text-reset" aria-label="Konektron Research: página inicial">
              <Marca grande />
            </Link>
          </div>
          <h1 className="h4 text-center mb-4">{titulo}</h1>
          {children}
        </div>
      </div>
      <Link to="/" className="small mt-3">
        <i className="bi bi-arrow-left me-1" aria-hidden="true" />
        Voltar ao início
      </Link>
    </main>
  );
}

/** Mensagem de erro de um campo do formulário (ligue ao campo com ariaErro(id, erro)) */
export function ErroCampo({ mensagem, id }: { mensagem?: string; id?: string }) {
  return mensagem ? (
    <div className="invalid-feedback d-block" id={id ? `${id}-erro` : undefined}>
      <i className="bi bi-exclamation-circle me-1" aria-hidden="true" />
      {mensagem}
    </div>
  ) : null;
}

/** WCAG 3.3.1 / ARIA: marca o campo como inválido e aponta para a mensagem de erro */
export function ariaErro(id: string, erro: unknown, descricao?: string) {
  const ids = [descricao, erro ? `${id}-erro` : undefined].filter(Boolean).join(' ');
  return { 'aria-invalid': erro ? true : undefined, 'aria-describedby': ids || undefined } as const;
}

// Mesma regra de senha da API (auth.schemas.ts)
export const REGRA_SENHA = 'Mínimo de 8 caracteres, com letras e números.';
export const senhaSchema = z
  .string()
  .min(8, 'Mínimo de 8 caracteres')
  .max(72, 'Máximo de 72 caracteres')
  .regex(/[A-Za-z]/, 'Inclua letras')
  .regex(/\d/, 'Inclua números');
