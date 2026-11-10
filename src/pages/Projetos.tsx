import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { get, post } from '../lib/api';
import { chaves } from '../lib/consultas';
import { data, rotulo } from '../lib/formato';
import type { Projeto } from '../lib/tipos';
import { Abas, Cabecalho, Carregando, ErroAlerta, Modal, Situacao, Vazio } from '../components/ui';
import { ariaErro, ErroCampo } from './auth/CartaoAuth';
import { TOTAL_PASSOS } from './projeto/protocoloPassos';
import { chavePlano, nomePlano, usePlano } from '../lib/planos';

// RF05: título, área, instituição, programa, datas
export const projetoSchema = z
  .object({
    titulo: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(300),
    subtitulo: z.string().trim().max(300).optional(),
    area: z.string().trim().max(150).optional(),
    instituicao: z.string().trim().max(200).optional(),
    programa: z.string().trim().max(200).optional(),
    dataInicio: z.string().optional(),
    dataFim: z.string().optional(),
  })
  .refine((d) => !d.dataInicio || !d.dataFim || d.dataFim >= d.dataInicio, {
    path: ['dataFim'],
    message: 'A data de fim deve ser igual ou posterior à de início',
  });
export type DadosProjeto = z.infer<typeof projetoSchema>;

/** Converte strings vazias em null para a API */
export const paraApi = (d: DadosProjeto) =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === '' ? null : v]));

export function FormProjeto({
  inicial,
  aoSalvar,
  textoBotao,
}: {
  inicial?: Partial<Projeto>;
  aoSalvar: (d: DadosProjeto) => Promise<void>;
  textoBotao: string;
}) {
  const [erro, setErro] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DadosProjeto>({
    resolver: zodResolver(projetoSchema),
    defaultValues: {
      titulo: inicial?.titulo ?? '',
      subtitulo: inicial?.subtitulo ?? '',
      area: inicial?.area ?? '',
      instituicao: inicial?.instituicao ?? '',
      programa: inicial?.programa ?? '',
      dataInicio: inicial?.dataInicio ?? '',
      dataFim: inicial?.dataFim ?? '',
    },
  });
  return (
    <form
      onSubmit={handleSubmit(async (d) => {
        setErro(null);
        try {
          await aoSalvar(d);
        } catch (e) {
          setErro(e);
        }
      })}
      noValidate
    >
      <ErroAlerta erro={erro} />
      <div className="mb-3">
        <label htmlFor="titulo" className="form-label">
          Título
        </label>
        <input
          id="titulo"
          className={`form-control ${errors.titulo ? 'is-invalid' : ''}`}
          {...ariaErro('titulo', errors.titulo)}
          {...register('titulo')}
        />
        <ErroCampo id="titulo" mensagem={errors.titulo?.message} />
      </div>
      <div className="mb-3">
        <label htmlFor="subtitulo" className="form-label">
          Subtítulo <span className="text-secondary small">(opcional; usado no artigo)</span>
        </label>
        <input id="subtitulo" className="form-control" {...register('subtitulo')} />
      </div>
      <div className="row g-3">
        <div className="col-md-6">
          <label htmlFor="area" className="form-label">
            Área
          </label>
          <input id="area" className="form-control" {...register('area')} />
        </div>
        <div className="col-md-6">
          <label htmlFor="instituicao" className="form-label">
            Instituição
          </label>
          <input id="instituicao" className="form-control" {...register('instituicao')} />
        </div>
        <div className="col-12">
          <label htmlFor="programa" className="form-label">
            Programa
          </label>
          <input id="programa" className="form-control" {...register('programa')} />
        </div>
        <div className="col-md-6">
          <label htmlFor="dataInicio" className="form-label">
            Início
          </label>
          <input id="dataInicio" type="date" className="form-control" {...register('dataInicio')} />
        </div>
        <div className="col-md-6">
          <label htmlFor="dataFim" className="form-label">
            Fim
          </label>
          <input
            id="dataFim"
            type="date"
            className={`form-control ${errors.dataFim ? 'is-invalid' : ''}`}
            {...ariaErro('dataFim', errors.dataFim)}
            {...register('dataFim')}
          />
          <ErroCampo id="dataFim" mensagem={errors.dataFim?.message} />
        </div>
      </div>
      <div className="text-end mt-4">
        <button className="btn btn-primary" disabled={isSubmitting}>
          {textoBotao}
        </button>
      </div>
    </form>
  );
}

const PASSOS = TOTAL_PASSOS;
const FILTROS = [
  { id: 'ATIVO', texto: 'Ativos' },
  { id: 'ARQUIVADO', texto: 'Arquivados' },
  { id: 'LIXEIRA', texto: 'Lixeira' },
] as const;

