# JapKnock

App de menu bar / system tray para a equipe Japura. A diretora clica na foto de alguém e o computador dessa pessoa "apita" (notificação nativa + som + ícone do tray piscando). Substitui a batida na parede.

## Como funciona

- **1 app único** pra todo mundo. Na primeira abertura, cada pessoa escolhe seu nome da lista.
- **Helena** vê uma grade com os 6 colegas. Clica numa foto → manda "knock".
- **Resto da equipe** fica em background no tray. Quando recebe um knock: notificação nativa do SO + som de sininho + ícone do tray piscando até clicar pra reconhecer.
- Transporte: **Supabase Realtime** (canal `wall-knock`) do projeto JAPHub. Funciona de qualquer rede com internet (escritório, home office).
- **Sem login.** Identidade é local — fica salva no `localStorage` do app.
- **Auto-start no boot** — ativado por padrão na primeira execução.

## Instalação

Builds prontas em `dist/`:

| Plataforma | Arquivo | Quem usa |
|---|---|---|
| Mac Apple Silicon (M1/M2/M3) | `JapKnock-1.0.0-arm64.dmg` | Helena (diretora) |
| Mac Intel | `JapKnock-1.0.0-x64.dmg` | Macs antigos |
| Windows (instalador) | `JapKnock-1.0.0-setup.exe` | Quem prefere instalar |
| Windows (portável) | `JapKnock-1.0.0-portable.exe` | Quem só quer rodar |

### macOS — workaround pra app não-assinado

1. Abre o `.dmg`, arrasta o **JapKnock.app** pra pasta **Applications**.
2. Na primeira execução, o macOS bloqueia ("aplicativo não verificado").
3. Vai em **Ajustes do Sistema → Privacidade e Segurança** e clica em **"Abrir Mesmo Assim"** ao lado da mensagem sobre JapKnock.
4. Confirma "Abrir" no próximo diálogo.
5. Pronto. O ícone aparece na barra de menu (canto superior direito).

### Windows

- Setup: roda `JapKnock-1.0.0-setup.exe` → Avançar → Instalar. Adiciona atalho na área de trabalho e configura auto-start.
- Portável: só executa `JapKnock-1.0.0-portable.exe` direto. Sem instalação.

O Windows pode mostrar um aviso do SmartScreen ("Editor desconhecido"). Clica em **"Mais informações" → "Executar assim mesmo"**.

## Equipe (lista hardcoded)

Pra alterar, edita `src/renderer/src/lib/team.ts` e rebuilda:

```ts
{ id: 'helena',   name: 'Helena',   role: 'sender',   ... }
{ id: 'marcos',   name: 'Marcos',   role: 'receiver', ... }
{ id: 'maira',    name: 'Maira',    role: 'receiver', ... }
{ id: 'silvio',   name: 'Silvio',   role: 'receiver', ... }
{ id: 'daniel',   name: 'Daniel',   role: 'receiver', ... }
{ id: 'vinicius', name: 'Vinicius', role: 'receiver', ... }
{ id: 'paulo',    name: 'Paulo',    role: 'receiver', ... }
```

`role: 'sender'` ganha a tela de chamar. `role: 'receiver'` recebe knocks.

## Desenvolvimento

```bash
npm install
npm run dev          # roda em modo dev com HMR
npm run typecheck    # checa tipos
npm run build        # compila (sem empacotar)
npm run build:mac    # gera .dmg pra arm64 + x64
npm run build:win    # gera .exe portable + setup NSIS
```

## Stack

- **Electron 39** + **electron-vite 5**
- **React 19** + **TypeScript** + **Tailwind 3**
- **@supabase/supabase-js** (apenas Realtime, sem auth, com anon key)
- **electron-builder** pra empacotar

## Arquitetura

```
src/
├── main/index.ts             # Tray, janela, IPC, notificações nativas, auto-start
├── preload/index.ts          # Bridge window.api → ipcRenderer
└── renderer/src/
    ├── App.tsx               # Roteia UserSelect → Sender ou Receiver
    ├── components/
    │   ├── UserSelect.tsx    # Tela "quem é você"
    │   ├── Sender.tsx        # Grade de chamar (Helena)
    │   ├── Receiver.tsx      # Tela de aguardar/receber (resto)
    │   └── Avatar.tsx        # Bolinha colorida com iniciais
    └── lib/
        ├── team.ts           # Lista da equipe + storage da identidade
        ├── supabase.ts       # Cliente + canal Realtime
        └── sound.ts          # Beeps via Web Audio API (sem mp3)
```

## Trocar de usuário

No app, canto superior direito da janela: botão **"Trocar"** limpa a identidade e volta pra tela de escolha.

## Customização rápida

- **Trocar foto por avatar real:** edita `Avatar.tsx` pra renderizar `<img>` em vez de iniciais.
- **Mudar canal Supabase:** `src/renderer/src/lib/supabase.ts` → constante `CHANNEL_NAME`.
- **Adicionar histórico:** criar tabela `wall_knocks(id, to_user, from_user, ack_at, created_at)` no Supabase e fazer `INSERT` em vez de (ou além de) broadcast.
