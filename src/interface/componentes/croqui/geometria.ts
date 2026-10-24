export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
export const limitar = (valor: number, minimo: number, maximo: number) => Math.max(minimo, Math.min(maximo, valor));
export function coordenadaRelativa(clientX: number, clientY: number, pagina: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>) {
  return { x_percent: limitar((clientX - pagina.left) / pagina.width, 0, 1), y_percent: limitar((clientY - pagina.top) / pagina.height, 0, 1) };
}
export function enquadrar(pagina: { width: number; height: number }, area: { width: number; height: number }, largura = false) {
  const scale = limitar(Math.min((area.width - 48) / pagina.width, largura ? MAX_ZOOM : (area.height - 48) / pagina.height), MIN_ZOOM, MAX_ZOOM);
  return { scale, x: (area.width - pagina.width * scale) / 2, y: Math.max(24, (area.height - pagina.height * scale) / 2) };
}
// randomUUID não existe em HTTP na rede local; getRandomValues também funciona nesse cenário.
export function criarIdPonto() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  return [...bytes].map((b, i) => `${[4, 6, 8, 10].includes(i) ? '-' : ''}${b.toString(16).padStart(2, '0')}`).join('');
}
