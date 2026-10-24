#!/usr/bin/env python3
"""Converte a base legada em catálogos relacionais com UUIDs e SQL transacional.
Não acessa a rede nem lê senhas. Preserve os artefatos gerados para auditoria/reversão.
"""
import argparse
import hashlib
import json
import math
import re
import uuid
from collections import defaultdict
from pathlib import Path

TABELAS = {
    'materiais': 'id uuid,user_id uuid,codigo text,descricao text,categoria text,tipo_cabo text',
    'mao_obra': 'id uuid,user_id uuid,codigo text,descricao text',
    'estruturas': 'id uuid,user_id uuid,nome text',
    'estrutura_itens': 'id uuid,user_id uuid,estrutura_id uuid,material_id uuid,quantidade numeric',
    'regras_mao_obra': 'id uuid,user_id uuid,nome text,tipo_gatilho text,material_id uuid,estrutura_id uuid,categorias text[],operacoes text[]',
    'regra_saidas': 'id uuid,user_id uuid,regra_id uuid,mao_obra_id uuid,quantidade numeric',
    'regra_alvos': 'id uuid,user_id uuid,regra_id uuid,material_id uuid,estrutura_id uuid',
}

def texto(valor):
    return '' if valor is None else str(valor).strip()

def quantidade(valor):
    if isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        numero = float(valor)
    elif isinstance(valor, str):
        match = re.fullmatch(r'\s*(\d+(?:[.,]\d+)?)\s*[a-zA-Z]*\s*', valor)
        if not match:
            return None
        numero = float(match.group(1).replace(',', '.'))
    else:
        return None
    return numero if math.isfinite(numero) and numero > 0 else None

