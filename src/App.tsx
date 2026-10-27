import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Database, Download, FileText, LogOut, Map, Moon, ShieldCheck, Sun } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { calcularMedicao } from './aplicacao/motor-regras';
import { consolidarMaoObra, obterResumoObra } from './aplicacao/resumo-obra';
import { ABAS_RESULTADO } from './dominio/constantes';
import type { PontoMedicao } from './dominio/tipos';
import { baixarExcel } from './infraestrutura/exportacao/excel';
import { carregarTema, salvarTema } from './infraestrutura/local/preferencias';
import { observarSessao, sair, retornoDeRecuperacao, erroNoLinkDeAcesso } from './infraestrutura/supabase/auth';
import { supabaseConfigurado } from './infraestrutura/supabase/cliente';
import { PDFViewer } from './interface/componentes/croqui/PDFViewer';
import { JanelaFlutuantePonto } from './interface/componentes/janela-ponto/JanelaFlutuantePonto';
import { TabelaResumo } from './interface/componentes/resumo/TabelaResumo';
import { Button } from './interface/componentes/ui/button';
import { RedefinirSenha } from './interface/paginas/RedefinirSenha';
import { Login } from './interface/paginas/Login';
import { Administracao } from './interface/paginas/Administracao';
import { Cadastros } from './interface/paginas/Cadastros';
import { useCatalogosStore } from './interface/store/useCatalogosStore';
import { useMedicaoStore } from './interface/store/useMedicaoStore';

