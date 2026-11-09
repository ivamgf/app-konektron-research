import { useQuery } from '@tanstack/react-query';
import { get } from '../../lib/api';
import { rotulo } from '../../lib/formato';
import { Carregando, ErroAlerta } from '../../components/ui';
import type { Revisao } from '../../lib/tipos';
import { DadosDaRevisao } from './DadosDaRevisao';
import { DiagramaFluxo } from './DiagramaFluxo';

type LinhaEtapa = {
  revisaoEtapaId: string;
  etapaOrdem: number;
  etapaNome: string;
  base: string;
  selecionados: number | string;
  excluidos: number | string;
  excluidosDuplicados: number | string;
  excluidosSemAcesso: number | string;
  excluidosCriterio: number | string;
  conflitos: number | string;
  semDecisao: number | string;
};
type LinhaBase = {
  base: string;
  artigosConsultados: number | string;
  importados: number | string;
  duplicados: number | string;
};
export type PainelDados = {
  porEtapa: LinhaEtapa[];
  porBase: LinhaBase[];
  excluidosPorEtapa: { etapaId: string; ordem: number; nome: string; motivo: string | null; n: number }[];
  totais: {
    consultados: number;
    importados: number;
    duplicados: number;
    excluidos: number;
    selecionadosUltimaTriagem: number;
    revisaoAnterior: number;
    integrados: number;
    incluidos: number;
  };
};

const n = (v: unknown) => Number(v ?? 0);

/** Tabela base × fase (como a aba Etapas da planilha): uma coluna por etapa de triagem */
export function tabelaBaseFase(linhas: LinhaEtapa[]) {
  const etapas = [
    ...new Map(
      linhas.map((l) => [l.revisaoEtapaId, { id: l.revisaoEtapaId, ordem: l.etapaOrdem, nome: l.etapaNome }]),
    ).values(),
  ].sort((a, b) => a.ordem - b.ordem);
  const bases = [...new Set(linhas.map((l) => l.base))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const celula = (base: string, etapaId: string) => linhas.find((l) => l.base === base && l.revisaoEtapaId === etapaId);
  return { etapas, bases, celula };
}

/** RF32/RN13 + RF33 (fluxograma exportável em SVG/PNG) */
export function Painel({ revisao }: { revisao: Revisao }) {
  const revisaoId = revisao.id;
  const q = useQuery({
    queryKey: ['revisao', revisaoId, 'painel'],
    queryFn: () => get<PainelDados>(`/revisoes/${revisaoId}/painel`),
  });
  if (q.isLoading) return <Carregando />;
  if (q.error || !q.data) return <ErroAlerta erro={q.error ?? 'Painel indisponível'} />;
  const { totais, porBase, porEtapa, excluidosPorEtapa } = q.data;
  const t = tabelaBaseFase(porEtapa);
  const cartoes = [
    ['Consultados', totais.consultados, 'bi-search'],
    ['Importados', totais.importados, 'bi-download'],
    ['Duplicados', totais.duplicados, 'bi-files'],
    ['Excluídos na triagem', totais.excluidos, 'bi-x-circle'],
    ['Incluídos', totais.incluidos, 'bi-check-circle'],
  ] as const;

  return (
    <div style={{ fontFamily: "'Inter', var(--bs-body-font-family)" }}>
      <DadosDaRevisao revisao={revisao} />
      <div className="row g-3 mb-4">
        {cartoes.map(([texto, valor, icone]) => (
          <div className="col-6 col-md" key={texto}>
            <div className="card h-100">
              <div className="card-body py-2">
                <div className="small text-secondary">
                  <i className={`bi ${icone} me-1`} aria-hidden="true" />
                  {texto}
                </div>
                <div className="fs-4 fw-bold">{valor}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="small text-secondary">
        Incluídos = selecionados na última triagem ({totais.selecionadosUltimaTriagem}) + revisão anterior (
        {totais.revisaoAnterior}) + integrados ({totais.integrados}) — RN13.
      </p>

      <div className="row g-4">
        <div className="col-12">
          <h3 className="h6">Consultados por base</h3>
          <table className="table table-sm small">
            <thead>
              <tr>
                <th>Base</th>
                <th className="text-end">Consultados</th>
                <th className="text-end">Importados</th>
                <th className="text-end">Duplicados</th>
              </tr>
            </thead>
            <tbody>
              {porBase.map((b) => (
                <tr key={b.base}>
                  <td>{b.base}</td>
                  <td className="text-end">{n(b.artigosConsultados)}</td>
                  <td className="text-end">{n(b.importados)}</td>
                  <td className="text-end">{n(b.duplicados)}</td>
                </tr>
              ))}
              <tr className="fw-bold">
                <td>Total</td>
                <td className="text-end">{totais.consultados}</td>
                <td className="text-end">{totais.importados}</td>
                <td className="text-end">{porBase.reduce((s, b) => s + n(b.duplicados), 0)}</td>
              </tr>
            </tbody>
          </table>

          {t.etapas.length > 0 && (
            <>
              <h3 className="h6 mt-4">Triagem por base e fase (selecionados / excluídos)</h3>
              <div className="table-responsive">
                <table className="table table-sm small">
                  <thead>
                    <tr>
                      <th>Base</th>
                      {t.etapas.map((e) => (
                        <th key={e.id} className="text-center">
                          {e.nome}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.bases.map((b) => (
                      <tr key={b}>
                        <td>{b}</td>
                        {t.etapas.map((e) => {
                          const c = t.celula(b, e.id);
                          return (
                            <td key={e.id} className="text-center">
                              {c ? (
                                <>
                                  <span className="text-success">{n(c.selecionados)}</span> /{' '}
                                  <span className="text-danger">{n(c.excluidos)}</span>
                                  {n(c.semDecisao) > 0 && (
                                    <span className="text-warning-emphasis"> · {n(c.semDecisao)} pend.</span>
                                  )}
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {excluidosPorEtapa.length > 0 && (
            <>
              <h3 className="h6 mt-4">Excluídos por motivo</h3>
              <table className="table table-sm small">
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th>Motivo</th>
                    <th className="text-end">Qtd.</th>
                  </tr>
                </thead>
                <tbody>
                  {excluidosPorEtapa.map((x, i) => (
                    <tr key={i}>
                      <td>{x.nome}</td>
                      <td>{rotulo(x.motivo)}</td>
                      <td className="text-end">{x.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        <div className="col-12">
          <DiagramaFluxo revisaoId={revisaoId} compacto />
        </div>
      </div>
    </div>
  );
}
