import json, re, html, sys
base = sys.argv[1]
modelo = open(f'{base}/modelo.html').read()
css = open(f'{base}/base.css').read()
conv = {c['id']: c for c in json.load(open(f'{base}/conversas.json'))}

def bolhas(cid, ini):
    c = conv[cid]
    msgs = c['mensagens'][ini:]
    partes = ['<div class="zap">']
    for m in msgs:
        quem = 'Gabi' if m['dir'] == 'out' else 'Lead'
        partes.append(f'<div class="msg {m["dir"]}"><span class="quem">{quem}</span>{html.escape(m["text"])}</div>')
    partes.append('</div>')
    return ''.join(partes)

modelo = re.sub(r'\{\{CONV:([\w-]+):(\d+)\}\}', lambda m: bolhas(m.group(1), int(m.group(2))), modelo)

c = conv['rcv-marcada']
f = c['finalizado']; r = c['reuniao']
nota = (f"🤖 Gabi (IA) finalizou: {c['porta']} · {f['motivo']}\n\n{f['resumo']}\n\n" + '\n'.join(c['respostas']) +
        f"\n\nEtapa: Reunião agendada · Responsável: {next((e.split('Passaria o card para ')[1].rstrip('.') for e in c['eventos'] if e.startswith('Passaria o card para ')), '')} (dívida de R$ 32.200 (&lt; R$ 50.000) → rodízio Guilherme/Carla)"
        f"\nTarefa: Reunião marcada pela IA: {r['label']}."
        f"\nReunião: {r['label']} · link do Google Meet")
nota_html = f'<div class="kommo"><span class="t">Nota no card · Kommo</span>{nota}</div>'
resp = next((e.split('Passaria o card para ')[1].rstrip('.') for e in c['eventos'] if e.startswith('Passaria o card para ')), 'o responsável')
modelo = modelo.replace('{{RESP_RCV}}', f'<b>{resp}</b>' if resp in ('Guilherme', 'Carla') else resp)
modelo = modelo.replace('{{NOTA}}', nota_html).replace('{{CSS}}', css)
assert '{{' not in modelo, re.findall(r'\{\{[^}]+\}\}', modelo)
open(f'{base}/guia-completo.html', 'w').write(modelo)
print('ok', len(modelo))