function Resumo() {
  const salvo = useMedicaoStore(s => s.resultado);
  const pontos = useMedicaoStore(s => s.pontos);
  const pranchas = useMedicaoStore(s => s.pranchas);
  const { catalogos, carregando } = useCatalogosStore();
  const resultado = useMemo(() => {
    if (!salvo || carregando) return salvo;
    try { return calcularMedicao({ ...catalogos, pontos, pranchas }); } catch { return null; }
  }, [salvo, carregando, catalogos, pontos, pranchas]);
  const [aba, setAba] = useState<(typeof ABAS_RESULTADO)[number][0]>('materiaisInstalacao');
  if (!resultado) return <div className="panel empty"><ClipboardList size={32} /><h2>Seu resumo aparece aqui.</h2><p>Valide os pontos e clique em Gerar resumo.</p></div>;
  const resumo = obterResumoObra(resultado);
  return <section className="panel p-6"><div className="section-heading"><div><h2>Resumo da obra</h2><p className="muted">{resultado.porPonto.length} pontos medidos em {pranchas.length} PDF(s) · 3 consolidações + detalhamento por ponto</p></div><Button onClick={() => baixarExcel(resultado)}><Download size={16} />Baixar Excel da medição</Button></div><p className="notice mb-5">Exporte o Excel ao terminar. A medição está salva apenas neste navegador.</p><div className="subtabs">{ABAS_RESULTADO.map(([chave, nome]) => <Button variant={aba === chave ? 'default' : 'ghost'} size="sm" key={chave} onClick={() => setAba(chave)}>{nome} ({resumo[chave].length})</Button>)}</div><TabelaResumo key={aba} linhas={resumo[aba]} ordenarPorDescricao /></section>;
}
function Aplicacao() {
  const navigate = useNavigate();
  const localizacao = useLocation();
  const retornoConsumido = useRef(false);
  const [erroRecuperacao, setErroRecuperacao] = useState(erroNoLinkDeAcesso);
  const { pontos, pranchas, pronto, erroPersistencia, avisoAtualizacao, guardarResultado } = useMedicaoStore();
  const { catalogos, carregando, super: superUsuario } = useCatalogosStore();
  const [email, setEmail] = useState<string | null>(null);
  const [sessaoPronta, setSessaoPronta] = useState(!supabaseConfigurado);
  const [escuro, setEscuro] = useState(carregarTema);
  const [editando, setEditando] = useState<PontoMedicao | null>(null);
  const fechar = useCallback(() => setEditando(null), []);
  useEffect(() => { void useMedicaoStore.getState().restaurar(); }, []);
  useEffect(() => observarSessao((novoEmail, id, evento) => { setEmail(novoEmail); setSessaoPronta(true); if (evento === 'PASSWORD_RECOVERY' || (!retornoConsumido.current && evento === 'INITIAL_SESSION' && (retornoDeRecuperacao || erroNoLinkDeAcesso))) { retornoConsumido.current = true; setErroRecuperacao(evento !== 'PASSWORD_RECOVERY' && (erroNoLinkDeAcesso || !id)); navigate('/redefinir-senha', { replace: true }); } useCatalogosStore.getState().limpar(); if (id) void useCatalogosStore.getState().carregar().catch(erro => toast.error(`Falha ao carregar catálogos: ${String(erro)}`)); }), [navigate]);
  useEffect(() => { document.documentElement.classList.toggle('dark', escuro); salvarTema(escuro); }, [escuro]);
  const calculo = useMemo(() => { try { return { resultado: calcularMedicao({ ...catalogos, pontos, pranchas }), erro: null }; } catch (erro) { return { resultado: null, erro: erro instanceof Error ? erro.message : 'Falha no cálculo.' }; } }, [catalogos, pontos, pranchas]);
  const validados = pontos.filter(p => p.status === 'validado').length;
  const pendentes = pontos.length - validados;
  if (!sessaoPronta || !pronto) return <div className="empty" role="status">Restaurando sessão e medição local…</div>;
  if (localizacao.pathname === '/redefinir-senha') return <RedefinirSenha email={erroRecuperacao ? null : email} concluir={() => { setErroRecuperacao(false); navigate('/croqui', { replace: true }); }} />;
  if (supabaseConfigurado && !email) return <Login />;
  const gerar = async () => {
    if (!calculo.resultado) { toast.error(calculo.erro); return; }
    if (pendentes && !window.confirm(`${pendentes} ponto(s) pendente(s) não entrarão no resumo. Continuar apenas com os validados?`)) return;
    try { await guardarResultado(calculo.resultado); navigate('/resumo'); toast.success('Resumo gerado.'); } catch { toast.error('Não foi possível salvar o resumo localmente.'); }
  };
  const totalMateriais = calculo.resultado ? calculo.resultado.materiaisInstalacao.length + calculo.resultado.materiaisDesativacao.length : 0;
  const totalServicos = calculo.resultado ? consolidarMaoObra(calculo.resultado).length : 0;
  return <><main className="app-main"><div className="app-navigation"><nav className="tabs" aria-label="Navegação principal">{[['/croqui', 'Croqui', Map], ['/resumo', 'Resumo', ClipboardList], ['/auditoria', 'Auditoria', CheckCircle2], ['/cadastros', 'Cadastros', Database]].filter(([url]) => url !== '/auditoria' || superUsuario).map(([url, nome, Icon]) => { const Componente = Icon as typeof Map; return <NavLink key={String(url)} to={String(url)}><Componente size={17} />{String(nome)}</NavLink>; })}</nav><div className="app-nav-actions">{email && <span className="nav-user-email" title={email}>{email}</span>}<Button size="icon" variant="ghost" aria-label={escuro ? 'Ativar tema claro' : 'Ativar tema escuro'} onClick={() => setEscuro(!escuro)}>{escuro ? <Sun size={18} /> : <Moon size={18} />}</Button>{email && <Button size="icon" variant="ghost" aria-label="Sair" title={`Sair de ${email}`} onClick={() => void sair().catch(erro => toast.error(String(erro)))}><LogOut size={17} /></Button>}</div></div>
      {!supabaseConfigurado && <div className="notice mb-5">Supabase ainda não configurado. O PDF e os rascunhos já funcionam localmente. Configure o <code>.env.local</code> para autenticar e carregar catálogos.</div>}
      {avisoAtualizacao && <div className="notice mb-5" role="status">{avisoAtualizacao}</div>}
      {erroPersistencia && <div className="error-banner" role="alert">{erroPersistencia}</div>}
      {calculo.erro && <div className="error-banner" role="alert">{calculo.erro} Confira os vínculos dos pontos com o catálogo atual.</div>}
      <Routes><Route path="/croqui" element={<><div className="stats"><div><span className="stat-label">Pontos marcados</span><strong>{String(pontos.length).padStart(2, '0')}</strong></div><div><span className="stat-label"><i className="dot green" />Validados</span><strong>{String(validados).padStart(2, '0')}</strong></div><div><span className="stat-label"><i className="dot amber" />Pendentes</span><strong>{String(pendentes).padStart(2, '0')}</strong></div><div className="stat-summary"><span className="stat-label">Quantitativo em tempo real</span><p><b>{totalMateriais}</b> linhas de materiais <span>·</span> <b>{totalServicos}</b> de mão de obra</p></div><Button disabled={!validados || carregando || !!calculo.erro} onClick={() => void gerar()}><ClipboardList size={16} />Gerar resumo</Button></div><PDFViewer editar={setEditando} pontoEditando={editando?.id} fecharPonto={fechar} /><div className="help-row"><p><span>01</span> Adicione as pranchas</p><span className="help-line" /><p><span>02</span> Marque e valide os pontos</p><span className="help-line" /><p><span>03</span> Gere o resumo e exporte</p></div></>} /><Route path="/resumo" element={<Resumo />} /><Route path="/auditoria" element={carregando ? <p role="status">Verificando acesso…</p> : superUsuario ? <Administracao /> : <Navigate to="/croqui" replace />} /><Route path="/cadastros" element={<Cadastros />} /><Route path="*" element={<Navigate to="/croqui" replace />} /></Routes>
      <footer className="app-footer"><span><ShieldCheck size={14} /> PDF, pontos e medição ficam apenas neste navegador.</span><span><FileText size={14} />Exporte o Excel ao concluir.</span></footer>
    </main>{editando && <JanelaFlutuantePonto key={editando.id} ponto={editando} fechar={fechar} />}</>;
}
export default function App() { return <HashRouter><Aplicacao /><Toaster richColors position="bottom-right" /></HashRouter>; }
