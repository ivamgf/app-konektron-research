import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { post } from '../../lib/api';
import { ErroAlerta } from '../../components/ui';
import { ariaErro, CartaoAuth, ErroCampo, REGRA_SENHA, senhaSchema } from './CartaoAuth';

export function EsqueciSenha() {
  const [erro, setErro] = useState<unknown>(null);
  const [enviado, setEnviado] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: z.email('Informe um e-mail válido') })) });

  const enviar = handleSubmit(async ({ email }) => {
    setErro(null);
    try {
      await post('/auth/esqueci-senha', { email });
      setEnviado(true);
    } catch (e) {
      setErro(e);
    }
  });

  return (
    <CartaoAuth titulo="Recuperar senha">
      {enviado ? (
        <div className="alert alert-success">
          Se o e-mail estiver cadastrado, enviamos as instruções para criar uma nova senha.
        </div>
      ) : (
        <>
          <ErroAlerta erro={erro} />
          <form onSubmit={enviar} noValidate>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">
                E-mail da conta
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                {...ariaErro('email', errors.email)}
                {...register('email')}
              />
              <ErroCampo id="email" mensagem={errors.email?.message} />
            </div>
            <button className="btn btn-primary w-100" disabled={isSubmitting}>
              Enviar link
            </button>
          </form>
        </>
      )}
      <p className="text-center small mt-3 mb-0">
        <Link to="/login">Voltar ao login</Link>
      </p>
    </CartaoAuth>
  );
}

const schemaNova = z.object({ senha: senhaSchema, confirmacao: z.string() }).refine((d) => d.senha === d.confirmacao, {
  path: ['confirmacao'],
  message: 'As senhas não conferem',
});

/** Link do e-mail: APP_URL/redefinir-senha?token=... */
export function RedefinirSenha() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [erro, setErro] = useState<unknown>(null);
  const [pronto, setPronto] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schemaNova>>({ resolver: zodResolver(schemaNova) });

  const enviar = handleSubmit(async ({ senha }) => {
    setErro(null);
    try {
      await post('/auth/redefinir-senha', { token, senha });
      setPronto(true);
    } catch (e) {
      setErro(e);
    }
  });

  return (
    <CartaoAuth titulo="Nova senha">
      {!token && <ErroAlerta erro="Link inválido: abra o link enviado por e-mail." />}
      {pronto ? (
        <>
          <div className="alert alert-success">Senha alterada. Entre com a nova senha.</div>
          <Link to="/login" className="btn btn-primary w-100">
            Ir para o login
          </Link>
        </>
      ) : (
        <>
          <ErroAlerta erro={erro} />
          <form onSubmit={enviar} noValidate>
            <div className="mb-3">
              <label htmlFor="senha" className="form-label">
                Nova senha
              </label>
              <input
                id="senha"
                type="password"
                autoComplete="new-password"
                className={`form-control ${errors.senha ? 'is-invalid' : ''}`}
                {...ariaErro('senha', errors.senha, 'senha-regra')}
                {...register('senha')}
              />
              <div className="form-text" id="senha-regra">
                {REGRA_SENHA}
              </div>
              <ErroCampo id="senha" mensagem={errors.senha?.message} />
            </div>
            <div className="mb-3">
              <label htmlFor="confirmacao" className="form-label">
                Repita a nova senha
              </label>
              <input
                id="confirmacao"
                type="password"
                autoComplete="new-password"
                className={`form-control ${errors.confirmacao ? 'is-invalid' : ''}`}
                {...ariaErro('confirmacao', errors.confirmacao)}
                {...register('confirmacao')}
              />
              <ErroCampo id="confirmacao" mensagem={errors.confirmacao?.message} />
            </div>
            <button className="btn btn-primary w-100" disabled={isSubmitting || !token}>
              Salvar nova senha
            </button>
          </form>
        </>
      )}
    </CartaoAuth>
  );
}