/** Painel de projetos (ERS 8.4): cards com status, progresso do protocolo e revisões */
export function Projetos() {
  const [filtro, setFiltro] = useState<'ATIVO' | 'ARQUIVADO' | 'LIXEIRA'>('ATIVO');
  const [novo, setNovo] = useState(false);
  const navegar = useNavigate();
  const qc = useQueryClient();
  const params = filtro === 'LIXEIRA' ? { lixeira: true } : { status: filtro };
  // plano FREE: até 3 projetos; no limite o botão fica desabilitado e aparece o convite ao upgrade
  const plano = usePlano();
  const limiteAtingido = !!plano.data && !plano.data.podeCriarProjeto;
  const lista = useQuery({
    queryKey: [...chaves.projetos, filtro],
    queryFn: () => get<Projeto[]>('/projetos', params),
  });
  const restaurar = useMutation({
    mutationFn: (id: string) => post(`/projetos/${id}/restaurar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.projetos }),
  });

  return (
    <>
      <Cabecalho titulo="Projetos de pesquisa" subtitulo="Projetos em que você é membro">
        <button
          className="btn btn-primary"
          onClick={() => setNovo(true)}
          disabled={plano.data ? !plano.data.podeCriarProjeto : false}
          aria-describedby={limiteAtingido ? 'aviso-limite' : undefined}
        >
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          Novo projeto
        </button>
      </Cabecalho>
      {plano.data && plano.data.limiteProjetos !== null && (
        <div
          id="aviso-limite"
          className={`alert ${limiteAtingido ? 'alert-warning' : 'alert-light border'} d-flex flex-wrap align-items-center gap-2 py-2`}
          role={limiteAtingido ? 'alert' : 'status'}
        >
          <i className={`bi ${limiteAtingido ? 'bi-exclamation-triangle' : 'bi-info-circle'}`} aria-hidden="true" />
          <span className="me-auto small">
            {limiteAtingido ? (
              <>
                Você usou os {plano.data.limiteProjetos} projetos do plano {nomePlano(plano.data.plano)}. Faça o upgrade
                para continuar criando projetos.
                {plano.data.expiraEm && (
                  <>
                    {' '}
                    Seus projetos ficam disponíveis até <strong>{data(plano.data.expiraEm)}</strong>; depois disso são
                    removidos e a conta fica bloqueada até o upgrade.
                  </>
                )}
              </>
            ) : (
              <>
                Plano {nomePlano(plano.data.plano)}: {plano.data.projetosUsados} de {plano.data.limiteProjetos} projetos
                usados.
              </>
            )}
          </span>
          <Link to="/planos" className={`btn btn-sm ${limiteAtingido ? 'btn-warning' : 'btn-outline-primary'}`}>
            <i className="bi bi-stars me-1" aria-hidden="true" />
            Fazer upgrade
          </Link>
        </div>
      )}

      <Abas
        abas={FILTROS}
        atual={filtro}
        aoMudar={setFiltro}
        rotulo="Situação dos projetos"
        className="nav nav-pills mb-3"
      >
        {lista.isLoading && <Carregando />}
        <ErroAlerta erro={lista.error ?? restaurar.error} />
        {lista.data?.length === 0 && (
          <Vazio icone="bi-folder2">
            {filtro === 'LIXEIRA'
              ? 'A lixeira está vazia. Projetos excluídos ficam aqui por 30 dias.'
              : 'Nenhum projeto aqui ainda.'}
          </Vazio>
        )}

        <div className="row g-3">
          {lista.data?.map((p) => {
            const passo = p.protocoloStatus === 'RASCUNHO' ? (p.protocoloPasso ?? 1) - 1 : PASSOS;
            return (
              <div className="col-md-6 col-xl-4" key={p.id}>
                <div className="card h-100">
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex justify-content-between gap-2 mb-2">
                      <span className="badge text-bg-light border">{rotulo(p.papel)}</span>
                      <Situacao valor={p.protocoloStatus} texto={`Protocolo: ${rotulo(p.protocoloStatus)}`} />
                    </div>
                    <h2 className="h5">
                      {filtro === 'LIXEIRA' ? (
                        p.titulo
                      ) : (
                        <Link to={`/projetos/${p.id}`} className="stretched-link text-reset text-decoration-none">
                          {p.titulo}
                        </Link>
                      )}
                    </h2>
                    <div className="small text-secondary mb-3">
                      {[p.area, p.instituicao].filter(Boolean).join(' · ') || 'Sem área definida'}
                    </div>
                    <div className="mt-auto">
                      <div className="d-flex justify-content-between small mb-1">
                        <span>Protocolo</span>
                        <span>
                          {Math.max(0, passo)}/{PASSOS} passos
                        </span>
                      </div>
                      <div className="progress mb-2" style={{ height: 6 }} aria-hidden="true">
                        <div className="progress-bar" style={{ width: `${(Math.max(0, passo) / PASSOS) * 100}%` }} />
                      </div>
                      <div className="d-flex justify-content-between small text-secondary">
                        <span>
                          <i className="bi bi-journal-text me-1" aria-hidden="true" />
                          {p.revisoes ?? 0} revisão(ões)
                        </span>
                        <span>Atualizado em {data(p.atualizadoEm)}</span>
                      </div>
                      {filtro === 'LIXEIRA' && (
                        <button
                          className="btn btn-outline-primary btn-sm mt-3"
                          disabled={restaurar.isPending}
                          onClick={() => restaurar.mutate(p.id)}
                        >
                          <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true" />
                          Restaurar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Abas>

      <Modal titulo="Novo projeto" aberto={novo} aoFechar={() => setNovo(false)} tamanho="lg">
        <FormProjeto
          textoBotao="Criar projeto"
          aoSalvar={async (d) => {
            const p = await post<Projeto>('/projetos', paraApi(d));
            await Promise.all([
              qc.invalidateQueries({ queryKey: chaves.projetos }),
              qc.invalidateQueries({ queryKey: chavePlano }),
            ]);
            setNovo(false);
            navegar(`/projetos/${p.id}/protocolo`);
          }}
        />
      </Modal>
    </>
  );
}
