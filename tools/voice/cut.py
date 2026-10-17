"""Cut a narration clip in a pause, without re-encoding (each re-encode costs loudness), and cut its alignment to match.

  python3 tools/voice/cut.py <id> <seconds> <head_id> [<tail_id>]

Writes docs/teach/audio/<head_id>.mp3 (0..seconds) and, if given, <tail_id>.mp3 (seconds..end), plus
align/<head_id>.align.json and align/<tail_id>.align.json. The cut must fall in a pause: characters
are split by their start time. Then edit script.json so each part's text matches its align text.
"""
import json, os, subprocess, sys, shutil, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'docs/teach/audio')
cid, at, head = sys.argv[1], float(sys.argv[2]), sys.argv[3]
tail = sys.argv[4] if len(sys.argv) > 4 else None
al = json.load(open(os.path.join(HERE, 'align', cid + '.align.json')))
t, A = al['text'], al['alignment']
st, en = A['character_start_times_seconds'], A['character_end_times_seconds']
k = next(i for i, s in enumerate(st) if s >= at)
if '[' in t[:k] and t.rfind('[', 0, k) > t.rfind(']', 0, k): k = t.rfind('[', 0, k)  # a delivery tag goes whole to the tail
assert all(e <= at + 0.05 for e, c in zip(en[:k], t[:k]) if c.isalnum()), 'cut is not in a pause'
src = os.path.join(AUDIO, cid + '.mp3')
tmp = tempfile.mkdtemp()
ff = lambda *a: subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True)
ff('-i', src, '-t', str(at), '-c', 'copy', os.path.join(tmp, 'h.mp3'))
if tail: ff('-ss', str(at), '-i', src, '-c', 'copy', os.path.join(tmp, 't.mp3'))


def part(lo, hi, shift):
    txt = t[lo:hi]
    lead = len(txt) - len(txt.lstrip()); txt2 = txt.strip()
    a, b = lo + lead, lo + lead + len(txt2)
    sl = lambda arr: [round(max(0, x - shift), 3) for x in arr[a:b]]
    return {'text': txt2, 'alignment': {'characters': list(txt2), 'character_start_times_seconds': sl(st), 'character_end_times_seconds': sl(en)}}


json.dump(part(0, k, 0), open(os.path.join(HERE, 'align', head + '.align.json'), 'w'))
if tail: json.dump(part(k, len(t), at), open(os.path.join(HERE, 'align', tail + '.align.json'), 'w'))
shutil.move(os.path.join(tmp, 'h.mp3'), os.path.join(AUDIO, head + '.mp3'))
if tail: shutil.move(os.path.join(tmp, 't.mp3'), os.path.join(AUDIO, tail + '.mp3'))
print(head, repr(part(0, k, 0)['text']), '|', tail, tail and repr(part(k, len(t), at)['text']))
