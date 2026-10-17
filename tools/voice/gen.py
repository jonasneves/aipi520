"""Generate takes of narration clips with ElevenLabs (voice Liam, model eleven_v4), with character timestamps.

  ELEVENLABS_API_KEY=... python3 tools/voice/gen.py <outdir> <id>[:takes] ...

Reads each clip's source from script.json, strips the {..} and | markers (delivery tags like [calm] are
sent and billed), writes <outdir>/<id>_<n>.mp3 and <id>_<n>.json, and prints the characters billed.
Pick a take, copy it to docs/teach/audio/<id>.mp3 and its json to align/<id>.align.json, then run build.py.
Check the account first: GET /v1/user/subscription (character_limit - character_count).
"""
import json, os, re, sys, base64, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
VOICE_ID, MODEL = 'TX3LPaxmHKxFdv7VOQHJ', 'eleven_v4'
S = json.load(open(os.path.join(HERE, 'script.json')))
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
key = os.environ['ELEVENLABS_API_KEY']
spent = 0
for arg in sys.argv[2:]:
    cid, _, n = arg.partition(':')
    text = re.sub(r'\{[^}]*\}|\|', '', S[cid]).strip()
    text = re.sub(r'\bw\b', 'W', text)  # a lone lowercase w is read as "we"; lower it back to w in the align text, which the caption is built from
    for k in range(1, int(n or 1) + 1):
        if os.path.exists(f'{out}/{cid}_{k}.mp3'): continue
        req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}/with-timestamps?output_format=mp3_44100_128',
                                     data=json.dumps({'text': text, 'model_id': MODEL}).encode(),
                                     headers={'xi-api-key': key, 'Content-Type': 'application/json'})
        d = json.load(urllib.request.urlopen(req, timeout=120))
        open(f'{out}/{cid}_{k}.mp3', 'wb').write(base64.b64decode(d['audio_base64']))
        json.dump({'text': text, 'alignment': d['alignment']}, open(f'{out}/{cid}_{k}.json', 'w'))
        spent += len(text); print(cid, k, len(text))
print('characters billed', spent)
