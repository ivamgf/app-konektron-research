import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { post } from '../../lib/api';
import { ErroAlerta } from '../../components/ui';
import { CartaoAuth, ErroCampo, REGRA_SENHA } from './CartaoAuth';

export const senhaSchema = z
  .string()
  .min(8, 'Mínimo de 8 caracteres')
  .max(72, 'Máximo de 72 caracteres')
  .regex(/[A-Za-z]/, 'Inclua letras')
  .regex(/\d/, 'Inclua números');

// RF01: nome, e-mail, senha, instituição e ORCID (opcional); RNF07: consentimento LGPD
const schema = z
  .object({
    nome: z.string().trim().min(2, 'Informe seu nome'),
    email: z.email('Informe um e-mail válido'),
    senha: senhaSchema,
    confirmacao: z.string(),
    instituicao: z.string().trim().max(200).optional(),
    orcid: z
      .string()
      .trim()
      .regex(/^(\d{4}-\d{4}-\d{4}-\d{3}[\dX])?$/, 'Formato 0000-0000-0000-000X')
      .optional(),
    consentimentoLgpd: z.boolean().refine((v) => v, 'É preciso aceitar o termo de privacidade'),
  })
  .refine((d) => d.senha === d.confirmacao, { path: ['confirmacao'], message: 'As senhas não conferem' });
type Dados = z.infer<typeof schema>;

export function Registrar() {
  const [erro, setErro] = useState<unknown>(null);
  const [enviado, setEnviado] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Dados>({ resolver: zodResolver(schema), defaultValues: { consentimentoLgpd: false } });

  const enviar = handleSubmit(async ({ confirmacao: _c, instituicao, orcid, ...d }) => {
    setErro(null);
    try {
      await post('/auth/registrar', { ...d, instituicao: instituicao || undefined, orcid: orcid || undefined });
      setEnviado(d.email);
    } catch (e) {
      setErro(e);
    }
  });

  if (enviado)
    return (
      <CartaoAuth titulo="Confirme seu e-mail">
        <p>
          Enviamos um link de confirmação para <strong>{enviado}</strong>. Abra o e-mail e clique no link para ativar a
          conta.
        </p>
        <Link to="/login" className="btn btn-primary w-100">
          Ir para o login
        </Link>
      </CartaoAuth>
    );

  const campo = (
    nome: keyof Dados,
    rotulo: string,
    tipo = 'text',
    { className = '', ...extra }: Record<string, string> = {},
  ) => (
    <div className="mb-3">
      <label htmlFor={nome} className="form-label">
        {rotulo}
      </label>
      <input
        id={nome}
        type={tipo}
        {...extra}
        className={`form-control ${className} ${errors[nome] ? 'is-invalid' : ''}`}
        {...register(nome)}
      />
      <ErroCampo mensagem={errors[nome]?.message} />
    </div>
  );

  return (
    <CartaoAuth titulo="Criar conta" largura={480}>
      <ErroAlerta erro={erro} />
      <form onSubmit={enviar} noValidate>
        {campo('nome', 'Nome completo', 'text', { autoComplete: 'name' })}
        {campo('email', 'E-mail', 'email', { autoComplete: 'email' })}
        {campo('senha', 'Senha', 'password', { autoComplete: 'new-password', 'aria-describedby': 'regra-senha' })}
        <div id="regra-senha" className="form-text mt-n2 mb-3">
          {REGRA_SENHA}
        </div>
        {campo('confirmacao', 'Repita a senha', 'password', { autoComplete: 'new-password' })}
        {campo('instituicao', 'Instituição (opcional)', 'text', { autoComplete: 'organization' })}
        {campo('orcid', 'ORCID (opcional)', 'text', { placeholder: '0000-0000-0000-000X', className: 'k-mono' })}
        <div className="form-check mb-3">
          <input
            id="lgpd"
            type="checkbox"
            className={`form-check-input ${errors.consentimentoLgpd ? 'is-invalid' : ''}`}
            {...register('consentimentoLgpd')}
          />
          <label htmlFor="lgpd" className="form-check-label small">
            Concordo com o tratamento dos meus dados pessoais para uso do sistema, conforme a LGPD. Posso exportar ou
            excluir meus dados a qualquer momento no meu perfil.
          </label>
          <ErroCampo mensagem={errors.consentimentoLgpd?.message} />
        </div>
        <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting}>
          {isSubmitting && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
          Criar conta
        </button>
      </form>
      <p className="text-center small mt-3 mb-0">
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </CartaoAuth>
  );
}
