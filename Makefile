test:
	node test/smoke.mjs

voice:
	python3 tools/voice/build.py

.PHONY: test voice
