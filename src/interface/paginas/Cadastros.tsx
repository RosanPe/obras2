import { useEffect, useMemo, useRef, useState } from 'react';
import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { Database, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabaseConfigurado } from '../../infraestrutura/supabase/cliente';
import { excluirRegistro, type TipoCatalogo } from '../../infraestrutura/supabase/repositorios/catalogos';
import { useCatalogosStore } from '../store/useCatalogosStore';
import { Button } from '../componentes/ui/button';
import { EstruturaEditor, MaoObraEditor, MaterialEditor, mensagemErro, RegraEditor } from '../componentes/cadastros/Editores';
const nomes = { materiais: 'Materiais', maoObra: 'Mão de obra', estruturas: 'Estruturas', regras: 'Regras' };
interface Linha { id: string; codigo: string; descricao: string; detalhe: string }
const colunas: ColumnDef<Linha>[] = [{ accessorKey: 'codigo', header: 'Código' }, { accessorKey: 'descricao', header: 'Descrição / nome' }, { accessorKey: 'detalhe', header: 'Categoria / composição' }];
export function Cadastros() {
  const { catalogos, carregar, carregando, erro, podeEditar } = useCatalogosStore();
  const [aba, setAba] = useState<TipoCatalogo>('materiais');
  const [busca, setBusca] = useState(''); const [categoria, setCategoria] = useState('todas');
  const [editor, setEditor] = useState<{ tipo: TipoCatalogo; id?: string } | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const painel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editor) return;
    const anterior = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    painel.current?.querySelector('input')?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditor(null);
      if (e.key === 'Tab') {
        const controles = [...(painel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea') ?? [])];
        const primeiro = controles[0]; const ultimo = controles.at(-1);
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo?.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro?.focus(); }
      }
    };
    window.addEventListener('keydown', tecla);
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = overflow; anterior?.focus(); };
  }, [editor]);
  const linhas = useMemo<Linha[]>(() => {
    if (aba === 'materiais') return catalogos.materiais.filter(m => categoria === 'todas' || m.categoria === categoria).map(m => ({ id: m.id, codigo: m.codigo, descricao: m.descricao, detalhe: m.categoria }));
    if (aba === 'maoObra') return catalogos.maoObra.map(m => ({ id: m.id, codigo: m.codigo, descricao: m.descricao, detalhe: 'Mão de obra' }));
    if (aba === 'estruturas') return catalogos.estruturas.map(e => ({ id: e.id, codigo: '—', descricao: e.nome, detalhe: `${e.itens.length} materiais` }));
    return catalogos.regras.map(r => ({ id: r.id, codigo: r.operacoes.join(' / '), descricao: r.nome, detalhe: `${r.tipo_gatilho} · ${r.saidas.length} saídas` }));
  }, [aba, catalogos, categoria]);
  const tabela = useReactTable({ data: linhas, columns: colunas, state: { globalFilter: busca, sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel() });
  const concluir = async () => {
    setEditor(null); toast.success('Cadastro salvo.');
    try { await carregar(); } catch (erro) { toast.error(`Salvo, mas não foi possível atualizar a lista: ${mensagemErro(erro)}`); }
  };
  const remover = async (linha: Linha) => {
    if (!window.confirm(`Excluir “${linha.descricao}”? Os registros vinculados podem impedir a exclusão.`)) return;
    setExcluindo(linha.id);
    try { await excluirRegistro(aba, linha.id); toast.success('Cadastro excluído.'); await carregar(); }
    catch (erro) { toast.error(mensagemErro(erro)); } finally { setExcluindo(null); }
  };
  return <section className="panel p-6"><div className="section-heading"><div><h2>Catálogos da medição</h2><p className="muted">Materiais, mão de obra, estruturas e regras.</p></div><div className="flex gap-2"><Button variant="outline" disabled={!supabaseConfigurado || carregando} onClick={() => void carregar().catch(erro => toast.error(mensagemErro(erro)))}>{carregando ? 'Carregando…' : 'Atualizar'}</Button><Button disabled={!supabaseConfigurado || carregando || !podeEditar} onClick={() => setEditor({ tipo: aba })}><Plus size={16} />Novo cadastro</Button></div></div>
    {!supabaseConfigurado && <p className="notice">Configure a URL e a chave pública do Supabase em .env.local e entre na sua conta para editar os catálogos.</p>}
    {supabaseConfigurado && !carregando && !erro && !podeEditar && <p className="notice">Acesso de consulta. Os cadastros só podem ser alterados por usuários autorizados; você pode usar os itens normalmente na medição.</p>}
    {erro && <p className="error-banner" role="alert">Falha na conexão com os catálogos: {erro}</p>}
    <div className="subtabs">{(Object.keys(nomes) as TipoCatalogo[]).map(chave => <Button key={chave} variant={aba === chave ? 'default' : 'ghost'} onClick={() => { setAba(chave); setBusca(''); setCategoria('todas'); }}>{nomes[chave]} ({catalogos[chave].length})</Button>)}</div><div className="filters"><input aria-label="Buscar no catálogo" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por código ou descrição…" />{aba === 'materiais' && <select aria-label="Filtrar categoria" value={categoria} onChange={e => setCategoria(e.target.value)}><option value="todas">Todas as categorias</option><option value="cabo">Cabos</option><option value="poste">Postes</option><option value="geral">Geral</option></select>}</div>
    {!!linhas.length && <div className="table-scroll"><table><thead>{tabela.getHeaderGroups().map(g => <tr key={g.id}>{g.headers.map(h => <th key={h.id}><button onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())} {h.column.getIsSorted() === 'asc' ? '↑' : h.column.getIsSorted() === 'desc' ? '↓' : '↕'}</button></th>)}<th>Ações</th></tr>)}</thead><tbody>{tabela.getRowModel().rows.map(r => <tr key={r.id}>{r.getVisibleCells().map(c => <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}<td><div className="flex gap-1"><Button variant="ghost" size="sm" disabled={carregando || !podeEditar} onClick={() => setEditor({ tipo: aba, id: r.original.id })}>Editar</Button><Button variant="ghost" size="sm" disabled={!!excluindo || carregando || !podeEditar} onClick={() => void remover(r.original)}>{excluindo === r.original.id ? 'Excluindo…' : 'Excluir'}</Button></div></td></tr>)}</tbody></table></div>}
    {!tabela.getRowModel().rows.length && <div className="empty compact"><Database size={28} /><h2>{linhas.length ? 'Nenhum resultado para a busca.' : 'Seu catálogo está vazio.'}</h2><p>{supabaseConfigurado ? 'Crie os cadastros para usar nos pontos da medição.' : 'Conecte o Supabase para começar os cadastros.'}</p></div>}
    {editor && podeEditar && <div className="catalog-editor-backdrop"><div className="catalog-editor panel" role="dialog" aria-modal="true" aria-labelledby="titulo-editor" ref={painel}><div className="dialog-handle"><strong id="titulo-editor">{editor.id ? 'Editar' : 'Novo cadastro'} · {nomes[editor.tipo]}</strong><Button variant="ghost" size="icon" aria-label="Fechar editor" onClick={() => setEditor(null)}><X size={18} /></Button></div>
      {editor.tipo === 'materiais' && <MaterialEditor registro={catalogos.materiais.find(m => m.id === editor.id)} concluir={concluir} cancelar={() => setEditor(null)} />}
      {editor.tipo === 'maoObra' && <MaoObraEditor registro={catalogos.maoObra.find(m => m.id === editor.id)} concluir={concluir} cancelar={() => setEditor(null)} />}
      {editor.tipo === 'estruturas' && <EstruturaEditor registro={catalogos.estruturas.find(m => m.id === editor.id)} concluir={concluir} cancelar={() => setEditor(null)} />}
      {editor.tipo === 'regras' && <RegraEditor registro={catalogos.regras.find(m => m.id === editor.id)} concluir={concluir} cancelar={() => setEditor(null)} />}
    </div></div>}
  </section>;
}
