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

## Atualizações automáticas (releases)

O app verifica updates contra **GitHub Releases** (`marcosviniciusbrasil12/japknock`) automaticamente:
- 5 segundos depois de abrir.
- A cada 4 horas enquanto roda.
- Manualmente via tray → **"Verificar atualizações"**.

Quando há nova versão:
1. Download em background, sem atrapalhar.
2. Quando termina, aparece uma notificação **"JapKnock vX.X.X atualizado — pronto pra reiniciar"**.
3. Aplica automaticamente na próxima vez que o app sair, OU pelo menu do tray **"Reiniciar e atualizar pra vX.X.X"**.

### ⚠️ macOS unsigned — fallback

Apps Mac unsigned (sem Apple Developer Certificate) **podem falhar** na verificação de assinatura na hora de aplicar o update silencioso. Quando isso acontece, em vez de quebrar, o app mostra uma notificação **"Atualização disponível — clique pra baixar"** que abre o navegador na página de releases (`https://github.com/marcosviniciusbrasil12/japknock/releases/latest`) e a pessoa baixa o novo `.dmg` manualmente (workaround documentado na seção de instalação).

### Publicando uma nova versão

Setup único:

1. Cria o repo `marcosviniciusbrasil12/japknock` no GitHub.
2. Gera um **Personal Access Token** com escopo `repo` em [github.com/settings/tokens](https://github.com/settings/tokens).
3. Exporta no seu shell:
   ```bash
   export GH_TOKEN=ghp_xxxxxxxxxx
   ```
   (ou adiciona no `~/.zshrc` pra ficar permanente).

A cada release:

```bash
# 1. Bump da versão no package.json
npm version patch    # ou minor, major

# 2. Build + upload pra GitHub Releases (Mac + Windows juntos)
npm run release

# 3. No GitHub: rascunho da release é criado. Edita as notas, publica.
```

Pronto — todas as instâncias instaladas vão pegar o update automaticamente na próxima vez que abrirem.

Variantes:
- `npm run release:mac` — só Mac (`.dmg` arm64+x64)
- `npm run release:win` — só Windows (`.exe` portable+setup)

## Customização rápida

- **Trocar foto por avatar real:** edita `Avatar.tsx` pra renderizar `<img>` em vez de iniciais.
- **Mudar canal Supabase:** `src/renderer/src/lib/supabase.ts` → constante `CHANNEL_NAME`.
- **Adicionar histórico:** criar tabela `wall_knocks(id, to_user, from_user, ack_at, created_at)` no Supabase e fazer `INSERT` em vez de (ou além de) broadcast.
