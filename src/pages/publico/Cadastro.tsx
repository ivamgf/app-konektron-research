import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../auth/AuthProvider';
import { lerErro, post } from '../../lib/api';
import { nomePlano, PLANOS, preco, type Plano } from '../../lib/planos';
import { ErroAlerta } from '../../components/ui';
import { ariaErro, ErroCampo, REGRA_SENHA, senhaSchema } from '../auth/CartaoAuth';
import { LayoutPublico } from './LayoutPublico';

const opcional = (s: z.ZodString) =>
  z.preprocess((v) => (typeof v === 'string' && !v.trim() ? undefined : v), s.optional());

// Mesmas regras de POST /auth/registrar (auth.schemas.ts da API)
const schema = z
  .object({
    nome: z.string().trim().min(2, 'Informe o nome completo').max(150),
    email: z.email('Informe um e-mail válido').max(255),
    senha: senhaSchema,
    confirmar: z.string(),
    instituicao: opcional(z.string().trim().max(200)),
    orcid: opcional(z.string().regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, 'Formato 0000-0000-0000-000X')),
    consentimentoLgpd: z.literal(true, { error: 'É preciso aceitar o tratamento dos dados' }),
  })
  .refine((d) => d.senha === d.confirmar, { path: ['confirmar'], error: 'As senhas não conferem' });
type Entrada = z.input<typeof schema>;
type Dados = z.output<typeof schema>;

const planoValido = (p: string | null): Plano => (p === 'STANDARD' || p === 'MASTER' ? p : 'FREE');

