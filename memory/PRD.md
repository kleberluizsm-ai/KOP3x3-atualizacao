# KINGS OF PAINTBALL — KOP 3x3 (PRD)

## Original Problem Statement
Aplicativo web/mobile responsivo para organização de campeonato de paintball 3v3
com forte estética arcade fighting game (KOF). Nomes reais dos jogadores + fotos,
NÃO transformar em personagens. Nomes de equipes vindos do universo KOF.

## Architecture
- Backend: FastAPI + MongoDB (Motor). JWT auth (HS256, PyJWT). bcrypt.
- Frontend: React 19 + Tailwind + shadcn primitives, react-router-dom v7, sonner toasts.
- Photos: base64 stored in MongoDB (compressed client-side to 800px JPEG @ .82).
- Sound: shared Web Audio library (no assets), global mute + volume in localStorage.
- All routes /api-prefixed. Auth via Bearer token in localStorage.

## Personas
- **Jogador** (público): inscreve-se, vê equipe, tabela, resultados, classificação, stats.
- **Organizador/Admin** (autenticado, nevernub@gmail.com): CRUD jogadores, renomeia
  equipes, sorteia, controla o timer da partida, registra eliminações individuais,
  bloqueia partidas, define MVP, reseta.

## Core Rules (v2 — Feb 2026)
- 10 equipes × 3 jogadores. Grupos A/B com 5 cada.
- Round-robin em cada grupo: 20 partidas totais.
- **Pontuação = número de eliminações realizadas.** Sem bônus de vitória.
- Empate permitido na fase de grupos (0-0, 1-1, 2-2). Playoff resolvido via `set-winner`.
- Top-2 de cada grupo avança. Semi 1: A1×B2, Semi 2: B1×A2. Final + Disputa 3º.
- **PERFECT**: vencedor com 3 eliminações E 0 jogadores perdidos.
- **Cronômetro oficial**: 5 min padrão (configurável por partida, mín. 5s).

## Implemented
### v1 (First Finish)
- Auth JWT admin seed idempotente.
- Registro público de jogadores com upload de foto.
- CRUD admin de jogadores + renomear equipe + grupos.
- Sorteio NORMAL/BALANCED com anti-consecutivos, gera 20 confrontos.
- Auto-criação de semifinais, final e 3º lugar.
- Podium campeão + MVP manual.
- Tela VS cinematográfica e Modo Telão com auto-refresh.
- Bloqueio de partida; Reset completo do torneio.

### v1.5 — Tela de abertura arcade (`/register`)
- Splash cinematográfico com PRESS START, partículas, scanlines, brackets.
- Web Audio confirmação + transição READY? + formulário.

### v2 — Motor de partida (atual)
- **Eliminações individuais**: `POST /matches/{id}/eliminate {eliminated_id, eliminator_id}`
  com validação (auto-elim, friendly-fire, vítima repetida, killer-morto).
- **Pontuação = eliminações**; empates auto-detectados; PERFECT auto.
- **Cronômetro oficial**: `POST /matches/{id}/start | pause | resume | end`,
  cálculo de elapsed_ms/remaining_ms server-side, `pause_accumulated_ms`.
- **Auto-fim**: quando timer chega a 0 (via GET) ou quando os 3 da equipe são wipeados.
- **Undo**: `DELETE /matches/{id}/eliminate/last`.
- **Playoff draw resolution**: `POST /matches/{id}/set-winner`.
- **Standings** com colunas V/E/D + saldo + Pts=eliminações.
- **Stats individuais** exatas: derivadas do log de eliminações (killer++/victim++).
- **Live scoreboard** no MatchDetail e /live com placar por elims em tempo real.
- **Overlays no telão**: ELIMINATED! por X, FIGHT!, WINNER, DRAW, PERFECT.
- **Countdown 3-2-1** ao iniciar + avisos 60s/30s/10..1.
- **Biblioteca de som** em `/app/frontend/src/sound.js`:
  navigate, select, confirm, back, save, success, error, reveal, teamReady,
  vs, countdown, fight, elim, timeWarn, timeUp, winner, draw, perfect, champion.
- Toggle global de som no header (Layout).
- Overlay PERFECT full-screen no MatchDetail com fotos dos 3 sobreviventes.

## Test Results (v2)
- Testing agent iteration 2: **22/22 backend checks PASS** (`/app/test_reports/iteration_2.json`).
- Cobertura: reset, registro, sorteio, timer, pause/resume, expiração automática,
  validações de eliminação, 3-0 perfect, 3-1 não-perfect, empates 0-0/1-1/2-2,
  undo, lock, standings, auto-advance de playoffs, set-winner, stats individuais/equipe,
  enforcement de auth em todos os endpoints admin.

## Backlog (P1)
- Impressão/export PDF dos relatórios.
- Volume slider por categoria (Interface / Partidas / Sorteio / Telão).
- Modularizar server.py (>900 linhas).
- Endpoint opcional para purgar jogadores no reset.

## Backlog (P2)
- Perfil individual do jogador com histórico completo de eliminações.
- Modo réplica: replay da partida a partir do log de eliminações.
- QR code de compartilhamento do link de inscrição.
