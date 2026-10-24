import { Fragment, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { buscarNoIndice, faixasDestaque, indexarCatalogo, type ItemBusca } from '../../../aplicacao/busca-catalogo';
import { Button } from '../ui/button';
function Destaque({ texto, consulta }: { texto: string; consulta: string }) {
  const faixas = faixasDestaque(texto, consulta); let fim = 0;
  const partes = faixas.map(([inicio, final], indice) => {
    const antes = texto.slice(fim, inicio); fim = final;
    return <Fragment key={indice}>{antes}<mark>{texto.slice(inicio, final)}</mark></Fragment>;
  });
  return <>{partes}{texto.slice(fim)}</>;
}
export function BuscaCatalogo({ itens, valor, selecionar, rotulo, placeholder = 'Digite código ou descrição…' }: { itens: ItemBusca[]; valor?: string; selecionar: (id: string) => void; rotulo: string; placeholder?: string }) {
  const [busca, setBusca] = useState(''); const [aberto, setAberto] = useState(false); const [ativo, setAtivo] = useState(0);
  const id = useId(); const input = useRef<HTMLInputElement>(null);
  const indice = useMemo(() => indexarCatalogo(itens), [itens]);
  const resultados = useMemo(() => buscarNoIndice(indice, busca), [indice, busca]);
  const visiveis = resultados.slice(0, 25);
  const escolhido = itens.find(i => i.id === valor);
  const texto = (item: ItemBusca) => `${item.codigo ? item.codigo + ' · ' : ''}${item.descricao ?? item.nome ?? ''}`;
  const escolher = (item: ItemBusca) => { selecionar(item.id); setBusca(''); setAberto(false); setAtivo(0); input.current?.focus(); };
  return <div className="catalog-search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAberto(false); }}><label htmlFor={`${id}-input`}>{rotulo}</label><div className="search-input-row"><input id={`${id}-input`} ref={input} role="combobox" aria-autocomplete="list" aria-expanded={aberto} aria-controls={`${id}-list`} aria-activedescendant={aberto && visiveis[ativo] ? `${id}-${ativo}` : undefined} autoComplete="off" placeholder={placeholder} value={busca} onFocus={() => { setAberto(true); setAtivo(0); }} onChange={e => { setBusca(e.target.value); setAtivo(0); setAberto(true); }} onKeyDown={e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); setAberto(true);
      const proximo = Math.max(0, Math.min(visiveis.length - 1, ativo + (e.key === 'ArrowDown' ? aberto ? 1 : 0 : -1)));
      setAtivo(proximo); document.getElementById(`${id}-${proximo}`)?.scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter' && aberto) { e.preventDefault(); if (visiveis[ativo]) escolher(visiveis[ativo]); }
    if (e.key === 'Escape' && aberto) { e.preventDefault(); e.stopPropagation(); setAberto(false); }
  }} /><Button type="button" size="icon" variant="ghost" aria-label={`Mostrar opções: ${rotulo}`} aria-expanded={aberto} onMouseDown={e => e.preventDefault()} onClick={() => { if (aberto) setAberto(false); else { input.current?.focus(); setAberto(true); } }}><ChevronDown size={16} /></Button></div>
    {valor && <div className="chosen-item"><span>{escolhido ? texto(escolhido) : 'Registro indisponível no catálogo atual'}</span><Button variant="ghost" size="icon" type="button" aria-label={`Remover seleção: ${rotulo}`} onClick={() => selecionar('')}><X size={14} /></Button></div>}
    {aberto && <><div className="catalog-options" id={`${id}-list`} role="listbox" aria-label={`Resultados: ${rotulo}`}>{visiveis.map((item, i) => <button type="button" role="option" id={`${id}-${i}`} key={item.id} tabIndex={-1} aria-selected={ativo === i} onMouseDown={e => e.preventDefault()} onMouseEnter={() => setAtivo(i)} onClick={() => escolher(item)}><Destaque texto={texto(item)} consulta={busca} /></button>)}{!visiveis.length && <p className="muted p-3">Nenhum registro encontrado.</p>}</div><small className="search-count" role="status">{resultados.length > 25 ? `25 de ${resultados.length} registros. Continue digitando para refinar.` : `${resultados.length} registro(s) encontrado(s).`}</small></>}
  </div>;
}
