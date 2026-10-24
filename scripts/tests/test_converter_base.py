import copy
import importlib.util
import unittest
import uuid
from pathlib import Path

spec = importlib.util.spec_from_file_location('conversor', Path(__file__).resolve().parents[1] / 'converter-base.py')
modulo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(modulo)
OWNER = '07c32c96-7baf-4d19-8d1b-e8c3d4a3bcc9'


class ConversaoTest(unittest.TestCase):
    def setUp(self):
        self.base = {
            'materiais': [
                {'id': 'slug_geral', 'codigo': '001', 'descricao': 'Cordoalha geral', 'categoria': 'geral', 'tipoCabo': ''},
                {'id': 'slug_cabo', 'codigo': '001', 'descricao': 'Cordoalha cabo', 'categoria': 'cabo', 'tipoCabo': 'BT'},
            ],
            'maoObra': [{'id': 'servico_ruim', 'codigo': 'MO-01', 'descricao': 'Instalar'}],
            'estruturas': [{'id': 'N4', 'descricao': 'N4', 'itens': [{'materialId': 'slug_geral', 'quantidade': 1}, {'materialId': 'slug_cabo', 'quantidade': '3KG'}]}],
            'regrasMaoObra': [{'id': 'regra_antiga', 'nome': 'Instalar cabos', 'gatilho': {'tipo': 'material', 'materialIds': ['slug_geral', 'slug_cabo']}, 'operacoes': ['I'], 'saidas': [{'maoObraId': 'servico_ruim', 'quantidade': 2}]}],
        }

    def converter(self, backup=None):
        return modulo.converter(self.base, backup or {}, OWNER)

    def test_uuid_novo_e_vinculos_remapeados(self):
        resultado = self.converter()
        ids = [r['id'] for rows in resultado['tabelas'].values() for r in rows]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(all(uuid.UUID(i).version == 4 for i in ids))
        m = resultado['mapa_ids']['materiais']['slug_cabo']
        self.assertEqual(resultado['tabelas']['estrutura_itens'][0]['material_id'], m)
        self.assertEqual(resultado['tabelas']['regra_alvos'][0]['material_id'], m)

    def test_unifica_codigo_e_soma_itens_sem_perder_quantidade(self):
        resultado = self.converter()
        self.assertEqual(len(resultado['tabelas']['materiais']), 1)
        self.assertEqual(resultado['tabelas']['materiais'][0]['categoria'], 'cabo')
        self.assertEqual(resultado['tabelas']['estrutura_itens'][0]['quantidade'], 4)
        self.assertEqual(len(resultado['tabelas']['regra_alvos']), 1)
        self.assertEqual(resultado['tabelas']['regra_saidas'][0]['quantidade'], 2)

    def test_preserva_cadastro_existente_e_nao_inclui_na_reversao(self):
        anterior = {'id': str(uuid.uuid4()), 'user_id': OWNER, 'codigo': '001', 'descricao': 'Descrição já editada', 'categoria': 'geral', 'tipo_cabo': None}
        resultado = self.converter({'materiais': [anterior]})
        self.assertEqual(resultado['tabelas']['materiais'], [anterior])
        self.assertFalse(resultado['novos']['materiais'])
        self.assertNotIn('delete from public.materiais', modulo.gerar_reversao(resultado))

    def test_ignora_alvo_inexistente_mantendo_regra_com_alvo_valido(self):
        self.base['regrasMaoObra'][0]['gatilho'] = {'tipo': 'estrutura', 'estruturaIds': ['N4', 'INEXISTENTE']}
        resultado = self.converter()
        self.assertEqual(len(resultado['tabelas']['regras_mao_obra']), 1)
        self.assertEqual(len(resultado['tabelas']['regra_alvos']), 1)
        self.assertTrue(any(a['tipo'] == 'vinculo_ignorado' for a in resultado['relatorio']['avisos']))

    def test_sql_transacional_repetivel_sem_atualizar_registros(self):
        resultado = self.converter()
        sql = modulo.gerar_sql(resultado)
        self.assertIn('begin;', sql)
        self.assertIn('on conflict(id) do nothing', sql)
        self.assertNotIn('do update', sql)
        self.assertTrue(sql.endswith('commit;\n'))
        self.assertIn(resultado['tabelas']['materiais'][0]['id'], modulo.gerar_reversao(resultado))

    def test_quantidades_invalidas_e_origem_nao_alterada(self):
        original = copy.deepcopy(self.base)
        self.converter()
        self.assertEqual(self.base, original)
        for valor in [0, -1, 'inválido', float('nan'), True]:
            self.assertIsNone(modulo.quantidade(valor))
        self.assertEqual(modulo.quantidade('3KG'), 3)
        self.assertEqual(modulo.quantidade('2,5'), 2.5)


if __name__ == '__main__':
    unittest.main()
