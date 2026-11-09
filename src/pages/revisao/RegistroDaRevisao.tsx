import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patch } from '../../lib/api';
import { chaves } from '../../lib/consultas';
import type { Revisao } from '../../lib/tipos';
import { ErroAlerta } from '../../components/ui';
import { useProjetoAtual } from '../projeto/ProjetoLayout';

const ehUrl = (v: string) => /^https?:\/\/\S+\.\S+/i.test(v.trim());

/**
 * Fim da página da revisão: link para onde a revisão de literatura foi registrada
 * (PROSPERO, OSF, INPLASY…). O responsável cadastra a URL e o identificador do registro.
 */
export function RegistroDaRevisao({ revisao }: { revisao: Revisao }) {
  const { dono } = useProjetoAtual();
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [url, setUrl] = useState(revisao.registroUrl ?? '');
  const [ident, setIdent] = useState(revisao.registroIdentificador ?? '');
  const salvar = useMutation({
    mutationFn: () =>
      patch(`/revisoes/${revisao.id}`, {
        registroUrl: url.trim() || null,
        registroIdentificador: ident.trim() || null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: chaves.revisao(revisao.id) });
      setEditando(false);
    },
  });
  if (!revisao.registroUrl && !dono) return null;

  return (
    <section className="card mt-4" aria-labelledby="titulo-registro">
      <div className="card-body d-flex flex-wrap align-items-center gap-2">
        <div className="me-auto">
          <h3 id="titulo-registro" className="h6 mb-0">
            <i className="bi bi-patch-check me-1" aria-hidden="true" />
            Registro da revisão
          </h3>
          {!editando && (
            <div className="small text-secondary">
              {revisao.registroUrl
                ? revisao.registroIdentificador || revisao.registroUrl
                : 'Informe onde a revisão foi registrada (PROSPERO, OSF, INPLASY…).'}
            </div>
          )}
        </div>
        {!editando && revisao.registroUrl && (
          <a className="btn btn-primary btn-sm" href={revisao.registroUrl} target="_blank" rel="noreferrer noopener">
            <i className="bi bi-box-arrow-up-right me-1" aria-hidden="true" />
            Abrir registro
            <span className="visually-hidden"> (abre em nova aba)</span>
          </a>
        )}
        {!editando && dono && (
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setEditando(true)}>
            <i className="bi bi-pencil me-1" aria-hidden="true" />
            {revisao.registroUrl ? 'Editar' : 'Informar registro'}
          </button>
        )}
      </div>
      {editando && (
        <form
          className="card-body border-top pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!url.trim() || ehUrl(url)) salvar.mutate();
          }}
        >
          <div className="row g-2">
            <div className="col-md-7">
              <label htmlFor="registro-url" className="form-label small">
                URL do registro
              </label>
              <input
                id="registro-url"
                type="url"
                className={`form-control form-control-sm ${url.trim() && !ehUrl(url) ? 'is-invalid' : ''}`}
                placeholder="https://www.crd.york.ac.uk/prospero/display_record.php?RecordID=…"
                maxLength={1000}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <div className="invalid-feedback">Informe um endereço começando com http:// ou https://</div>
            </div>
            <div className="col-md-5">
              <label htmlFor="registro-id" className="form-label small">
                Identificador (opcional)
              </label>
              <input
                id="registro-id"
                className="form-control form-control-sm"
                placeholder="ex.: CRD42026000000 ou osf.io/abcd1"
                maxLength={120}
                value={ident}
                onChange={(e) => setIdent(e.target.value)}
              />
            </div>
          </div>
          <ErroAlerta erro={salvar.error} className="mt-2 mb-0" />
          <div className="d-flex gap-2 mt-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={salvar.isPending}>
              Salvar
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setEditando(false);
                setUrl(revisao.registroUrl ?? '');
                setIdent(revisao.registroIdentificador ?? '');
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
