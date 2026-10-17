"""Transcribe takes with OpenAI whisper-1 and measure loudness (EBU R128 integrated), to compare with neighbours.

  OPENAI_API_KEY=... python3 tools/voice/check.py <file.mp3> ...
"""
import json, os, re, subprocess, sys
for f in sys.argv[1:]:
    r = subprocess.run(['curl', '-s', 'https://api.openai.com/v1/audio/transcriptions', '-H', 'Authorization: Bearer ' + os.environ['OPENAI_API_KEY'],
                        '-F', 'model=whisper-1', '-F', f'file=@{f}'], capture_output=True, text=True)
    text = json.loads(r.stdout).get('text', '?')
    e = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    lufs = re.findall(r'I:\s+(-?[\d.]+) LUFS', e)
    print(f'{os.path.basename(f):14s} {lufs[-1] if lufs else "?":>6} LUFS | {text}')
