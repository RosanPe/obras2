import { useEffect, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { GripHorizontal, Minus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ComposicaoOperacao, Operacao, PontoMedicao } from '../../../dominio/tipos';
import { pontoComposicaoSchema, pontoComposicaoValidadoSchema } from '../../../dominio/composicao-schema';
import { atualizarFontes, composicaoVazia, obterOperacoesPonto } from '../../../aplicacao/composicao-ponto';
import { useCatalogosStore } from '../../store/useCatalogosStore';
import { useMedicaoStore } from '../../store/useMedicaoStore';
import { BuscaCatalogo } from '../cadastros/BuscaCatalogo';
import { Button } from '../ui/button';
let posicao = { x: 0, y: 0 };
const NOMES = { I: 'Instalado', D: 'Desativado', R: 'Reinstalado' } as const;
function Quantidade({ valor, rotulo, alterar, metros = false }: { valor: number; rotulo: string; alterar: (n: number) => void; metros?: boolean }) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);
  return <label className="point-quantity">{metros ? 'Metros' : 'Quantidade'}<input type="number" inputMode="decimal" step="any" min="0.00000001" required value={texto} aria-label={rotulo} onChange={e => { setTexto(e.target.value); const n = e.target.valueAsNumber; if (Number.isFinite(n) && n > 0) alterar(n); }} onBlur={() => { if (!(Number(texto) > 0)) setTexto(String(valor)); }} /></label>;
}
export function JanelaFlutuantePonto({ ponto, fechar }: { ponto: PontoMedicao; fechar: () => void }) {
  const { catalogos, carregando } = useCatalogosStore();
  const { salvarPonto, excluirPonto, pontos } = useMedicaoStore();
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  const [minimizada, setMinimizada] = useState(false);
  const [numero, setNumero] = useState(ponto.numero);
  const [aba, setAba] = useState<Operacao>('I');
  const [operacoes, setOperacoes] = useState(() => structuredClone(obterOperacoesPonto({ ...ponto, status: 'pendente' }, catalogos)));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const painel = useRef<HTMLDivElement>(null);
  const atual = operacoes[aba] ?? composicaoVazia();
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const listener = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) fechar(); };
    const resize = () => setMobile(window.innerWidth < 768);
    document.addEventListener('keydown', listener); window.addEventListener('resize', resize);
    painel.current?.querySelector('input')?.focus();
    return () => { document.removeEventListener('keydown', listener); window.removeEventListener('resize', resize); anterior?.focus(); };
  }, [fechar]);
  const editar = (proxima: ComposicaoOperacao) => setOperacoes(o => ({ ...o, [aba]: proxima }));
  const fontes = (alteracoes: Partial<Pick<ComposicaoOperacao, 'estruturas' | 'postes' | 'cabos'>>) => {
    try { editar(atualizarFontes(catalogos, aba, atual, { estruturas: atual.estruturas, postes: atual.postes, cabos: atual.cabos, ...alteracoes })); setErro(''); }
    catch (e) { editar({ ...atual, ...alteracoes }); setErro(e instanceof Error ? e.message : 'Não foi possível preencher os itens.'); }
  };
  const salvar = async (status: PontoMedicao['status']) => {
    const validacao = (status === 'validado' ? pontoComposicaoValidadoSchema : pontoComposicaoSchema).safeParse({ numero, operacoes });
    if (!validacao.success) { setErro(validacao.error.issues[0].message); return; }
    if (pontos.some(p => p.id !== ponto.id && p.numero.toLocaleLowerCase() === validacao.data.numero.toLocaleLowerCase())) { setErro('Já existe um ponto com este número.'); return; }
    if (status === 'validado') {
      for (const o of Object.values(operacoes)) {
        if (!o) continue;
        if (o.materiais.some(i => !catalogos.materiais.some(m => m.id === i.material_id)) || o.mao_obra.some(i => !catalogos.maoObra.some(m => m.id === i.mao_obra_id))) { setErro('Substitua os materiais ou serviços indisponíveis antes de validar.'); return; }
      }
    }
    setSalvando(true); setErro('');
    try {
      const salvo = useMedicaoStore.getState().pontos.find(p => p.id === ponto.id) ?? ponto;
      await salvarPonto({ ...salvo, numero: validacao.data.numero, operacoes: validacao.data.operacoes, status });
      toast.success(status === 'validado' ? 'Ponto validado em todas as operações preenchidas.' : 'Rascunho salvo.'); fechar();
    } catch { setErro('Não foi possível salvar o ponto no navegador.'); }
    finally { setSalvando(false); }
  };
  const materialNome = (id: string) => { const m = catalogos.materiais.find(m => m.id === id); return m ? `${m.codigo} · ${m.descricao}` : 'Material indisponível'; };
  const materialCodigo = (id: string) => catalogos.materiais.find(m => m.id === id)?.codigo ?? id;
  const conteudo = <div ref={painel} className="point-dialog" role="dialog" aria-modal="false" aria-labelledby="titulo-ponto"><div className="dialog-handle"><GripHorizontal size={18} /><strong id="titulo-ponto">Ponto {ponto.numero}</strong><span className={`badge ${ponto.status}`}>{ponto.status}</span><Button variant="ghost" size="icon" aria-label={minimizada ? 'Expandir janela' : 'Minimizar janela'} onClick={() => setMinimizada(!minimizada)}><Minus size={16} /></Button><Button variant="ghost" size="icon" aria-label="Fechar janela" onClick={fechar}><X size={18} /></Button></div>
    {!minimizada && <form className="point-form" onSubmit={e => { e.preventDefault(); void salvar('validado'); }}><div className="point-fields"><label>Número do ponto<input value={numero} onChange={e => setNumero(e.target.value)} required aria-label="Número do ponto" /></label>
      <div className="point-operation-tabs" role="tablist" aria-label="Operações do ponto">{(['I', 'D', 'R'] as const).map(op => <button type="button" key={op} role="tab" id={`aba-ponto-${op}`} aria-controls={`painel-ponto-${op}`} aria-selected={aba === op} tabIndex={aba === op ? 0 : -1} onClick={() => { setAba(op); setErro(''); }} onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const ops: Operacao[] = ['I','D','R']; const proxima = ops[(ops.indexOf(op) + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; setAba(proxima); document.getElementById(`aba-ponto-${proxima}`)?.focus(); } }}>{NOMES[op]}{(operacoes[op]?.materiais.length || operacoes[op]?.mao_obra.length) ? <span className="operation-filled" aria-label="Preenchida" /> : null}</button>)}</div>
      {erro && <p className="error" role="alert">{erro}</p>}
      <div role="tabpanel" id={`painel-ponto-${aba}`} aria-labelledby={`aba-ponto-${aba}`} className="point-operation-content" key={aba}>
      {aba === 'R' && <p className="notice">Nesta aba, as seleções preenchem somente a mão de obra. Inclua materiais abaixo apenas se precisar; eles aparecerão separadamente no resumo.</p>}
      <section className="point-section"><BuscaCatalogo rotulo="Adicionar estrutura" placeholder="Digite N1, N4 ou parte do nome…" itens={catalogos.estruturas.filter(e => !atual.estruturas.some(i => i.estrutura_id === e.id))} selecionar={id => { if (id) fontes({ estruturas: [...atual.estruturas, { estrutura_id: id, quantidade: 1 }] }); }} /><ul className="point-picked-list" aria-label="Estruturas adicionadas">{atual.estruturas.map(i => { const nome = catalogos.estruturas.find(e => e.id === i.estrutura_id)?.nome ?? 'Estrutura indisponível'; return <li key={i.estrutura_id} className="point-service"><span>{nome}</span><Quantidade valor={i.quantidade} rotulo={`Quantidade da estrutura ${nome}`} alterar={quantidade => fontes({ estruturas: atual.estruturas.map(e => e.estrutura_id === i.estrutura_id ? { ...e, quantidade } : e) })} /><Button type="button" variant="ghost" size="icon" aria-label={`Remover estrutura ${nome}`} onClick={() => fontes({ estruturas: atual.estruturas.filter(e => e.estrutura_id !== i.estrutura_id) })}><X size={14} /></Button></li>; })}</ul></section>
      {(['postes', 'cabos'] as const).map(tipo => <section className="point-section" key={tipo}><BuscaCatalogo rotulo={tipo === 'postes' ? 'Adicionar poste' : 'Adicionar cabo'} placeholder="Digite código ou descrição…" itens={catalogos.materiais.filter(m => m.categoria === (tipo === 'postes' ? 'poste' : 'cabo') && !atual[tipo].some(i => i.material_id === m.id))} selecionar={id => { if (id) fontes({ [tipo]: [...atual[tipo], { material_id: id, quantidade: 1 }] }); }} /><ul className="point-picked-list" aria-label={tipo === 'postes' ? 'Postes adicionados' : 'Cabos adicionados'}>{atual[tipo].map(i => <li key={i.material_id} className="point-service"><span>{materialNome(i.material_id)}</span><Quantidade valor={i.quantidade} metros={tipo === 'cabos'} rotulo={`${tipo === 'cabos' ? 'Metragem do cabo' : 'Quantidade do poste'} ${materialCodigo(i.material_id)}`} alterar={quantidade => fontes({ [tipo]: atual[tipo].map(e => e.material_id === i.material_id ? { ...e, quantidade } : e) })} /><Button type="button" variant="ghost" size="icon" aria-label={`Remover ${tipo === 'cabos' ? 'cabo' : 'poste'} ${materialCodigo(i.material_id)}`} onClick={() => fontes({ [tipo]: atual[tipo].filter(e => e.material_id !== i.material_id) })}><X size={14} /></Button></li>)}</ul></section>)}
      <p className="point-field-help">As seleções acima preenchem as listas abaixo. Confira e ajuste o que será medido nesta operação.</p>
      <section className="point-section point-final-items" aria-label="Materiais finais"><h3>Materiais</h3><BuscaCatalogo rotulo="Adicionar material" itens={catalogos.materiais.filter(m => !atual.materiais.some(i => i.material_id === m.id))} selecionar={id => { if (id) editar({ ...atual, materiais: [...atual.materiais, { material_id: id, quantidade: 1 }] }); }} /><ul className="point-picked-list" aria-label="Materiais da medição">{atual.materiais.map(i => <li key={i.material_id} className="point-service"><span>{materialNome(i.material_id)}</span><Quantidade valor={i.quantidade} metros={catalogos.materiais.find(m => m.id === i.material_id)?.categoria === 'cabo'} rotulo={`Quantidade final do material ${materialCodigo(i.material_id)}`} alterar={quantidade => editar({ ...atual, materiais: atual.materiais.map(e => e.material_id === i.material_id ? { ...e, quantidade } : e) })} /><Button type="button" variant="ghost" size="icon" aria-label={`Excluir material final ${materialCodigo(i.material_id)}`} onClick={() => editar({ ...atual, materiais: atual.materiais.filter(e => e.material_id !== i.material_id) })}><X size={14} /></Button></li>)}</ul>{!atual.materiais.length && <p className="point-field-help">Nenhum material nesta operação.</p>}</section>
      <section className="point-section point-final-items" aria-label="Mão de obra final"><h3>Mão de obra</h3><BuscaCatalogo rotulo="Adicionar mão de obra" itens={catalogos.maoObra.filter(m => !atual.mao_obra.some(i => i.mao_obra_id === m.id))} selecionar={id => { if (id) editar({ ...atual, mao_obra: [...atual.mao_obra, { mao_obra_id: id, quantidade: 1 }] }); }} /><ul className="point-picked-list" aria-label="Mão de obra da medição">{atual.mao_obra.map(i => { const registro = catalogos.maoObra.find(m => m.id === i.mao_obra_id); return <li key={i.mao_obra_id} className="point-service"><span>{registro ? `${registro.codigo} · ${registro.descricao}` : 'Serviço indisponível'}</span><Quantidade valor={i.quantidade} rotulo={`Quantidade final da mão de obra ${registro?.codigo ?? i.mao_obra_id}`} alterar={quantidade => editar({ ...atual, mao_obra: atual.mao_obra.map(e => e.mao_obra_id === i.mao_obra_id ? { ...e, quantidade } : e) })} /><Button type="button" variant="ghost" size="icon" aria-label={`Excluir mão de obra final ${registro?.codigo ?? i.mao_obra_id}`} onClick={() => editar({ ...atual, mao_obra: atual.mao_obra.filter(e => e.mao_obra_id !== i.mao_obra_id) })}><X size={14} /></Button></li>; })}</ul>{!atual.mao_obra.length && <p className="point-field-help">Nenhum serviço nesta operação.</p>}</section>
      </div>
    </div><div className="dialog-actions"><Button disabled={salvando || carregando} type="submit">Salvar e validar</Button><Button disabled={salvando} variant="outline" type="button" onClick={() => void salvar('pendente')}>Salvar rascunho</Button><Button disabled={salvando} type="button" variant="ghost" onClick={() => { if (window.confirm(`Excluir o ponto ${ponto.numero} em todas as operações?`)) void excluirPonto(ponto.id).then(fechar).catch(() => toast.error('Falha ao excluir.')); }}>Excluir</Button><Button type="button" variant="ghost" onClick={fechar}>Cancelar</Button></div></form>}
  </div>;
  if (mobile) return <div className="bottom-sheet" style={minimizada ? { height: 60 } : undefined}>{conteudo}</div>;
  const width = Math.min(600, window.innerWidth - 32), height = Math.min(850, window.innerHeight - 40);
  return <div className="floating-bounds"><Rnd bounds="parent" default={{ x: posicao.x || Math.max(16, window.innerWidth - width - 32), y: posicao.y || 20, width, height }} minWidth={360} minHeight={minimizada ? 56 : 320} maxWidth="100%" maxHeight="100%" size={minimizada ? { width, height: 56 } : undefined} dragHandleClassName="dialog-handle" cancel="button,input,select,textarea" onDragStop={(_e, data) => { posicao = { x: data.x, y: data.y }; }} className="floating-point">{conteudo}</Rnd></div>;
}