/** Cadastro aberto: cria a conta (plano Free) e, se o visitante escolheu um plano pago, segue para a assinatura */
export function Cadastro() {
  const { usuario, entrar } = useAuth();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const plano = planoValido(params.get('plano'));
  const ciclo = params.get('ciclo') === 'ANUAL' ? 'ANUAL' : 'MENSAL';
  const info = PLANOS.find((p) => p.id === plano)!;
  const valor = ciclo === 'MENSAL' ? info.mensal : info.anual;
  const destino = plano === 'FREE' ? '/projetos' : `/planos?assinar=${plano}&ciclo=${ciclo}`;
  const [erro, setErro] = useState<unknown>(null);
  const [criada, setCriada] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Entrada, unknown, Dados>({ resolver: zodResolver(schema) });

  if (usuario && !criada) return <Navigate to={destino} replace />;

  const enviar = handleSubmit(async ({ confirmar: _confirmar, ...dados }) => {
    setErro(null);
    try {
      await post('/auth/registrar', dados);
    } catch (e) {
      const { status, mensagem } = lerErro(e);
      setErro(status === 429 ? 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' : mensagem);
      return;
    }
    setCriada(true);
    try {
      await entrar(dados.email, dados.senha);
      navegar(destino, { replace: true });
    } catch {
      // conta criada, mas o login automático falhou: a tela de sucesso leva ao login
    }
  });

  const campo = (id: keyof Entrada, rotulo: string, props: Record<string, unknown> = {}, ajuda?: string) => (
    <div className="mb-3">
      <label htmlFor={`cad-${id}`} className="form-label">
        {rotulo}
      </label>
      <input
        id={`cad-${id}`}
        className={`form-control ${errors[id] ? 'is-invalid' : ''}`}
        {...props}
        {...ariaErro(`cad-${id}`, errors[id], ajuda ? `cad-${id}-ajuda` : undefined)}
        {...register(id)}
      />
      {ajuda && (
        <div className="form-text" id={`cad-${id}-ajuda`}>
          {ajuda}
        </div>
      )}
      <ErroCampo id={`cad-${id}`} mensagem={errors[id]?.message as string | undefined} />
    </div>
  );

  return (
    <LayoutPublico>
      <div className="container-xl px-3 py-5">
        <div className="card shadow-sm mx-auto k-pub-cartao" style={{ maxWidth: 720 }}>
          <div className="k-pub-cartao-topo" />
          <div className="card-body p-4 p-md-5">
            <div className="d-flex align-items-center gap-3 mb-3">
              <span className="k-home-icone mb-0" aria-hidden="true">
                <i className="bi bi-person-plus" />
              </span>
              <h1 className="h2 mb-0">Criar conta</h1>
            </div>

            <div className="alert alert-light border d-flex flex-wrap align-items-center gap-2 small" role="status">
              <span>
                Plano escolhido: <strong>{nomePlano(plano)}</strong>
                {valor !== null && ` · ${preco(valor)}/${ciclo === 'MENSAL' ? 'mês' : 'ano'}`}
              </span>
              <span className="ms-auto d-flex gap-1" role="group" aria-label="Trocar o plano">
                {PLANOS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`btn btn-sm ${p.id === plano ? 'btn-primary' : 'btn-outline-primary'}`}
                    aria-pressed={p.id === plano}
                    onClick={() => setParams({ plano: p.id, ciclo }, { replace: true })}
                  >
                    {p.nome}
                  </button>
                ))}
              </span>
            </div>
            <p className="small text-secondary">
              {plano === 'FREE'
                ? 'A conta começa no plano Free, sem cobrança. Você pode fazer o upgrade quando quiser.'
                : `A conta é criada no plano Free e, em seguida, você vai para o pagamento do ${nomePlano(plano)} (Pix, boleto ou cartão). O plano é liberado assim que o pagamento for confirmado.`}{' '}
              <Link to="/planos">Comparar os planos</Link>
            </p>

            {criada ? (
              <div className="alert alert-success" role="status">
                <h2 className="h5">Conta criada</h2>
                <p className="mb-2">Enviamos um link para confirmar o seu e-mail. Entre para continuar.</p>
                <Link to="/login" state={{ de: destino }} className="btn btn-success">
                  Entrar
                </Link>
              </div>
            ) : (
              <form onSubmit={enviar} noValidate>
                <ErroAlerta erro={erro} />
                {campo('nome', 'Nome completo', { autoComplete: 'name' })}
                {campo('email', 'E-mail', { type: 'email', autoComplete: 'email' }, 'Será usado para entrar.')}
                <div className="row">
                  <div className="col-md-6">
                    {campo('senha', 'Senha', { type: 'password', autoComplete: 'new-password' }, REGRA_SENHA)}
                  </div>
                  <div className="col-md-6">
                    {campo('confirmar', 'Confirme a senha', { type: 'password', autoComplete: 'new-password' })}
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6">
                    {campo('instituicao', 'Instituição (opcional)', { autoComplete: 'organization' })}
                  </div>
                  <div className="col-md-6">
                    {campo('orcid', 'ORCID (opcional)', { placeholder: '0000-0000-0000-000X', inputMode: 'numeric' })}
                  </div>
                </div>
                <div className="form-check mb-4">
                  <input
                    id="cad-consentimentoLgpd"
                    type="checkbox"
                    className={`form-check-input ${errors.consentimentoLgpd ? 'is-invalid' : ''}`}
                    {...ariaErro('cad-consentimentoLgpd', errors.consentimentoLgpd)}
                    {...register('consentimentoLgpd')}
                  />
                  <label htmlFor="cad-consentimentoLgpd" className="form-check-label">
                    Concordo com o tratamento dos meus dados pessoais conforme a LGPD, para uso do Konektron Research.
                  </label>
                  <ErroCampo id="cad-consentimentoLgpd" mensagem={errors.consentimentoLgpd?.message} />
                </div>
                <button type="submit" className="btn btn-primary btn-lg w-100" disabled={isSubmitting}>
                  {isSubmitting && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
                  {plano === 'FREE' ? 'Criar conta grátis' : 'Criar conta e ir para o pagamento'}
                </button>
              </form>
            )}

            <hr className="my-4" />
            <div className="d-flex flex-wrap justify-content-between gap-2 small">
              <Link to="/">
                <i className="bi bi-arrow-left me-1" aria-hidden="true" />
                Voltar ao início
              </Link>
              <span>
                Já tem conta?{' '}
                <Link to="/login" state={{ de: destino }}>
                  Entrar
                </Link>
              </span>
            </div>
          </div>
        </div>
      </div>
    </LayoutPublico>
  );
}
