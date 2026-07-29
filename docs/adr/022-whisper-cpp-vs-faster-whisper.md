# ADR-022: Provider STT Local — whisper.cpp vs faster-whisper

**Data:** 2026-07-28
**Status:** Aceito

## Contexto

O Nexo precisa de um provider STT (Speech-to-Text) local como primário na fallback chain, com fallback para Cloudflare Workers AI e Groq. O spec original da NEX-89 especificava `faster-whisper` (biblioteca Python) como engine local.

Durante a implementação, identificamos que o Dockerfile já compilava e pré-cacheava o `whisper.cpp` (versão C++ do Whisper), mas o modelo nunca era encontrado em runtime.

## Decisão

Optamos por **whisper.cpp (C++)** ao invés de **faster-whisper (Python)** como provider local.

## Justificativa

| Critério | whisper.cpp (C++) | faster-whisper (Python) |
|---|---|---|
| Tamanho na imagem | ~20MB (binário compilado) | ~300MB+ (Python + CTranslate2 + deps) |
| Complexidade de build | Já compilado no Dockerfile | Precisaria instalar Python + pip |
| Dependências | Nenhuma além do binário | CTranslate2, NumPy, etc. |
| Performance em CPU | Otimizado para CPU (int8) | Similar, mas mais pesado |
| Manutenção | Binário único, sem runtime | Requer Python na imagem Alpine |

## Consequências

- O provider local (`providers/local.ts`) detecta automaticamente o binário `whisper-cpp` e o utiliza
- O modelo `ggml-base.bin` (~150MB) é pré-cacheado no Dockerfile via stage `model-downloader`
- A imagem de produção continua Alpine (sem Python), mais leve e segura
- Caso no futuro queiramos trocar para faster-whisper, o provider já suporta ambos — é só instalar Python e a lib