def converter(base, backup, usuario_id):
    usuario_id = str(uuid.UUID(usuario_id))
    tabelas = {t: [] for t in TABELAS}
    novos = {t: [] for t in TABELAS}
    mapas = {k: {} for k in ['materiais', 'maoObra', 'estruturas', 'regrasMaoObra']}
    avisos = []
    duplicados = []
    reutilizados = []

    def aviso(tipo, origem, detalhe):
        avisos.append({'tipo': tipo, 'origem': origem, 'detalhe': detalhe})

    def registrar(tabela, dados, novo=True):
        registro = {'id': str(uuid.uuid4()), 'user_id': usuario_id, **dados}
        tabelas[tabela].append(registro)
        if novo:
            novos[tabela].append(registro)
        return registro

    def existentes(tabela, chave):
        resultado = {}
        for registro in backup.get(tabela, []):
            valor = texto(registro[chave])
            if valor in resultado:
                raise ValueError(f'Cadastro existente ambíguo: {tabela}.{chave}={valor}')
            resultado[valor] = registro
        return resultado

    for origem, tabela in [('materiais', 'materiais'), ('maoObra', 'mao_obra')]:
        grupos = defaultdict(list)
        anteriores = existentes(tabela, 'codigo')
        for item in base.get(origem, []):
            if not texto(item.get('id')) or not texto(item.get('codigo')) or not texto(item.get('descricao')):
                aviso('registro_ignorado', item.get('id'), f'{origem}: id de origem, código ou descrição ausente')
                continue
            grupos[texto(item['codigo'])].append(item)
        for codigo, itens in grupos.items():
            # Preferir a categoria explícita cabo/poste quando a mesma chave também veio como geral.
            candidato = max(itens, key=lambda i: int(i.get('categoria') in ('poste', 'cabo'))) if origem == 'materiais' else itens[0]
            anterior = anteriores.get(codigo)
            if anterior:
                registro = registrar(tabela, anterior, novo=False)
                reutilizados.append({'tabela': tabela, 'chave': codigo, 'id': registro['id']})
            else:
                campos = {'codigo': codigo, 'descricao': texto(candidato['descricao'])}
                if origem == 'materiais':
                    categoria = candidato.get('categoria', 'geral')
                    tipo = candidato.get('tipoCabo', candidato.get('tipo_cabo'))
                    if categoria not in ('geral', 'poste', 'cabo') or (categoria == 'cabo' and tipo not in ('BT', 'MT')):
                        aviso('categoria_adaptada', candidato['id'], 'Categoria/tipo incompatível conservado como material geral')
                        categoria = 'geral'
                    campos.update(categoria=categoria, tipo_cabo=tipo if categoria == 'cabo' else None)
                registro = registrar(tabela, campos)
            for item in itens:
                legado = texto(item['id'])
                if legado in mapas[origem]:
                    raise ValueError(f'ID de origem ambíguo em {origem}: {legado}')
                mapas[origem][legado] = registro['id']
            if len(itens) > 1:
                duplicados.append({'tabela': tabela, 'codigo': codigo, 'id_destino': registro['id'], 'descricao_mantida': registro['descricao'], 'variantes_origem': itens})

    antigas_estruturas = existentes('estruturas', 'nome')
    for item in base.get('estruturas', []):
        legado = texto(item.get('id'))
        nome = texto(item.get('nome') or item.get('descricao') or legado)
        if not legado or not nome:
            aviso('registro_ignorado', legado, 'Estrutura sem nome/id de origem')
            continue
        anterior = antigas_estruturas.get(nome)
        if anterior:
            registro = registrar('estruturas', anterior, novo=False)
            mapas['estruturas'][legado] = registro['id']
            for filho in backup.get('estrutura_itens', []):
                if filho['estrutura_id'] == registro['id']:
                    registrar('estrutura_itens', filho, novo=False)
            reutilizados.append({'tabela': 'estruturas', 'chave': nome, 'id': registro['id']})
            continue
        itens = {}
        for filho in item.get('itens', []):
            material_id = mapas['materiais'].get(texto(filho.get('materialId')))
            q = quantidade(filho.get('quantidade'))
            if not material_id or q is None:
                aviso('item_ignorado', legado, filho)
                continue
            if isinstance(filho.get('quantidade'), str):
                aviso('quantidade_convertida', legado, {'original': filho['quantidade'], 'quantidade': q, 'material_origem': filho.get('materialId')})
            if material_id in itens:
                aviso('itens_consolidados', legado, {'material_id': material_id, 'quantidade_adicionada': q})
            itens[material_id] = round(itens.get(material_id, 0) + q, 8)
        if not itens:
            aviso('registro_ignorado', legado, 'Estrutura sem itens compatíveis')
            continue
        registro = registrar('estruturas', {'nome': nome})
        mapas['estruturas'][legado] = registro['id']
        for material_id, q in itens.items():
            registrar('estrutura_itens', {'estrutura_id': registro['id'], 'material_id': material_id, 'quantidade': q})

    antigas_regras = existentes('regras_mao_obra', 'nome')
    for item in base.get('regrasMaoObra', []):
        legado = texto(item.get('id'))
        nome = texto(item.get('nome') or legado)
        if not legado or not nome:
            aviso('registro_ignorado', legado, 'Regra sem nome/id de origem')
            continue
        anterior = antigas_regras.get(nome)
        if anterior:
            registro = registrar('regras_mao_obra', anterior, novo=False)
            mapas['regrasMaoObra'][legado] = registro['id']
            for tabela in ['regra_saidas', 'regra_alvos']:
                for filho in backup.get(tabela, []):
                    if filho['regra_id'] == registro['id']:
                        registrar(tabela, filho, novo=False)
            reutilizados.append({'tabela': 'regras_mao_obra', 'chave': nome, 'id': registro['id']})
            continue
        gatilho = item.get('gatilho') or {}
        tipo = gatilho.get('tipo') or item.get('tipoGatilho')
        categorias = list(dict.fromkeys(c for c in gatilho.get('categorias', item.get('categorias', [])) if c in ('cabo', 'poste', 'geral'))) if tipo == 'contexto' else []
        operacoes = list(dict.fromkeys(o for o in item.get('operacoes', []) if o in ('I', 'D', 'R')))
        materiais, estruturas = [], []
        for chave, singular, origem, destino in [('materialIds', 'materialId', 'materiais', materiais), ('estruturaIds', 'estruturaId', 'estruturas', estruturas)]:
            ids = list(gatilho.get(chave, item.get(chave, [])) or [])
            for candidato in [gatilho.get(singular), item.get(singular)]:
                if candidato:
                    ids.append(candidato)
            for id_origem in dict.fromkeys(ids):
                id_novo = mapas[origem].get(texto(id_origem))
                if not id_novo:
                    aviso('vinculo_ignorado', legado, {'tipo': origem, 'id_origem': id_origem})
                elif id_novo not in destino:
                    destino.append(id_novo)
        if tipo != 'material':
            materiais = []
        if tipo != 'estrutura':
            estruturas = []
        saidas = {}
        for saida in item.get('saidas', []):
            mo_id = mapas['maoObra'].get(texto(saida.get('maoObraId')))
            q = quantidade(saida.get('quantidade'))
            if not mo_id or q is None:
                aviso('saida_ignorada', legado, saida)
                continue
            saidas[mo_id] = round(saidas.get(mo_id, 0) + q, 8)
        if not operacoes or not saidas or tipo not in ('material', 'estrutura', 'contexto') or (tipo == 'material' and not materiais) or (tipo == 'estrutura' and not estruturas) or (tipo == 'contexto' and not categorias):
            aviso('registro_ignorado', legado, 'Regra sem gatilho/operação/saídas compatíveis')
            continue
        registro = registrar('regras_mao_obra', {'nome': nome, 'tipo_gatilho': tipo, 'material_id': materiais[0] if materiais else None, 'estrutura_id': estruturas[0] if estruturas else None, 'categorias': categorias, 'operacoes': operacoes})
        mapas['regrasMaoObra'][legado] = registro['id']
        for material_id in materiais:
            registrar('regra_alvos', {'regra_id': registro['id'], 'material_id': material_id, 'estrutura_id': None})
        for estrutura_id in estruturas:
            registrar('regra_alvos', {'regra_id': registro['id'], 'material_id': None, 'estrutura_id': estrutura_id})
        for mo_id, q in saidas.items():
            registrar('regra_saidas', {'regra_id': registro['id'], 'mao_obra_id': mo_id, 'quantidade': q})

    return {
        'tabelas': tabelas, 'novos': novos, 'mapa_ids': mapas,
        'relatorio': {
            'origem': {k: len(base.get(k, [])) for k in mapas},
            'convertidos': {k: len(v) for k, v in tabelas.items()},
            'novos': {k: len(v) for k, v in novos.items()},
            'codigos_unificados': duplicados, 'reutilizados': reutilizados, 'avisos': avisos,
            'tipos_cabo_preservados': {tipo: sum(1 for m in tabelas['materiais'] if m.get('categoria') == 'cabo' and m.get('tipo_cabo') == tipo) for tipo in ('BT', 'MT')},
            'campos_ignorados': ['versao', 'pontos', 'unidade', 'grupoRegraId', 'nomeBaseGrupo', 'metadados redundantes dos gatilhos e saídas'],
        },
    }

