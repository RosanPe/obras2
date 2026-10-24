export function carregarTema() { return localStorage.getItem('obras:tema') === 'escuro'; }
export function salvarTema(escuro: boolean) { localStorage.setItem('obras:tema', escuro ? 'escuro' : 'claro'); }
