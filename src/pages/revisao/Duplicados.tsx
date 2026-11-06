import { useMutation, useQueryClient } from '@tanstack/react-query';
import { post } from '../../lib/api';
import type { EtapaRevisao, Revisao } from '../../lib/tipos';
import { ErroAlerta } from '../../components/ui';
import { useProjetoAtual } from '../projeto/ProjetoLayout';
import { chaveEtapas } from './Revisao';
import { Triagem } from './Triagem';

/** RF28/RN11: detecta duplicados (DOI ou título normalizado ≥ 0,95 e mesmo ano) e permite confirmar ou desfazer */
export function Duplicados({ revisao, etapa }: { revisao: Revisao; etapa: EtapaRevisao }) {
  const { edita } = useProjetoAtual();
  const qc = useQueryClient();
  const detectar = useMutation({
    mutationFn: () => post<{ analisados: number; duplicados: number }>(`/revisoes/${revisao.id}/duplicados/detectar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['etapa', etapa.id] });
      qc.invalidateQueries({ queryKey: chaveEtapas(revisao.id) });
    },
  });
  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        {edita && etapa.status === 'EM_ANDAMENTO' && (
          <button className="btn btn-primary" disabled={detectar.isPending} onClick={() => detectar.mutate()}>
            <i className="bi bi-search me-1" aria-hidden="true" />
            {detectar.isPending ? 'Procurando…' : 'Detectar duplicados'}
          </button>
        )}
        {detectar.data && (
          <span className="small" role="status">
            {detectar.data.analisados} documento(s) analisado(s), {detectar.data.duplicados} duplicado(s) marcado(s). O
            primeiro registro importado é mantido.
          </span>
        )}
      </div>
      <ErroAlerta erro={detectar.error} />
      {(etapa.exigeTriagem || etapa.permiteExclusao) && <Triagem revisao={revisao} etapa={etapa} />}
    </>
  );
}
