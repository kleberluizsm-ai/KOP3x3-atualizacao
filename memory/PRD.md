# KINGS OF PAINTBALL — KOP 3x3 (PRD)

## Original Problem Statement
Aplicativo web/mobile responsivo para organização de campeonato de paintball 3v3
com forte estética arcade fighting game (KOF). Nomes reais dos jogadores + fotos.
Nomes de equipes do universo KOF.

## Architecture
- Backend: FastAPI + MongoDB (Motor), JWT (HS256, PyJWT), bcrypt.
- Frontend: React 19 + Tailwind + shadcn primitives, react-router-dom v7, sonner.
- Photos: base64 stored in MongoDB (client-side compressed 800px JPEG @ .82).
- Sound: shared Web Audio library (no assets), global mute + volume em localStorage.
- All routes /api-prefixed. Auth via Bearer token em localStorage.

## Personas
- **Jogador** (público): inscreve-se, vê equipe, tabela, resultados, stats.
- **Organizador/Admin** (nevernub@gmail.com): CRUD, sorteio, cronômetro,
  registro de eliminações, bloqueio, MVP, set-winner (playoffs), reset.

## Official Rules (v3 — Feb 2026)
- 10 equipes × 3 jogadores. Grupos A/B (5 cada). 20 partidas round-robin.
- **Vitória** só acontece quando os **3 adversários são eliminados** (wipe total).
- **Empate** quando o cronômetro chega a 00:00 e ainda há jogador vivo nos DOIS lados
  — independentemente da contagem de eliminações.
- **Pontuação**:
  - Vencedor = 3 (vitória) + 2 (bônus por eliminar os 3 adversários) = **5 pts**
  - Perdedor = 0 pts. Empate = 0 pts para ambos.
- **PERFECT**: vencedor com 3 eliminações + 0 perdidos (visual/stat, sem pts extras).
- Cronômetro oficial: 5 min padrão (mín. 5s), START/PAUSE/RESUME/END, auto-end.
- **Registro simplificado**: apenas `eliminated_id`. Killer não é rastreado.

## Implemented Versions
### v1 — MVP completo (inscrição, sorteio, grupos, playoffs, podium, telão).
### v1.5 — Tela arcade PRESS START pública em /register.
### v2 — Motor de partida (timer, eliminações individuais, empates, PERFECT overlay, biblioteca de som).
### v3 — Regras oficiais (atual)
- Vitória só por wipe total (compute_result Rule A).
- Empate por tempo com jogadores vivos (Rule B), independente de elim count.
- Pontuação 3+2=5 (vencedor) / 0 (perdedor/empate).
- Campo "eliminado por" removido da UI + backend.
- Stats individuais: matches, V/E/D, times_eliminated, perfects, survivals
  (ranking por team_wins → perfects → survivals → -times_eliminated).
- Migração idempotente de matches ENCERRADA no startup para reprocessar
  usando as novas regras.
- MatchDetail e Live com overlay ELIMINATED! (só vítima) e DRAW/WINNER/PERFECT.

## Test Coverage
- Iteration 1: 32/32 backend PASS.
- Iteration 2: 22/22 backend PASS (motor de partida v2).
- Iteration 3: **18/18 backend PASS** (regras oficiais v3).
- Arquivo autoritativo: `/app/backend/tests/test_tournament_v3.py`.

## Backlog (P1)
- Replay Cinemático (log de eliminações passo a passo pós-partida).
- Impressão/export PDF dos relatórios.
- QR code do link público no painel admin.
- Volume slider por categoria de som.
- Modularizar server.py (>1000 linhas).

## Backlog (P2)
- Perfil individual com histórico completo.
- Endpoint opcional para purgar jogadores no reset.
- Modo espectador em tempo real com atalhos de teclado.
