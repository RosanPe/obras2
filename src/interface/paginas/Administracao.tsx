import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { definirPermissao, listarHistorico, listarUsuarios, type RegistroAdministrativo, type UsuarioAdministrativo } from '../../infraestrutura/supabase/repositorios/permissoes';
import { useCatalogosStore } from '../store/useCatalogosStore';
import { Button } from '../componentes/ui/button';
const mensagem = (erro: unknown) => erro instanceof Error ? erro.message : String((erro as { message?: string })?.message ?? erro);
export function Administracao() {
  const { catalogos } = useCatalogosStore();
  const [aba, setAba] = useState('usuarios');
  const [usuarios, setUsuarios] = useState<UsuarioAdministrativo[]>([]);
  const [historico, setHistorico] = useState<RegistroAdministrativo[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let ativo = true;
    setCarregando(true); setErro('');
    Promise.all([listarUsuarios(), listarHistorico(pagina, aba === 'historico' ? busca : '')]).then(([u, h]) => {
      if (ativo) { setUsuarios(u); setHistorico(h.registros); setTotal(h.total); }
    }).catch(e => { if (ativo) setErro(mensagem(e)); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [pagina, aba, busca, revisao]);
  const alterar = async (usuario: UsuarioAdministrativo) => {
    setSalvando(usuario.user_id);
    try { await definirPermissao(usuario.user_id, !usuario.pode_editar); setRevisao(v => v + 1); toast.success(usuario.pode_editar ? 'Permissão revogada.' : 'Permissão concedida.'); }
    catch (e) { toast.error(mensagem(e)); } finally { setSalvando(null); }
  };
  const registros = [
    ...catalogos.materiais.map(v => ({ tipo: 'Material', id: v.id, codigo: v.codigo, descricao: v.descricao, dados: v })),
    ...catalogos.maoObra.map(v => ({ tipo: 'Mão de obra', id: v.id, codigo: v.codigo, descricao: v.descricao, dados: v })),
    ...catalogos.estruturas.map(v => ({ tipo: 'Estrutura', id: v.id, codigo: '', descricao: v.nome, dados: v })),
    ...catalogos.regras.map(v => ({ tipo: 'Regra', id: v.id, codigo: '', descricao: v.nome, dados: v })),
  ].filter(v => `${v.tipo} ${v.codigo} ${v.descricao} ${v.id}`.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))).sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base', numeric: true }));
  return <section className="panel p-6"><div className="section-heading"><div><h2>Auditoria e permissões</h2><p className="muted">Administração dos usuários, registros e alterações do catálogo.</p></div><Button variant="outline" disabled={carregando} onClick={() => setRevisao(v => v + 1)}>Atualizar</Button></div>
    <div className="subtabs">{[['usuarios', 'Usuários e permissões'], ['registros', 'Todos os registros'], ['historico', 'Histórico de alterações']].map(([id, nome]) => <Button key={id} size="sm" variant={aba === id ? 'default' : 'ghost'} onClick={() => { setAba(id); setBusca(''); setPagina(0); }}>{nome}</Button>)}</div>
    <input aria-label="Buscar na auditoria" value={busca} onChange={e => { setBusca(e.target.value); setPagina(0); }} placeholder={aba === 'usuarios' ? 'Buscar e-mail…' : aba === 'historico' ? 'Filtrar pelo nome da tabela…' : 'Buscar código, descrição ou ID…'} />
    {erro && <p className="error" role="alert">{erro}</p>}
    {carregando && <p className="muted" role="status">Carregando…</p>}
    {!erro && aba === 'usuarios' && <div className="table-scroll"><table><thead><tr><th>Usuário</th><th>Último acesso</th><th>Acesso aos cadastros</th><th>Ação</th></tr></thead><tbody>{usuarios.filter(u => (u.email ?? '').toLowerCase().includes(busca.toLowerCase())).map(u => <tr key={u.user_id}><td>{u.email ?? u.user_id}{u.super && <span className="badge validado ml-2">Super</span>}</td><td>{u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString('pt-BR') : 'Ainda não acessou'}</td><td>{u.pode_editar ? 'Pode cadastrar, editar e excluir' : 'Somente consulta e medição'}</td><td>{u.super ? 'Acesso total' : <Button size="sm" variant="outline" disabled={!!salvando || carregando} aria-label={`${u.pode_editar ? 'Revogar' : 'Permitir'} cadastros para ${u.email}`} onClick={() => void alterar(u)}>{salvando === u.user_id ? 'Salvando…' : u.pode_editar ? 'Revogar cadastros' : 'Permitir cadastros'}</Button>}</td></tr>)}</tbody></table></div>}
    {!erro && aba === 'registros' && <><p className="muted mt-3">{registros.length} registros · dados atuais do catálogo compartilhado</p><div className="table-scroll"><table><thead><tr><th>Tipo</th><th>Código</th><th>Descrição</th><th>Registro completo</th></tr></thead><tbody>{registros.map(r => <tr key={`${r.tipo}-${r.id}`}><td>{r.tipo}</td><td>{r.codigo || '—'}</td><td>{r.descricao}</td><td><details><summary>Ver dados</summary><pre className="audit-json">{JSON.stringify(r.dados, null, 2)}</pre></details></td></tr>)}</tbody></table></div></>}
    {!erro && aba === 'historico' && <><p className="notice mt-3">As alterações são registradas a partir da ativação desta auditoria. PDF e pontos permanecem no navegador de cada usuário.</p><div className="table-scroll"><table><thead><tr><th>Data</th><th>Usuário</th><th>Tabela</th><th>Ação</th><th>Dados</th></tr></thead><tbody>{historico.map(r => <tr key={r.id}><td>{new Date(r.ocorrido_em).toLocaleString('pt-BR')}</td><td>{r.usuario_email ?? 'Sistema'}</td><td>{r.tabela}</td><td>{{ INSERT: 'Criação', UPDATE: 'Edição', DELETE: 'Exclusão' }[r.acao] ?? r.acao}</td><td><details><summary>Ver alteração</summary><pre className="audit-json">{JSON.stringify({ antes: r.antes, depois: r.depois }, null, 2)}</pre></details></td></tr>)}</tbody></table></div>{!historico.length && !carregando && <p className="muted p-6">Nenhuma alteração registrada.</p>}<div className="flex items-center gap-3 mt-3"><Button size="sm" variant="outline" disabled={pagina === 0 || carregando} onClick={() => setPagina(p => p - 1)}>Anterior</Button><span className="muted">Página {pagina + 1} · {total} alterações</span><Button size="sm" variant="outline" disabled={(pagina + 1) * 50 >= total || carregando} onClick={() => setPagina(p => p + 1)}>Próxima</Button></div></>}
  </section>;
}
