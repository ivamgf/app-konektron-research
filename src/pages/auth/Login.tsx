import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../auth/AuthProvider';
import { lerErro } from '../../lib/api';
import { ErroAlerta } from '../../components/ui';
import { CartaoAuth, ErroCampo } from './CartaoAuth';

const schema = z.object({
  email: z.email('Informe um e-mail válido'),
  senha: z.string().min(1, 'Informe a senha'),
});
type Dados = z.infer<typeof schema>;

export function Login() {
  const { usuario, entrar } = useAuth();
  const navegar = useNavigate();
  const local = useLocation();
  const destino = (local.state as { de?: string } | null)?.de ?? '/projetos';
  const [erro, setErro] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Dados>({ resolver: zodResolver(schema) });

  if (usuario) return <Navigate to={destino} replace />;

  const enviar = handleSubmit(async ({ email, senha }) => {
    setErro(null);
    try {
      await entrar(email, senha);
      navegar(destino, { replace: true });
    } catch (e) {
      const { status, mensagem } = lerErro(e);
      setErro(status === 429 ? 'Muitas tentativas. Aguarde um minuto e tente de novo.' : mensagem);
    }
  });

  return (
    <CartaoAuth titulo="Entrar">
      <ErroAlerta erro={erro} />
      <form onSubmit={enviar} noValidate>
        <div className="mb-3">
          <label htmlFor="email" className="form-label">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={`form-control ${errors.email ? 'is-invalid' : ''}`}
            {...register('email')}
          />
          <ErroCampo mensagem={errors.email?.message} />
        </div>
        <div className="mb-3">
          <label htmlFor="senha" className="form-label">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            autoComplete="current-password"
            className={`form-control ${errors.senha ? 'is-invalid' : ''}`}
            {...register('senha')}
          />
          <ErroCampo mensagem={errors.senha?.message} />
        </div>
        <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting}>
          {isSubmitting && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
          Entrar
        </button>
      </form>
      <div className="d-flex justify-content-between mt-3 small">
        <Link to="/esqueci-senha">Esqueci minha senha</Link>
        <Link to="/registrar">Criar conta</Link>
      </div>
    </CartaoAuth>
  );
}
