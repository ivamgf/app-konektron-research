import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, del, get } from '../../lib/api';
import { dataHora } from '../../lib/formato';
import { BotaoConfirmar, ErroAlerta } from '../../components/ui';

type TcleAnexado = {
  url: string;
  arquivo: { id: string; nomeOriginal: string; mimeType?: string; criadoEm?: string };
} | null;

const chaveTcle = (projetoId: string) => ['projeto', projetoId, 'tcle'] as const;

function salvarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * TCLE (Termo de Consentimento Livre e Esclarecido), opcional: baixa o modelo já preenchido com os
 * dados do protocolo (.doc, abre editável no Word/LibreOffice), o pesquisador completa e envia o
 * arquivo final (PDF, DOC, DOCX ou ODT).
 */
export function Tcle({ projetoId, somenteLeitura }: { projetoId: string; somenteLeitura: boolean }) {
  const qc = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const anexado = useQuery({
    queryKey: chaveTcle(projetoId),
    queryFn: () => get<TcleAnexado>(`/projetos/${projetoId}/protocolo/tcle`),
  });

  const modelo = useMutation({
    mutationFn: async () => {
      const r = await api.get<Blob>(`/projetos/${projetoId}/protocolo/tcle/modelo`, { responseType: 'blob' });
      salvarBlob(r.data, 'TCLE-modelo.doc');
    },
  });
  const enviar = useMutation({
    mutationFn: async (arquivo: File) => {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      return (await api.post<TcleAnexado>(`/projetos/${projetoId}/protocolo/tcle`, fd, { timeout: 120_000 })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveTcle(projetoId) }),
  });
  const remover = () =>
    del(`/projetos/${projetoId}/protocolo/tcle`).then(() => qc.invalidateQueries({ queryKey: chaveTcle(projetoId) }));

  const tcle = anexado.data;
  return (
    <section className="border rounded p-3 mt-4" aria-labelledby="titulo-tcle">
      <h3 id="titulo-tcle" className="h6 mb-1">
        TCLE — Termo de Consentimento Livre e Esclarecido <span className="badge text-bg-light border">opcional</span>
      </h3>
      <p className="small text-secondary mb-2">
        Necessário só em pesquisas com participantes humanos. Baixe o modelo — ele já vem com o título, a equipe, a
        instituição, o objetivo, a metodologia, os riscos e os benefícios deste protocolo —, complete os trechos
        destacados entre colchetes e envie o termo preenchido.
      </p>
      <div className="d-flex flex-wrap gap-2 align-items-center">
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={modelo.isPending}
          onClick={() => modelo.mutate()}
        >
          <i className="bi bi-file-earmark-word me-1" aria-hidden="true" />
          Baixar modelo de TCLE
        </button>
        {!somenteLeitura && (
          <>
            <input
              ref={entrada}
              type="file"
              className="d-none"
              accept=".pdf,.doc,.docx,.odt"
              aria-label="Arquivo do TCLE preenchido"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) enviar.mutate(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={enviar.isPending}
              onClick={() => entrada.current?.click()}
            >
              {enviar.isPending ? (
                <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
              ) : (
                <i className="bi bi-upload me-1" aria-hidden="true" />
              )}
              {tcle ? 'Substituir TCLE preenchido' : 'Enviar TCLE preenchido'}
            </button>
          </>
        )}
      </div>
      {tcle && (
        <div className="d-flex flex-wrap align-items-center gap-2 mt-3 small">
          <i className="bi bi-file-earmark-check text-success" aria-hidden="true" />
          <span>
            <strong>{tcle.arquivo.nomeOriginal}</strong>
            {tcle.arquivo.criadoEm && (
              <span className="text-secondary"> · enviado em {dataHora(tcle.arquivo.criadoEm)}</span>
            )}
          </span>
          <a className="btn btn-link btn-sm" href={tcle.url} target="_blank" rel="noreferrer">
            Abrir
          </a>
          {!somenteLeitura && (
            <BotaoConfirmar titulo="Remover TCLE" pergunta="Remover o TCLE anexado ao protocolo?" aoConfirmar={remover}>
              <i className="bi bi-trash" aria-hidden="true" />
            </BotaoConfirmar>
          )}
        </div>
      )}
      <ErroAlerta erro={anexado.error ?? modelo.error ?? enviar.error} className="mt-2 mb-0" />
    </section>
  );
}
