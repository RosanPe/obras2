import { useEffect, useState, type RefObject } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = worker;
export async function validarPdf(pdf: Blob) {
  const tarefa = getDocument({ data: await pdf.arrayBuffer() });
  try { await tarefa.promise; } finally { await tarefa.destroy(); }
}
export function usePdf(pdf: Blob | null, pagina: number, zoom: number, canvas: RefObject<HTMLCanvasElement>) {
  const [documento, setDocumento] = useState<PDFDocumentProxy | null>(null);
  const [folha, setFolha] = useState<PDFPageProxy | null>(null);
  const [tamanho, setTamanho] = useState({ width: 0, height: 0 });
  const [renderizando, setRenderizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [paginaPronta, setPaginaPronta] = useState(false);
  useEffect(() => {
    let ativo = true; let tarefa: ReturnType<typeof getDocument> | undefined;
    setDocumento(null); setFolha(null); setPaginaPronta(false); setErro(null);
    if (!pdf) return;
    setRenderizando(true);
    void pdf.arrayBuffer().then(data => {
      if (!ativo) return;
      tarefa = getDocument({ data });
      return tarefa.promise.then(doc => { if (ativo) setDocumento(doc); });
    }).catch(() => { if (ativo) { setErro('Não foi possível abrir o PDF. Verifique se está válido e sem senha.'); setRenderizando(false); } });
    return () => { ativo = false; void tarefa?.destroy(); };
  }, [pdf]);
  useEffect(() => {
    let ativo = true;
    setFolha(null); setPaginaPronta(false);
    if (!documento) return;
    setRenderizando(true);
    void documento.getPage(Math.min(pagina, documento.numPages)).then(page => {
      if (!ativo) return;
      const viewport = page.getViewport({ scale: 1 });
      setTamanho({ width: viewport.width, height: viewport.height }); setFolha(page);
    }).catch(() => { if (ativo) { setErro('Falha ao carregar a página.'); setRenderizando(false); } });
    return () => { ativo = false; };
  }, [documento, pagina]);
  useEffect(() => {
    if (!folha) return;
    let ativo = true; let tarefa: ReturnType<PDFPageProxy['render']> | undefined;
    // Canvas separado mantém a folha visível durante roda/pinch e evita renders concorrentes.
    const timer = window.setTimeout(() => {
      if (!canvas.current) return;
      setRenderizando(true);
      const base = folha.getViewport({ scale: 1 });
      const escala = Math.min(zoom * Math.min(devicePixelRatio || 1, 2), Math.sqrt(16_000_000 / (base.width * base.height)));
      const viewport = folha.getViewport({ scale: escala });
      const buffer = document.createElement('canvas'); buffer.width = Math.ceil(viewport.width); buffer.height = Math.ceil(viewport.height);
      tarefa = folha.render({ canvasContext: buffer.getContext('2d')!, viewport });
      void tarefa.promise.then(() => {
        if (!ativo || !canvas.current) return;
        const destino = canvas.current;
        destino.width = buffer.width; destino.height = buffer.height;
        destino.getContext('2d')!.drawImage(buffer, 0, 0);
        setErro(null); setPaginaPronta(true); setRenderizando(false);
      }).catch((falha: unknown) => {
        if (ativo && !(falha instanceof Error && falha.name === 'RenderingCancelledException')) { setErro('Falha ao renderizar a página.'); setRenderizando(false); }
      }).finally(() => { buffer.width = 0; buffer.height = 0; });
    }, 180);
    return () => { ativo = false; clearTimeout(timer); tarefa?.cancel(); };
  }, [folha, zoom, canvas]);
  return { documento, tamanho, renderizando, erro, paginaPronta };
}
