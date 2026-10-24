import { create } from 'zustand';
import type { Catalogos } from '../../dominio/tipos';
import { CATALOGOS_VAZIOS } from '../../dominio/constantes';
import { carregarCatalogos } from '../../infraestrutura/supabase/repositorios/catalogos';
import { ehSuper, podeEditarCatalogos } from '../../infraestrutura/supabase/repositorios/permissoes';
let revisao = 0;
export const useCatalogosStore = create<{ catalogos: Catalogos; podeEditar: boolean; super: boolean; carregando: boolean; erro: string | null; carregar: () => Promise<void>; limpar: () => void }>(set => ({
  catalogos: CATALOGOS_VAZIOS, podeEditar: false, super: false, carregando: false, erro: null,
  carregar: async () => {
    const atual = ++revisao; set({ carregando: true, erro: null });
    try { const [catalogos, podeEditar, superUsuario] = await Promise.all([carregarCatalogos(), podeEditarCatalogos(), ehSuper()]); if (atual === revisao) set({ catalogos, podeEditar, super: superUsuario }); }
    catch (erro) { if (atual === revisao) set({ erro: erro && typeof erro === 'object' && 'message' in erro ? String(erro.message) : 'Não foi possível carregar os catálogos.' }); throw erro; }
    finally { if (atual === revisao) set({ carregando: false }); }
  },
  limpar: () => { ++revisao; set({ catalogos: CATALOGOS_VAZIOS, podeEditar: false, super: false, carregando: false, erro: null }); },
}));
