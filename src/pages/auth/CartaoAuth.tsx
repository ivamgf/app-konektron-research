import type { ReactNode } from 'react';
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
    <main className="k-auth d-flex align-items-center justify-content-center p-3">
      <div className="card shadow-sm w-100" style={{ maxWidth: largura }}>
        <div className="card-body p-4">
          <div className="text-center mb-3">
            <Marca grande />
          </div>
          <h1 className="h4 text-center mb-4">{titulo}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}

/** Mensagem de erro de um campo do formulário */
export function ErroCampo({ mensagem }: { mensagem?: string }) {
  return mensagem ? <div className="invalid-feedback d-block">{mensagem}</div> : null;
}

// Mesma regra de senha da API (auth.schemas.ts)
export const REGRA_SENHA = 'Mínimo de 8 caracteres, com letras e números.';
