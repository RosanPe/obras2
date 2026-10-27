import { useEffect, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import { ChevronLeft, ChevronRight, RotateCcw, Trash2, Crosshair, FileUp, Hand, Maximize2, Minimize2, Minus, MousePointer2, Plus, Scan } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { useMedicaoStore } from '../../store/useMedicaoStore';
import { usePdf, validarPdf } from '../../hooks/usePdf';
import type { PontoMedicao } from '../../../dominio/tipos';
import { coordenadaRelativa, criarIdPonto, enquadrar, limitar, MAX_ZOOM, MIN_ZOOM } from './geometria';
import { PontoMarker } from './PontoMarker';
type Modo = 'mover' | 'marcar' | 'validar';
export function PDFViewer({ editar, pontoEditando, fecharPonto }: { editar: (ponto: PontoMedicao) => void; pontoEditando?: string; fecharPonto: () => void }) {
  const { pranchas, pranchaAtivaId, paginaAtiva: pagina, pontos, adicionarPdfs, iniciarNovaMedicao, selecionarPrancha, selecionarPagina, removerPrancha, salvarPonto } = useMedicaoStore();
  const prancha = pranchas.find(p => p.id === pranchaAtivaId);
  const pdf = prancha?.pdf ?? null;
  const pontosPagina = pontos.filter(p => p.prancha_id === pranchaAtivaId && p.pagina === pagina);
  const [zoom, setZoom] = useState(1);
  const [modo, setModo] = useState<Modo>(pontos.length ? 'mover' : 'marcar');
  const [espaco, setEspaco] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const folha = useRef<HTMLDivElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const transform = useRef<ReactZoomPanPinchContentRef>(null);
  const inicioClique = useRef({ x: 0, y: 0 });
  const ignorarCliqueAte = useRef(0);
  const criando = useRef(false);
  const { documento, tamanho, renderizando, erro, paginaPronta } = usePdf(pdf, pagina, zoom, canvas);
  const modoPan = modo === 'mover' || espaco;
  const ajustar = (largura = false) => {
    if (!container.current || !tamanho.width) return;
    const vista = enquadrar(tamanho, { width: container.current.clientWidth, height: container.current.clientHeight }, largura);
    transform.current?.setTransform(vista.x, vista.y, vista.scale, 0);
  };
  useEffect(() => {
    if (!tamanho.width) return;
    const frame = requestAnimationFrame(() => ajustar());
    return () => cancelAnimationFrame(frame);
    // Reenquadrar ao trocar a folha/área, preservando pan durante edição e zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tamanho.width, tamanho.height, documento, pagina, expandido]);
  useEffect(() => {
    if (!expandido) return;
    const anterior = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = anterior; };
  }, [expandido]);
  useEffect(() => {
    const liberar = () => setEspaco(false);
    const tecla = (e: KeyboardEvent) => { if (e.code === 'Space') liberar(); if (e.key === 'Escape' && !pontoEditando) setExpandido(false); };
    window.addEventListener('keyup', tecla); window.addEventListener('blur', liberar);
    return () => { window.removeEventListener('keyup', tecla); window.removeEventListener('blur', liberar); };
  }, [pontoEditando]);
  const zoomPara = (escala: number) => {
    if (!transform.current || !container.current) return;
    const atual = transform.current.instance.transformState;
    const scale = limitar(escala, MIN_ZOOM, MAX_ZOOM);
    const x = container.current.clientWidth / 2; const y = container.current.clientHeight / 2;
    transform.current.setTransform(x - (x - atual.positionX) * scale / atual.scale, y - (y - atual.positionY) * scale / atual.scale, scale, 0);
  };
  const navegarPagina = (numero: number) => {
    fecharPonto(); ignorarCliqueAte.current = Date.now() + 500;
    void selecionarPagina(numero).catch(() => toast.error('Não foi possível trocar a página.'));
  };
  const navegarPrancha = (id: string) => {
    fecharPonto(); ignorarCliqueAte.current = Date.now() + 500;
    void selecionarPrancha(id).catch(() => toast.error('Não foi possível trocar a prancha.'));
  };
  const carregar = async (files: File[]) => {
    if (!files.length) return;
    try {
      setCarregando(true);
      for (const file of files) {
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error(`Escolha arquivos PDF: ${file.name}`);
        await validarPdf(file);
      }
      fecharPonto(); await adicionarPdfs(files.map(file => ({ pdf: file, nome: file.name })));
      setModo('marcar'); toast.success(`${files.length} PDF(s) adicionado(s). Os pontos das outras pranchas foram preservados.`);
    } catch (falha) { toast.error(falha instanceof Error ? falha.message : 'Falha ao carregar os PDFs.'); }
    finally { setCarregando(false); }
  };
  const novaMedicao = async () => {
    if (!window.confirm('Iniciar uma nova medição? Todos os PDFs, pontos e o resumo desta obra serão apagados deste navegador. Exporte o Excel antes de continuar.')) return;
    try {
      setCarregando(true); fecharPonto(); await iniciarNovaMedicao();
      setModo('marcar'); setZoom(1); setExpandido(false);
      toast.success('Nova medição iniciada. Adicione os PDFs da próxima obra.');
    } catch { toast.error('Não foi possível limpar a medição. Os dados anteriores foram preservados.'); }
    finally { setCarregando(false); }
  };
  const remover = async () => {
    if (!prancha) return;
    const quantidade = pontos.filter(p => p.prancha_id === prancha.id).length;
    if (!window.confirm(`Remover ${prancha.nome}? Os ${quantidade} ponto(s) desta prancha serão excluídos e o resumo será invalidado. As outras pranchas serão preservadas.`)) return;
    try { setCarregando(true); fecharPonto(); await removerPrancha(prancha.id); toast.success('Prancha removida.'); }
    catch { toast.error('Não foi possível remover a prancha.'); }
    finally { setCarregando(false); }
  };
  return <section className={`viewer panel ${expandido ? 'viewer-expanded' : ''}`} aria-label="Área interativa do croqui"><div className="toolbar"><div className="pdf-files-controls"><Button variant="outline" disabled={carregando} onClick={() => arquivo.current?.click()}><FileUp size={16} />{carregando ? 'Abrindo…' : pdf ? 'Adicionar PDFs' : 'Carregar PDFs'}</Button>{!!pranchas.length && <label className="prancha-picker">Prancha<select aria-label="Prancha do projeto" value={pranchaAtivaId ?? ''} disabled={carregando || criando.current} onChange={e => navegarPrancha(e.target.value)}>{pranchas.map((p, i) => <option key={p.id} value={p.id}>{i + 1} · {p.nome}</option>)}</select></label>}{prancha && <Button size="icon" variant="ghost" disabled={carregando} aria-label="Remover prancha atual" onClick={() => void remover()}><Trash2 size={16} /></Button>}</div>
    {documento && <div className="zoom-controls"><Button variant="ghost" size="icon" aria-label="Diminuir zoom" onClick={() => zoomPara(zoom / 1.25)}><Minus size={16} /></Button><button onClick={() => zoomPara(1)} className="zoom" title="Restaurar 100%">{Math.round(zoom * 100)}%</button><Button variant="ghost" size="icon" aria-label="Aumentar zoom" onClick={() => zoomPara(zoom * 1.25)}><Plus size={16} /></Button><input className="zoom-slider" aria-label="Zoom do croqui" type="range" min="10" max="800" step="5" value={Math.round(zoom * 100)} onChange={e => zoomPara(Number(e.target.value) / 100)} /><Button variant="ghost" size="sm" onClick={() => ajustar()}><Scan size={14} />Enquadrar</Button><Button variant="ghost" size="sm" onClick={() => ajustar(true)}>Largura</Button></div>}
    <Button variant="outline" size="sm" disabled={carregando || (!pranchas.length && !pontos.length)} onClick={() => void novaMedicao()} title="Limpar PDFs, pontos e resumo para começar outra obra"><RotateCcw size={15} />Nova medição</Button>
    <Button variant="outline" size="icon" aria-label={expandido ? 'Recolher área do croqui' : 'Expandir área do croqui'} onClick={() => setExpandido(!expandido)}>{expandido ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</Button>
    <input ref={arquivo} type="file" accept="application/pdf,.pdf" multiple className="sr-only" onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) void carregar(files); e.target.value = ''; }} />
  </div>{documento && <div className="mode-toolbar"><div className="mode-buttons" role="group" aria-label="Modo de interação com o croqui">{([['mover', 'Mover', Hand], ['marcar', 'Marcar ponto', Crosshair], ['validar', 'Editar pontos', MousePointer2]] as const).map(([valor, nome, Icone]) => <Button key={valor} variant={modo === valor ? 'default' : 'ghost'} size="sm" aria-pressed={modo === valor} onClick={() => setModo(valor)}><Icone size={15} />{nome}</Button>)}</div><div className="page-navigation" role="group" aria-label="Navegação das páginas"><Button variant="ghost" size="icon" aria-label="Página anterior" disabled={pagina <= 1 || carregando} onClick={() => navegarPagina(pagina - 1)}><ChevronLeft size={16} /></Button><label className="page-label">Página <select aria-label="Página do PDF" value={pagina} disabled={carregando} onChange={e => navegarPagina(Number(e.target.value))}>{Array.from({ length: documento.numPages }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select> / {documento.numPages}</label><Button variant="ghost" size="icon" aria-label="Próxima página" disabled={pagina >= documento.numPages || carregando} onClick={() => navegarPagina(pagina + 1)}><ChevronRight size={16} /></Button></div><span>{modo === 'marcar' ? 'Clique nos círculos vermelhos do desenho para criar os pontos interativos.' : modo === 'mover' ? 'Arraste a folha para navegar. Clique nos marcadores para editar.' : 'Clique em um marcador para preencher. Arraste o marcador para reposicionar.'}</span></div>}
  <div className={`pdf-workspace ${modoPan ? 'pan-mode' : modo === 'marcar' ? 'mark-mode' : ''}`} ref={container} tabIndex={0} aria-label="Croqui: roda para zoom, arraste para mover e modo Marcar para adicionar pontos" onPointerDownCapture={e => {
    inicioClique.current = { x: e.clientX, y: e.clientY };
    if (e.target instanceof HTMLCanvasElement) container.current?.focus({ preventScroll: true });
  }} onPointerMoveCapture={e => { if (e.buttons && Math.hypot(e.clientX - inicioClique.current.x, e.clientY - inicioClique.current.y) > 5) ignorarCliqueAte.current = Date.now() + 250; }} onTouchStartCapture={e => { if (e.touches.length > 1) ignorarCliqueAte.current = Date.now() + 1000; }} onTouchEndCapture={() => { if (ignorarCliqueAte.current > Date.now()) ignorarCliqueAte.current = Date.now() + 300; }} onKeyDown={e => {
    if (e.target !== container.current) return;
    if (e.code === 'Space') { e.preventDefault(); setEspaco(true); }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomPara(zoom * 1.25); }
    if (e.key === '-') { e.preventDefault(); zoomPara(zoom / 1.25); }
  }}>
    {!pdf ? <div className="empty"><div className="empty-icon"><FileUp size={30} strokeWidth={1.5} /></div><p className="eyebrow">COMECE PELO CROQUI</p><h2>A medição começa aqui.</h2><p>Carregue os PDFs da obra e marque<br />os pontos diretamente no desenho.</p><Button disabled={carregando} onClick={() => arquivo.current?.click()}><Plus size={17} />Carregar pranchas (PDF)</Button><small>As pranchas permanecem apenas neste navegador.</small></div> : <TransformWrapper ref={transform} minScale={MIN_ZOOM} maxScale={MAX_ZOOM} limitToBounds={false} centerZoomedOut={false} smooth={false} panning={{ allowLeftClickPan: modoPan, allowMiddleClickPan: true, excluded: ['marker'], velocityDisabled: true }} pinch={{ disabled: false, excluded: ['marker'] }} wheel={{ step: .12, excluded: ['marker'] }} doubleClick={{ disabled: true }} onTransformed={(_ref, state) => { setZoom(atual => Math.abs(atual - state.scale) > .0001 ? state.scale : atual); }}>
      <TransformComponent wrapperClass="pdf-transform-viewport" contentClass="pdf-transform-content"><div className="pdf-page" ref={folha} style={{ ...tamanho, visibility: paginaPronta ? 'visible' : 'hidden' }} onClick={e => {
        if (carregando || modo !== 'marcar' || espaco || !paginaPronta || !folha.current || criando.current || Date.now() < ignorarCliqueAte.current || e.button !== 0) return;
        const numeros = new Set(pontos.map(p => p.numero)); let indice = 1; while (numeros.has(`P${String(indice).padStart(2, '0')}`)) indice++;
        const novo: PontoMedicao = { id: criarIdPonto(), numero: `P${String(indice).padStart(2, '0')}`, prancha_id: pranchaAtivaId ?? undefined, materiais_adicionais: [], pagina, ...coordenadaRelativa(e.clientX, e.clientY, folha.current.getBoundingClientRect()), status: 'pendente', operacao: 'I', estrutura_id: null, estruturas_secundarias: [], poste_id: null, cabos_ids: [], metragem_linear: 0, mao_obra_adicional: [] };
        criando.current = true; editar(novo);
        void salvarPonto(novo).catch(() => toast.error('Ponto criado em memória, mas não foi possível salvá-lo no navegador.')).finally(() => { criando.current = false; });
      }}><canvas ref={canvas} style={tamanho} />{pontosPagina.map(ponto => <PontoMarker key={ponto.id} ponto={ponto} zoom={zoom} pagina={folha} editar={editar} selecionado={pontoEditando === ponto.id} />)}</div></TransformComponent>
    </TransformWrapper>}
    {pdf && renderizando && <span role="status" className="pdf-render-indicator">{paginaPronta ? 'Ajustando nitidez…' : 'Renderizando croqui…'}</span>}{erro && <p role="alert" className="pdf-error">{erro}</p>}
  </div>{pdf && <div className="viewer-footer"><span className="status-dot" /><span>Roda: zoom · Mover: arraste a folha · Espaço: mover temporariamente · Celular: pinça com dois dedos</span><span className="ml-auto">{pontosPagina.length} ponto(s) nesta página</span></div>}</section>;
}
