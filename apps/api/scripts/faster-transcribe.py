#!/usr/bin/env python3
"""
faster-whisper transcription CLI.

Usage:
    python3 faster-transcribe.py <input_audio> <model_size> [language]

Model size: tiny, base, small, medium, large-v3 (default: base)
Language: ISO 639-1 code (e.g., 'pt' for Portuguese). Auto-detect if omitted.

Output: Transcribed text to stdout.
Exit code: 0 on success, 1 on error (error message to stderr).
"""

import sys
import os
from faster_whisper import WhisperModel


def main():
    if len(sys.argv) < 2:
        print("Usage: faster-transcribe.py <input_audio> [model_size] [language]", file=sys.stderr)
        sys.exit(1)

    audio_path = sys.argv[1]
    if not os.path.isfile(audio_path):
        print(f"ERROR: Audio file not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    model_size = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("LOCAL_WHISPER_MODEL", "base")
    language = sys.argv[3] if len(sys.argv) > 3 else None

    # Set num_workers for CPU inference — 4 cores is a safe default
    cpu_threads = int(os.environ.get("LOCAL_WHISPER_THREADS", "4"))

    try:
        model = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
            cpu_threads=cpu_threads,
            num_workers=1,
        )
    except Exception as e:
        print(f"ERROR: Failed to load model '{model_size}': {e}", file=sys.stderr)
        sys.exit(1)

    try:
        segments, info = model.transcribe(
            audio_path,
            beam_size=5,
            language=language,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
        )

        texts = []
        for segment in segments:
            texts.append(segment.text.strip())

        result = " ".join(texts)
        print(result)

        if not result.strip():
            print("WARNING: Transcription produced empty output", file=sys.stderr)
            sys.exit(0)

    except Exception as e:
        print(f"ERROR: Transcription failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
