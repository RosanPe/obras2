import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type { Estrutura, MaoObra, Material, Regra } from '../../../dominio/tipos';
import { OPERACOES } from '../../../dominio/constantes';
import { estruturaFormularioSchema, maoObraFormularioSchema, materialFormularioSchema, regraFormularioSchema } from '../../../dominio/catalogos-schema';
import { salvarEstrutura, salvarMaoObra, salvarMaterial, salvarRegra } from '../../../infraestrutura/supabase/repositorios/catalogos';
import { useCatalogosStore } from '../../store/useCatalogosStore';
import { Button } from '../ui/button';
import { BuscaCatalogo } from './BuscaCatalogo';
export function mensagemErro(erro: unknown) {
  if (erro && typeof erro === 'object' && 'code' in erro) {
    if (erro.code === '23505') return 'Já existe um cadastro com este código ou item repetido.';
    if (erro.code === '23503') return 'Este registro está vinculado a uma estrutura ou regra. Revise os vínculos primeiro.';
    if (erro.code === 'PGRST202') return 'Aplique a migração catalogos_crud.sql no Supabase para salvar estruturas e regras.';
    if (erro.code === 'PGRST205') return 'As tabelas de catálogo ainda não foram criadas. Aplique schema.sql e a migração de cadastros no Supabase.';
  }
  return erro && typeof erro === 'object' && 'message' in erro ? String(erro.message) : 'Não foi possível concluir a operação.';
}
function Acoes({ ocupado, cancelar }: { ocupado: boolean; cancelar: () => void }) { return <div className="dialog-actions"><Button type="submit" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar cadastro'}</Button><Button type="button" variant="outline" disabled={ocupado} onClick={cancelar}>Cancelar</Button></div>; }
function Erros({ erros }: { erros: unknown }) {
  const coletar = (obj: unknown): string[] => {
    if (!obj || typeof obj !== 'object') return [];
    if ('message' in obj && typeof obj.message === 'string') return [obj.message];
    return Object.entries(obj).filter(([k]) => k !== 'ref').flatMap(([,v]) => coletar(v));
  };
  const mensagens = [...new Set(coletar(erros))];
  return mensagens.length ? <div role="alert" className="error-banner">{mensagens.join(' ')}</div> : null;
}
export function MaterialEditor({ registro, concluir, cancelar }: { registro?: Material; concluir: () => Promise<void>; cancelar: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof materialFormularioSchema>>({ resolver: zodResolver(materialFormularioSchema), defaultValues: registro ?? { codigo: '', descricao: '', categoria: 'geral' } });
  return <form onSubmit={handleSubmit(async dados => { try { await salvarMaterial(dados, registro?.id); await concluir(); } catch (erro) { toast.error(mensagemErro(erro)); } })}><div className="editor-fields"><label>Código<input {...register('codigo')} /></label><label>Descrição<input {...register('descricao')} /></label><label>Categoria<select {...register('categoria')}><option value="geral">Geral</option><option value="poste">Poste</option><option value="cabo">Cabo</option></select></label><Erros erros={errors} /></div><Acoes ocupado={isSubmitting} cancelar={cancelar} /></form>;
}
export function MaoObraEditor({ registro, concluir, cancelar }: { registro?: MaoObra; concluir: () => Promise<void>; cancelar: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof maoObraFormularioSchema>>({ resolver: zodResolver(maoObraFormularioSchema), defaultValues: registro ?? { codigo: '', descricao: '' } });
  return <form onSubmit={handleSubmit(async dados => { try { await salvarMaoObra(dados, registro?.id); await concluir(); } catch (erro) { toast.error(mensagemErro(erro)); } })}><div className="editor-fields"><label>Código<input {...register('codigo')} /></label><label>Descrição<input {...register('descricao')} /></label><Erros erros={errors} /></div><Acoes ocupado={isSubmitting} cancelar={cancelar} /></form>;
}
export function EstruturaEditor({ registro, concluir, cancelar }: { registro?: Estrutura; concluir: () => Promise<void>; cancelar: () => void }) {
  const materiais = useCatalogosStore(s => s.catalogos.materiais);
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<z.infer<typeof estruturaFormularioSchema>>({ resolver: zodResolver(estruturaFormularioSchema), defaultValues: registro ?? { nome: '', itens: [] } });
  const { fields, append, remove } = useFieldArray({ control, name: 'itens' });
  return <form onSubmit={handleSubmit(async dados => { try { await salvarEstrutura(dados, registro?.id); await concluir(); } catch (erro) { toast.error(mensagemErro(erro)); } })}><div className="editor-fields"><label>Nome da estrutura<input {...register('nome')} /></label><BuscaCatalogo rotulo="Adicionar material" itens={materiais.filter(m => !fields.some(i => i.material_id === m.id))} selecionar={id => { if (id) append({ material_id: id, quantidade: 1 }); }} /><div className="composition-list">{fields.map((item, indice) => <div className="composition-row" key={item.id}><span>{materiais.find(m => m.id === item.material_id)?.descricao ?? 'Material indisponível'}</span><label>Quantidade<input aria-label={`Quantidade do material ${indice + 1}`} type="number" step="any" min="0.0001" {...register(`itens.${indice}.quantidade`, { valueAsNumber: true })} /></label><Button variant="ghost" size="sm" type="button" onClick={() => remove(indice)}>Remover</Button></div>)}</div><Erros erros={errors} /></div><Acoes ocupado={isSubmitting} cancelar={cancelar} /></form>;
}
export function RegraEditor({ registro, concluir, cancelar }: { registro?: Regra; concluir: () => Promise<void>; cancelar: () => void }) {
  const catalogos = useCatalogosStore(s => s.catalogos);
  const { register, setValue, watch, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<z.infer<typeof regraFormularioSchema>>({ resolver: zodResolver(regraFormularioSchema), defaultValues: registro ? { ...registro, material_ids: [...new Set([registro.material_id, ...registro.material_ids ?? []].filter((id): id is string => !!id))], estrutura_ids: [...new Set([registro.estrutura_id, ...registro.estrutura_ids ?? []].filter((id): id is string => !!id))] } : { nome: '', tipo_gatilho: 'material', material_id: null, estrutura_id: null, material_ids: [], estrutura_ids: [], categorias: [], operacoes: ['I'], saidas: [] } });
  const { fields, append, remove } = useFieldArray({ control, name: 'saidas' });
  const gatilho = watch('tipo_gatilho');
  const materiaisAlvo = watch('material_ids') ?? [];
  const estruturasAlvo = watch('estrutura_ids') ?? [];
  const definirMateriais = (ids: string[]) => { setValue('material_ids', ids, { shouldDirty: true }); setValue('material_id', ids[0] ?? null); };
  const definirEstruturas = (ids: string[]) => { setValue('estrutura_ids', ids, { shouldDirty: true }); setValue('estrutura_id', ids[0] ?? null); };
  return <form onSubmit={handleSubmit(async dados => { try { await salvarRegra(dados, registro?.id); await concluir(); } catch (erro) { toast.error(mensagemErro(erro)); } })}><div className="editor-fields"><label>Nome da regra<input {...register('nome')} /></label><label>Gatilho<select {...register('tipo_gatilho', { onChange: () => { setValue('material_id', null); setValue('estrutura_id', null); setValue('material_ids', []); setValue('estrutura_ids', []); setValue('categorias', []); } })}><option value="material">Material</option><option value="estrutura">Estrutura</option><option value="contexto">Contexto / categorias</option></select></label>
    {gatilho === 'material' && <><BuscaCatalogo rotulo="Adicionar material gatilho" itens={catalogos.materiais.filter(m => !materiaisAlvo.includes(m.id))} selecionar={id => { if (id) definirMateriais([...materiaisAlvo, id]); }} /><ul className="point-picked-list" aria-label="Materiais gatilho">{materiaisAlvo.map(id => { const material = catalogos.materiais.find(m => m.id === id); return <li key={id}><span>{material ? `${material.codigo} · ${material.descricao}` : 'Material indisponível'}</span><Button type="button" size="sm" variant="ghost" onClick={() => definirMateriais(materiaisAlvo.filter(i => i !== id))}>Remover</Button></li>; })}</ul></>}
    {gatilho === 'estrutura' && <><BuscaCatalogo rotulo="Adicionar estrutura gatilho" itens={catalogos.estruturas.filter(e => !estruturasAlvo.includes(e.id))} selecionar={id => { if (id) definirEstruturas([...estruturasAlvo, id]); }} /><ul className="point-picked-list" aria-label="Estruturas gatilho">{estruturasAlvo.map(id => <li key={id}><span>{catalogos.estruturas.find(e => e.id === id)?.nome ?? 'Estrutura indisponível'}</span><Button type="button" size="sm" variant="ghost" onClick={() => definirEstruturas(estruturasAlvo.filter(i => i !== id))}>Remover</Button></li>)}</ul></>}
    {gatilho !== 'contexto' && <p className="point-field-help">Qualquer um dos itens selecionados dispara esta regra uma única vez por ponto.</p>}
    {gatilho === 'contexto' && <fieldset><legend>Categorias (qualquer uma)</legend><div className="checkbox-row">{(['poste', 'cabo', 'geral'] as const).map(c => <label key={c}><input type="checkbox" value={c} {...register('categorias')} />{c}</label>)}</div></fieldset>}
    <fieldset><legend>Operações</legend><div className="checkbox-row">{Object.entries(OPERACOES).map(([k,v]) => <label key={k}><input type="checkbox" value={k} {...register('operacoes')} />{v}</label>)}</div></fieldset>
    <BuscaCatalogo rotulo="Adicionar saída de mão de obra" itens={catalogos.maoObra.filter(m => !fields.some(s => s.mao_obra_id === m.id))} selecionar={id => { if (id) append({ mao_obra_id: id, quantidade: 1 }); }} />
    <div className="composition-list">{fields.map((saida, indice) => <div className="composition-row" key={saida.id}><span>{catalogos.maoObra.find(m => m.id === saida.mao_obra_id)?.descricao ?? 'Mão de obra indisponível'}</span><label>Quantidade<input aria-label={`Quantidade da saída ${indice + 1}`} type="number" step="any" min="0.0001" {...register(`saidas.${indice}.quantidade`, { valueAsNumber: true })} /></label><Button variant="ghost" size="sm" type="button" onClick={() => remove(indice)}>Remover</Button></div>)}</div><Erros erros={errors} /></div><Acoes ocupado={isSubmitting} cancelar={cancelar} /></form>;
}