def sql_ids(ids):
    return 'array[' + ','.join("'" + str(uuid.UUID(i)) + "'" for i in ids) + ']::uuid[]'

def gerar_sql(convertida):
    linhas = ['-- Importação transacional. Executar uma vez; repetir o mesmo arquivo não duplica os UUIDs.', 'begin;', 'lock table ' + ','.join('public.'+t for t in TABELAS) + ' in share row exclusive mode;']
    for tabela, tipos in TABELAS.items():
        registros = convertida['novos'][tabela]
        if not registros:
            continue
        colunas = ','.join(c.split()[0] for c in tipos.split(','))
        payload = json.dumps(registros, ensure_ascii=False, separators=(',', ':'))
        marcador = '$base_' + hashlib.sha256(payload.encode()).hexdigest()[:20] + '$'
        if marcador in payload:
            raise ValueError('Delimitador SQL inesperado no conteúdo')
        linhas.append(f'insert into public.{tabela}({colunas}) select {colunas} from jsonb_to_recordset({marcador}{payload}{marcador}::jsonb) as dados({tipos}) on conflict(id) do nothing;')
    linhas.append('do $validar_importacao$ begin')
    for tabela, registros in convertida['tabelas'].items():
        if registros:
            ids = sql_ids([r['id'] for r in registros])
            linhas.append(f"if (select count(*) from public.{tabela} where id = any({ids})) <> {len(registros)} then raise exception 'Importação incompleta: {tabela}'; end if;")
    linhas.extend(['end $validar_importacao$;', 'commit;'])
    return '\n'.join(linhas)+'\n'

def gerar_reversao(convertida):
    linhas = ['-- Não executado automaticamente. Remove apenas os registros NOVOS desta importação.', '-- Se algum item estiver sendo usado por um cadastro posterior, as FKs interrompem a reversão.', 'begin;']
    for tabela in ['regras_mao_obra', 'estruturas', 'materiais', 'mao_obra']:
        ids = [r['id'] for r in convertida['novos'][tabela]]
        if ids:
            linhas.append(f'delete from public.{tabela} where id = any({sql_ids(ids)});')
    linhas.append('commit;')
    return '\n'.join(linhas)+'\n'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--entrada', default='base-exemplo/base-medicao.json')
    parser.add_argument('--backup', default='base-exemplo/convertida/backup-antes-importacao.json')
    parser.add_argument('--saida', default='base-exemplo/convertida')
    parser.add_argument('--usuario-id', required=True)
    args = parser.parse_args()
    entrada, saida = Path(args.entrada), Path(args.saida)
    resultado = converter(json.loads(entrada.read_text()), json.loads(Path(args.backup).read_text()), args.usuario_id)
    resultado['relatorio']['sha256_origem'] = hashlib.sha256(entrada.read_bytes()).hexdigest()
    saida.mkdir(parents=True, exist_ok=True)
    for arquivo, valor in [('catalogos-supabase.json', resultado['tabelas']), ('mapa-ids.json', resultado['mapa_ids']), ('relatorio-conversao.json', resultado['relatorio'])]:
        (saida/arquivo).write_text(json.dumps(valor, ensure_ascii=False, indent=2)+'\n')
    (saida/'importar.sql').write_text(gerar_sql(resultado))
    (saida/'reverter-importacao.sql').write_text(gerar_reversao(resultado))
    print(json.dumps({'convertidos': resultado['relatorio']['convertidos'], 'novos': resultado['relatorio']['novos'], 'codigos_unificados': len(resultado['relatorio']['codigos_unificados']), 'avisos': resultado['relatorio']['avisos'], 'tipos_cabo': resultado['relatorio']['tipos_cabo_preservados'], 'saida': str(saida)}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
