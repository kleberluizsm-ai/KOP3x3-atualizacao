# KINGS OF PAINTBALL — KOP 3x3 (PRD)

## Original Problem Statement
Aplicativo web/mobile responsivo para organização de campeonato de paintball 3v3
com forte estética arcade fighting game (KOF). Nomes reais dos jogadores + fotos,
NÃO transformar em personagens. Nomes de equipes vindos do universo KOF.

## Architecture
- Backend: FastAPI + MongoDB (Motor). JWT auth (HS256, PyJWT). bcrypt.
- Frontend: React 19 + Tailwind + shadcn primitives, react-router-dom v7, sonner toasts.
- Photos: base64 stored in MongoDB (compressed client-side to 800px JPEG @ .82).
- All routes /api-prefixed. Auth via Bearer token in localStorage.

## Personas
- **Jogador** (público): inscreve-se, vê equipe, tabela, resultados, classificação, stats.
- **Organizador/Admin** (autenticado, nevernub@gmail.com): CRUD jogadores, renomeia
  equipes, sorteia, registra resultados, bloqueia partidas, define MVP, reseta.

## Core Rules (imutáveis)
- 10 equipes × 3 jogadores. Grupos A/B com 5 cada.
- Round-robin em cada grupo: 20 partidas totais.
- Pontuação por partida: vitória 3pts + até 2pts bônus por eliminações (máx 5).
- Top-2 de cada grupo avança. Semi 1: A1×B2, Semi 2: B1×A2. Final + Disputa 3º.
- PERFECT quando vencedor não perde nenhum jogador.

## Implemented (First Finish, Feb 2026)
- Auth JWT admin seed idempotente.
- Registro público de jogadores com upload de foto e nível.
- CRUD admin de jogadores + renomear equipe + toggle grupo.
- Sorteio NORMAL/BALANCED com anti-consecutivos, gera 20 confrontos.
- Registro de resultado (vencedor, elims, jogadores eliminados) + PERFECT auto.
- Classificação por grupo com critérios de desempate.
- Auto-criação de semifinais, final e 3º lugar.
- Podium campeão + MVP manual.
- Stats individuais (eliminações rateadas entre sobreviventes) + stats de equipe (perfects, best_streak).
- Tela VS cinematográfica (`/versus/:mid`) e Modo Telão (`/live`) com auto-refresh 8s.
- Bloqueio de partida (locked=true → 400 ao editar).
- Reset completo do torneio.
- Testado pelo testing_agent: 32/32 checks OK.

## Backlog (P1)
- Impressão/export de relatórios (PDF/CSV).
- Sons arcade opcionais (SELECT, VS, WINNER, FIGHT).
- Definição manual de horário por partida.
- Reset de senha admin via email.
- Overlay de contagem regressiva no /live (3-2-1-FIGHT).

## Backlog (P2)
- Sorteio com animação frame-a-frame de embaralhamento.
- Editor manual de chave (drag/drop pós-sorteio).
- Perfil individual do jogador com histórico.
