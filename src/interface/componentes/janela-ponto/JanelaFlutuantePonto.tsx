import { useEffect, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { useFieldArray, useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GripHorizontal, Minus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { PontoMedicao } from '../../../dominio/tipos';
import { pontoFormularioSchema, pontoValidadoSchema, type FormularioPonto } from '../../../dominio/ponto-schema';
import { OPERACOES } from '../../../dominio/constantes';
import { useCatalogosStore } from '../../store/useCatalogosStore';
import { useMedicaoStore } from '../../store/useMedicaoStore';
import { BuscaCatalogo } from '../cadastros/BuscaCatalogo';
import { Button } from '../ui/button';
let posicao = { x: 0, y: 0 };
export function JanelaFlutuantePonto({ ponto, fechar }: { ponto: PontoMedicao; fechar: () => void }) {
  const { catalogos } = useCatalogosStore();
  const { salvarPonto, excluirPonto, pontos } = useMedicaoStore();
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  const [minimizada, setMinimizada] = useState(false);
  const painel = useRef<HTMLDivElement>(null);
  const { register, handleSubmit, control, watch, setValue, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<FormularioPonto>({
    resolver: zodResolver(pontoFormularioSchema), defaultValues: {
      numero: ponto.numero, operacao: ponto.operacao,
      estruturas: [...new Set([ponto.estrutura_id, ...ponto.estruturas_secundarias].filter((id): id is string => !!id))],
      poste_id: ponto.poste_id, cabos_ids: ponto.cabos_ids,
      metragem_linear: ponto.metragem_linear,
      mao_obra_adicional: ponto.mao_obra_adicional,
    },
  });
  const { fields: servicos, append: adicionarServico, remove: removerServico } = useFieldArray({ control, name: 'mao_obra_adicional' });
  const estruturas = watch('estruturas');
  const cabosSelecionados = watch('cabos_ids');
  const postes = useMemo(() => catalogos.materiais.filter(m => m.categoria === 'poste'), [catalogos.materiais]);
  const cabos = useMemo(() => catalogos.materiais.filter(m => m.categoria === 'cabo'), [catalogos.materiais]);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const listener = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) fechar(); };
    const resize = () => setMobile(window.innerWidth < 768);
    document.addEventListener('keydown', listener); window.addEventListener('resize', resize);
    painel.current?.querySelector('input')?.focus();
    return () => { document.removeEventListener('keydown', listener); window.removeEventListener('resize', resize); anterior?.focus(); };
  }, [fechar]);
  const salvar = async (dados: FormularioPonto, status: PontoMedicao['status']) => {
    clearErrors();
    if (pontos.some(p => p.id !== ponto.id && p.numero.toLocaleLowerCase() === dados.numero.toLocaleLowerCase())) { setError('numero', { message: 'Já existe um ponto com este número.' }, { shouldFocus: true }); return; }
    if (status === 'validado') {
      const validacao = pontoValidadoSchema.safeParse(dados);
      if (!validacao.success) {
        for (const erro of validacao.error.issues) setError(erro.path.join('.') as FieldPath<FormularioPonto>, { message: erro.message });
        toast.error(validacao.error.issues[0].message); return;
      }
      if (dados.estruturas.some(id => !catalogos.estruturas.some(e => e.id === id)) || (dados.poste_id && !postes.some(m => m.id === dados.poste_id)) || dados.cabos_ids.some(id => !cabos.some(m => m.id === id)) || dados.mao_obra_adicional.some(s => !catalogos.maoObra.some(m => m.id === s.mao_obra_id))) {
        toast.error('Há itens indisponíveis no catálogo atual. Remova ou substitua antes de validar.'); return;
      }
    }
    const atual = useMedicaoStore.getState().pontos.find(p => p.id === ponto.id) ?? ponto;
    const { estruturas: selecionadas, ...campos } = dados;
    try {
      await salvarPonto({ ...atual, ...campos, estrutura_id: selecionadas[0] ?? null, estruturas_secundarias: selecionadas.slice(1), status });
      toast.success(status === 'validado' ? 'Ponto validado.' : 'Rascunho salvo.'); fechar();
    } catch { toast.error('Falha ao salvar no navegador.'); }
  };
  const conteudo = <div ref={painel} className="point-dialog" role="dialog" aria-modal="false" aria-labelledby="titulo-ponto"><div className="dialog-handle"><GripHorizontal size={18} /><strong id="titulo-ponto">Ponto {ponto.numero}</strong><span className={`badge ${ponto.status}`}>{ponto.status}</span><Button variant="ghost" size="icon" aria-label={minimizada ? 'Expandir janela' : 'Minimizar janela'} onClick={() => setMinimizada(!minimizada)}><Minus size={16} /></Button><Button variant="ghost" size="icon" aria-label="Fechar janela" onClick={fechar}><X size={18} /></Button></div>
    {!minimizada && <form className="point-form" onSubmit={handleSubmit(dados => salvar(dados, 'validado'))}><div className="point-fields"><div className="form-grid"><label>Número do ponto<input {...register('numero')} aria-invalid={!!errors.numero} /></label><label>Operação<select {...register('operacao')}>{Object.entries(OPERACOES).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}</select></label></div>{errors.numero && <small className="error" role="alert">{errors.numero.message}</small>}{errors.root?.validacao && <p className="error" role="alert">{errors.root.validacao.message}</p>}
      <section className="point-section" aria-label="Estruturas do ponto"><BuscaCatalogo rotulo="Adicionar estrutura" placeholder="Digite N, N4 ou parte do nome…" itens={catalogos.estruturas.filter(e => !estruturas.includes(e.id))} selecionar={id => { if (id && !estruturas.includes(id)) setValue('estruturas', [...estruturas, id], { shouldDirty: true }); }} />
        {!!estruturas.length && <ul className="point-picked-list" aria-label="Estruturas adicionadas">{estruturas.map(id => <li key={id}><span>{catalogos.estruturas.find(e => e.id === id)?.nome ?? 'Estrutura indisponível'}</span><Button type="button" variant="ghost" size="icon" aria-label={`Remover estrutura ${catalogos.estruturas.find(e => e.id === id)?.nome ?? id}`} onClick={() => setValue('estruturas', estruturas.filter(e => e !== id), { shouldDirty: true })}><X size={14} /></Button></li>)}</ul>}
      </section>
      <BuscaCatalogo rotulo="Poste" placeholder="Ex.: 11200 ou poste concre DT…" itens={postes} valor={watch('poste_id') ?? undefined} selecionar={id => setValue('poste_id', id || null, { shouldDirty: true })} />
      <section className="point-section" aria-label="Cabos do ponto"><BuscaCatalogo rotulo="Adicionar cabo" placeholder="Digite código ou descrição do cabo…" itens={cabos.filter(c => !cabosSelecionados.includes(c.id))} selecionar={id => { if (id && !cabosSelecionados.includes(id)) setValue('cabos_ids', [...cabosSelecionados, id], { shouldDirty: true }); }} />
        {!!cabosSelecionados.length && <ul className="point-picked-list" aria-label="Cabos adicionados">{cabosSelecionados.map(id => { const cabo = cabos.find(c => c.id === id); return <li key={id}><span>{cabo ? `${cabo.codigo} · ${cabo.descricao}` : 'Cabo indisponível'}</span><Button type="button" size="icon" variant="ghost" aria-label={`Remover cabo ${cabo?.codigo ?? id}`} onClick={() => setValue('cabos_ids', cabosSelecionados.filter(c => c !== id), { shouldDirty: true })}><X size={14} /></Button></li>; })}</ul>}
      </section>
      <section className="point-linear-length"><label htmlFor="ponto-metragem-linear">Metragem linear (m)</label><div className="linear-length-input"><input id="ponto-metragem-linear" type="number" inputMode="decimal" step="any" min="0" {...register('metragem_linear', { valueAsNumber: true })} aria-invalid={!!errors.metragem_linear} aria-describedby="ponto-metragem-ajuda" /><span>m</span></div><p id="ponto-metragem-ajuda" className="point-field-help">Informe uma vez. A mesma metragem será aplicada a cada cabo adicionado.</p>{errors.metragem_linear && <small className="error" role="alert">{errors.metragem_linear.message}</small>}</section>
      <section className="point-section"><BuscaCatalogo rotulo="Adicionar mão de obra" placeholder="Digite código ou descrição do serviço…" itens={catalogos.maoObra.filter(m => !servicos.some(s => s.mao_obra_id === m.id))} selecionar={id => { if (id) adicionarServico({ mao_obra_id: id, quantidade: 1 }); }} /><p className="point-field-help">Serviços adicionais serão somados à mão de obra gerada pelas regras.</p>
        {!!servicos.length && <ul className="point-picked-list" aria-label="Mão de obra adicional">{servicos.map((servico, indice) => { const registro = catalogos.maoObra.find(m => m.id === servico.mao_obra_id); return <li key={servico.id} className="point-service"><span>{registro ? `${registro.codigo} · ${registro.descricao}` : 'Mão de obra indisponível'}</span><label>Quantidade<input type="number" step="any" min="0.0001" inputMode="decimal" {...register(`mao_obra_adicional.${indice}.quantidade`, { valueAsNumber: true })} aria-label={`Quantidade de ${registro?.descricao ?? 'mão de obra'}`} /></label><Button type="button" variant="ghost" size="icon" aria-label={`Remover mão de obra ${registro?.codigo ?? indice + 1}`} onClick={() => removerServico(indice)}><X size={14} /></Button>{errors.mao_obra_adicional?.[indice]?.quantidade && <small className="error" role="alert">{errors.mao_obra_adicional[indice]?.quantidade?.message}</small>}</li>; })}</ul>}
      </section>
      {!catalogos.materiais.length && !catalogos.maoObra.length && <p className="notice">Os catálogos estão vazios. Você pode marcar pontos e salvar rascunhos; carregue os catálogos para selecionar os itens da medição.</p>}
    </div><div className="dialog-actions"><Button disabled={isSubmitting} type="submit">Salvar e validar</Button><Button disabled={isSubmitting} variant="outline" type="button" onClick={() => void handleSubmit(dados => salvar(dados, 'pendente'))()}>Salvar rascunho</Button><Button disabled={isSubmitting} type="button" variant="ghost" onClick={() => { if (window.confirm(`Excluir o ponto ${ponto.numero}?`)) void excluirPonto(ponto.id).then(fechar).catch(() => toast.error('Falha ao excluir.')); }}>Excluir</Button><Button type="button" variant="ghost" onClick={fechar}>Cancelar</Button></div></form>}
  </div>;
  if (mobile) return <div className="bottom-sheet" style={minimizada ? { height: 60 } : undefined}>{conteudo}</div>;
  const width = Math.min(500, window.innerWidth - 32); const height = Math.min(780, window.innerHeight - 40);
  return <div className="floating-bounds"><Rnd bounds="parent" default={{ x: posicao.x || Math.max(16, window.innerWidth - width - 32), y: posicao.y || 20, width, height }} minWidth={360} minHeight={minimizada ? 56 : 320} maxWidth="100%" maxHeight="100%" size={minimizada ? { width, height: 56 } : undefined} dragHandleClassName="dialog-handle" cancel="button,input,select,textarea" onDragStop={(_e, data) => { posicao = { x: data.x, y: data.y }; }} className="floating-point">{conteudo}</Rnd></div>;
}
