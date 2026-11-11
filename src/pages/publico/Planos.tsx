import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { lerErro, post } from '../../lib/api';
import {
  abrirFatura,
  chaveAssinatura,
  cpfCnpjValido,
  formatarCpfCnpj,
  STATUS_ASSINATURA,
  STATUS_PAGAMENTO,
  useAssinatura,
  type Ciclo,
  type DadosAssinatura,
} from '../../lib/assinatura';
import { EMAIL_ORKNEYTECH, linkPedidoPlano } from '../../lib/contato';
import { data } from '../../lib/formato';
import { chavePlano, nomePlano, PLANOS, preco, tamanho, usePlano } from '../../lib/planos';
import { CartoesPlanos, SeletorCiclo } from '../../components/CartoesPlanos';
import { BotaoConfirmar, ErroAlerta, Modal } from '../../components/ui';
import { LayoutPublico } from './LayoutPublico';

type PlanoPago = 'STANDARD' | 'MASTER';

/** Planos Free, Standard e Master; assinatura pelo Asaas para quem está logado */
export default function Planos() {
  const { usuario } = useAuth();
  const atual = usePlano(!!usuario);
  const assin = useAssinatura(!!usuario);
  // ?assinar=MASTER&ciclo=ANUAL: vindo do cadastro ou do login, já abre a assinatura do plano escolhido
  const [params] = useSearchParams();
  const pedido = params.get('assinar');
  const [ciclo, setCiclo] = useState<Ciclo>(params.get('ciclo') === 'ANUAL' ? 'ANUAL' : 'MENSAL');
  const [assinando, setAssinando] = useState<PlanoPago | null>(null);
  const pedidoAberto = useRef(false);
  useEffect(() => {
    if (pedidoAberto.current || !usuario || (pedido !== 'STANDARD' && pedido !== 'MASTER')) return;
    pedidoAberto.current = true;
    setAssinando(pedido);
  }, [usuario, pedido]);
  const precos = assin.data?.precos;
  const valorDe = (id: string, base: number | null) =>
    base === null ? null : (precos?.[id as PlanoPago]?.[ciclo] ?? base);

  return (
    <LayoutPublico>
      <div className="container-xl px-3 py-5">
        <div className="text-center mb-4">
          <h1 className="k-home-secao mb-2">Planos</h1>
          <p className="k-home-sub mb-3">Escolha o plano que acompanha o tamanho da sua pesquisa.</p>
          <SeletorCiclo ciclo={ciclo} aoMudar={setCiclo} />
        </div>

        {atual.data && (
          <div className="alert alert-light border text-center small" role="status">
            Seu plano atual: <strong>{nomePlano(atual.data.plano)}</strong>
            {atual.data.limiteProjetos !== null &&
              ` · ${atual.data.projetosUsados} de ${atual.data.limiteProjetos} projetos usados`}
            {` · ${tamanho(atual.data.armazenamentoUsadoBytes ?? 0)} de ${tamanho((atual.data.limiteArmazenamentoMb ?? 0) * 1024 ** 2)} de arquivos`}
            {atual.data.expiraEm && ` · projetos disponíveis até ${data(atual.data.expiraEm)}`}
            {atual.data.bloqueado && ' · conta bloqueada até o upgrade'}
          </div>
        )}

        {assin.data && <MinhaAssinatura d={assin.data} />}

        <CartoesPlanos
          ciclo={ciclo}
          valorDe={valorDe}
          planoAtual={atual.data?.plano}
          acao={(p) =>
            atual.data?.plano === p.id ? (
              <button type="button" className="btn btn-outline-secondary w-100" disabled>
                Plano atual
              </button>
            ) : p.id === 'FREE' ? (
              !usuario && (
                <Link to="/registrar?plano=FREE" className="btn btn-outline-primary w-100">
                  Começar grátis
                </Link>
              )
            ) : usuario ? (
              <button
                type="button"
                className={`btn w-100 ${p.destaque ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setAssinando(p.id as PlanoPago)}
              >
                Assinar o {p.nome}
              </button>
            ) : (
              <>
                <Link
                  to={`/registrar?plano=${p.id}&ciclo=${ciclo}`}
                  className={`btn w-100 ${p.destaque ? 'btn-primary' : 'btn-outline-primary'}`}
                >
                  Criar conta e assinar
                </Link>
                <Link
                  to="/login"
                  state={{ de: `/planos?assinar=${p.id}&ciclo=${ciclo}` }}
                  className="d-block text-center small mt-2"
                >
                  Já tenho conta<span className="visually-hidden"> e quero assinar o {p.nome}</span>
                </Link>
              </>
            )
          }
        />
        <p className="small text-secondary text-center mb-1">
          <i className="bi bi-mortarboard me-1" aria-hidden="true" />
          Estudante? Há 20% de desconto no Standard: escreva para{' '}
          <a href={`mailto:${EMAIL_ORKNEYTECH}?subject=${encodeURIComponent('Desconto estudantil no Konektron')}`}>
            {EMAIL_ORKNEYTECH}
          </a>{' '}
          com o comprovante de matrícula.
        </p>
        <p className="small text-secondary text-center mb-0">
          Pagamento por Pix, boleto ou cartão, processado pelo Asaas. A integração com IA usa a sua própria conta ou
          chave do provedor. No plano Free, ao criar o 3º projeto começa um prazo de 3 meses; ao fim dele os projetos
          são removidos e a conta fica bloqueada até o upgrade. Os recursos e limites de cada projeto seguem o plano de
          quem o criou.
        </p>
      </div>

      <Modal
        titulo={assinando ? `Assinar o ${nomePlano(assinando)}` : ''}
        aberto={!!assinando}
        aoFechar={() => setAssinando(null)}
      >
        {assinando && (
          <FormAssinar
            plano={assinando}
            ciclo={ciclo}
            valor={valorDe(
              assinando,
              PLANOS.find((p) => p.id === assinando)![ciclo === 'MENSAL' ? 'mensal' : 'anual'],
            )!}
            dados={assin.data}
            email={usuario?.email}
          />
        )}
      </Modal>
    </LayoutPublico>
  );
}

/** CPF/CNPJ (exigido pelo Asaas) e confirmação; leva à fatura do Asaas para pagar */
function FormAssinar({
  plano,
  ciclo,
  valor,
  dados,
  email,
}: {
  plano: PlanoPago;
  ciclo: Ciclo;
  valor: number;
  dados: DadosAssinatura | undefined;
  email?: string;
}) {
  const qc = useQueryClient();
  const [doc, setDoc] = useState(() => formatarCpfCnpj(dados?.cpfCnpj ?? ''));
  const [erro, setErro] = useState<string | null>(null);
  const assinar = useMutation({
    mutationFn: () =>
      post<{ linkFatura: string | null }>('/planos/assinar', { plano, ciclo, cpfCnpj: doc.replace(/\D/g, '') }),
    onSuccess: async (r) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: chaveAssinatura }),
        qc.invalidateQueries({ queryKey: chavePlano }),
      ]);
      if (r.linkFatura) abrirFatura(r.linkFatura);
    },
  });
  const desligada = dados && !dados.cobrancaAtiva;
  const codigo = assinar.error ? lerErro(assinar.error).codigo : undefined;

  if (desligada || codigo === 'ASAAS_DESLIGADO')
    return (
      <div>
        <p>A assinatura on-line ainda não está disponível. Peça a assinatura por e-mail que a equipe ativa o plano.</p>
        <a
          className="btn btn-primary"
          href={linkPedidoPlano(nomePlano(plano), ciclo === 'MENSAL' ? 'mensal' : 'anual', email)}
        >
          Pedir por e-mail
        </a>
      </div>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!cpfCnpjValido(doc)) return setErro('Informe um CPF ou CNPJ válido.');
        setErro(null);
        assinar.mutate();
      }}
    >
      <p>
        Plano <strong>{nomePlano(plano)}</strong>, {ciclo === 'MENSAL' ? 'mensal' : 'anual'}:{' '}
        <strong>
          {preco(valor)}/{ciclo === 'MENSAL' ? 'mês' : 'ano'}
        </strong>
        . A primeira cobrança vence hoje; o plano é liberado assim que o pagamento for confirmado.
      </p>
      {dados?.assinatura && dados.assinatura.status !== 'CANCELADA' && (
        <div className="alert alert-info small py-2">
          Você já tem uma assinatura. A troca de plano ou de ciclo vale a partir da próxima cobrança.
        </div>
      )}
      {dados?.sandbox && (
        <div className="alert alert-warning small py-2">
          Ambiente de testes (sandbox) do Asaas: nenhuma cobrança é real.
        </div>
      )}
      <label htmlFor="assinar-doc" className="form-label">
        CPF ou CNPJ para a cobrança
      </label>
      <input
        id="assinar-doc"
        className="form-control"
        inputMode="numeric"
        autoComplete="off"
        value={doc}
        onChange={(e) => setDoc(formatarCpfCnpj(e.target.value))}
        aria-describedby="assinar-doc-ajuda"
      />
      <div id="assinar-doc-ajuda" className="form-text">
        Exigido pelo Asaas para emitir a cobrança. Usado só para o pagamento.
      </div>
      {(erro || assinar.error) && <ErroAlerta erro={erro ?? assinar.error} className="mt-3" />}
      <div className="d-flex justify-content-end mt-3">
        <button type="submit" className="btn btn-primary" disabled={assinar.isPending}>
          {assinar.isPending && <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />}
          Ir para o pagamento
        </button>
      </div>
    </form>
  );
}

/** Assinatura atual: situação, faturas (pagar ou ver) e cancelamento da renovação */
function MinhaAssinatura({ d }: { d: DadosAssinatura }) {
  const qc = useQueryClient();
  const a = d.assinatura;
  if (!a) return null;
  const aberta = a.status !== 'CANCELADA';
  const emAberto = d.pagamentos.find((p) => ['PENDING', 'OVERDUE'].includes(p.status) && p.linkFatura);
  return (
    <section className="card shadow-sm mb-4" aria-labelledby="minha-assinatura">
      <div className="card-body">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <h2 className="h5 mb-0 me-auto" id="minha-assinatura">
            Sua assinatura: {nomePlano(a.plano)} {a.ciclo === 'MENSAL' ? 'mensal' : 'anual'} · {preco(a.valor)}
          </h2>
          <span
            className={`badge ${a.status === 'ATIVA' ? 'text-bg-success' : a.status === 'ATRASADA' ? 'text-bg-danger' : 'text-bg-secondary'}`}
          >
            {STATUS_ASSINATURA[a.status]}
          </span>
        </div>
        <p className="small text-secondary mb-2">
          {a.pagoAte && `Pago até ${data(a.pagoAte)}. `}
          {a.status === 'CANCELADA' && a.pagoAte && 'Sem renovação: o plano continua até essa data.'}
          {a.status === 'ATRASADA' && 'Pague a fatura em aberto para não voltar ao plano Free.'}
        </p>
        <div className="d-flex flex-wrap gap-2 mb-3">
          {emAberto && (
            <a className="btn btn-primary btn-sm" href={emAberto.linkFatura!}>
              <i className="bi bi-qr-code me-1" aria-hidden="true" />
              Pagar fatura de {preco(emAberto.valor)}
            </a>
          )}
          {aberta && (
            <BotaoConfirmar
              pergunta="Cancelar a renovação da assinatura? O plano continua até o fim do período já pago e depois a conta volta ao Free."
              aoConfirmar={async () => {
                await post('/planos/cancelar');
                await Promise.all([
                  qc.invalidateQueries({ queryKey: chaveAssinatura }),
                  qc.invalidateQueries({ queryKey: chavePlano }),
                ]);
              }}
            >
              Cancelar assinatura
            </BotaoConfirmar>
          )}
        </div>
        {d.pagamentos.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm small mb-0">
              <caption className="visually-hidden">Faturas da assinatura</caption>
              <thead>
                <tr>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Situação</th>
                  <th>Fatura</th>
                </tr>
              </thead>
              <tbody>
                {d.pagamentos.map((p) => (
                  <tr key={p.id}>
                    <td>{data(p.vencimento)}</td>
                    <td>{preco(p.valor)}</td>
                    <td>{STATUS_PAGAMENTO[p.status] ?? p.status}</td>
                    <td>
                      {p.linkFatura ? (
                        <a href={p.linkFatura} target="_blank" rel="noopener noreferrer">
                          Abrir<span className="visually-hidden"> fatura (abre em nova aba)</span>
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
