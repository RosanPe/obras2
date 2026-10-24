import { useRef, useState, type RefObject } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import type { PontoMedicao } from '../../../dominio/tipos';
import { useMedicaoStore } from '../../store/useMedicaoStore';
import { coordenadaRelativa } from './geometria';
export function PontoMarker({ ponto, zoom, pagina, editar, selecionado }: { ponto: PontoMedicao; zoom: number; pagina: RefObject<HTMLDivElement>; editar: (ponto: PontoMedicao) => void; selecionado: boolean }) {
  const [previa, setPrevia] = useState<{ x_percent: number; y_percent: number } | null>(null);
  const gesto = useRef<{ x: number; y: number; moveu: boolean } | null>(null);
  const suprimirClique = useRef(false);
  const local = previa ?? ponto;
  return <button type="button" className={`marker ${ponto.status} ${selecionado ? 'editing' : ''}`} style={{ left: `${local.x_percent * 100}%`, top: `${local.y_percent * 100}%`, transform: `translate(-50%, -50%) scale(${1 / zoom})`, touchAction: 'none' }} title={`${ponto.numero} · ${ponto.status} · arraste para mover`} aria-label={`Editar ${ponto.numero}, ${ponto.status}`} onClick={e => {
    e.stopPropagation(); if (!suprimirClique.current) editar(ponto); suprimirClique.current = false;
  }} onPointerDown={e => {
    e.stopPropagation(); if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId); gesto.current = { x: e.clientX, y: e.clientY, moveu: false }; suprimirClique.current = false;
  }} onPointerMove={e => {
    const inicio = gesto.current; if (!inicio || !pagina.current) return;
    if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 5) inicio.moveu = true;
    if (inicio.moveu) setPrevia(coordenadaRelativa(e.clientX, e.clientY, pagina.current.getBoundingClientRect()));
  }} onPointerUp={e => {
    e.stopPropagation(); const inicio = gesto.current; gesto.current = null;
    if (inicio?.moveu && pagina.current) {
      suprimirClique.current = true;
      void useMedicaoStore.getState().salvarPonto({ ...ponto, ...coordenadaRelativa(e.clientX, e.clientY, pagina.current.getBoundingClientRect()) }).catch(() => toast.error('Falha ao salvar a posição do ponto.'));
    }
    setPrevia(null);
  }} onPointerCancel={() => { gesto.current = null; setPrevia(null); suprimirClique.current = true; }} onKeyDown={e => {
    if (e.key === 'Delete' && window.confirm(`Excluir o ponto ${ponto.numero}?`)) { e.preventDefault(); void useMedicaoStore.getState().excluirPonto(ponto.id).catch(() => toast.error('Falha ao excluir o ponto.')); }
  }}>{ponto.status === 'validado' ? <Check size={16} /> : ponto.numero.replace(/^P/, '')}</button>;
}
