import { describe, expect, it } from 'vitest';
import { configurarPages } from './build-pages.mjs';
const env = { VITE_SUPABASE_URL: 'https://exemplo.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_publishable_exemplo', GITHUB_REPOSITORY: 'usuario/minhas-obras' };
describe('publicação no Pages', () => {
  it('usa o nome real do repositório', () => expect(configurarPages(env).VITE_BASE_PATH).toBe('/minhas-obras/'));
  it('usa a raiz nos repositórios de usuário', () => expect(configurarPages({ ...env, GITHUB_REPOSITORY: 'usuario/usuario.github.io' }).VITE_BASE_PATH).toBe('/'));
  it('aceita domínio próprio e normaliza caminhos', () => {
    expect(configurarPages({ ...env, VITE_BASE_PATH: '/' }).VITE_BASE_PATH).toBe('/');
    expect(configurarPages({ ...env, VITE_BASE_PATH: '/outro' }).VITE_BASE_PATH).toBe('/outro/');
  });
  it('bloqueia publicação sem configuração ou com chave de servidor', () => {
    expect(() => configurarPages({ ...env, VITE_SUPABASE_URL: '' })).toThrow('VITE_SUPABASE_URL');
    for (const chave of ['', 'sb_secret_exemplo', `e30.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.assinatura`]) {
      expect(() => configurarPages({ ...env, VITE_SUPABASE_ANON_KEY: chave })).toThrow('chave pública');
    }
  });
  it('aceita a chave pública anon legada', () => {
    const chave = `e30.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.assinatura`;
    expect(configurarPages({ ...env, VITE_SUPABASE_ANON_KEY: chave }).VITE_BASE_PATH).toBe('/minhas-obras/');
  });
  it('rejeita caminhos absolutos e URLs com credenciais sem exibi-las', () => {
    expect(() => configurarPages({ ...env, VITE_BASE_PATH: 'https://exemplo.com' })).toThrow('VITE_BASE_PATH');
    expect(() => configurarPages({ ...env, VITE_BASE_PATH: '/../outro' })).toThrow('VITE_BASE_PATH');
    expect(() => configurarPages({ ...env, VITE_SUPABASE_URL: 'https://usuario:senha@exemplo.com' })).toThrow('sem credenciais');
  });
});
