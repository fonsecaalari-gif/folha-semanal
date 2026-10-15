# Folha Semanal

Planner semanal em folhas pautadas. Funciona no navegador do celular, do Mac e do PC,
instala como app e sincroniza tudo pela sua conta.

## Como está montado

| Parte | O que faz | Custo |
|---|---|---|
| `index.html` | O app inteiro | — |
| `config.js` | Endereço e chave pública do seu banco (Supabase) | — |
| `sw.js`, `manifest.webmanifest`, ícones | Instalação como app e abertura sem internet | — |
| Supabase | Contas, banco de dados, anexos e sincronização em tempo real | Grátis |
| GitHub Pages | Hospeda o site com HTTPS | Grátis |

## Configuração (uma vez)

### 1. Supabase
1. Crie uma conta em https://supabase.com (dá para entrar com o GitHub).
2. **New project** → nome `folha-semanal`, região **South America (São Paulo)**, crie uma senha do banco e guarde.
3. **SQL Editor → New query** → cole o conteúdo de `supabase/setup.sql` → **Run**.
4. **Authentication → URL Configuration** → em **Site URL** coloque o endereço do app
   (ex.: `https://SEU-USUARIO.github.io/folha-semanal/`) e adicione o mesmo em **Redirect URLs**.
5. **Project Settings → API** → copie **Project URL** e a chave **anon public** para o `config.js`.

### 2. GitHub Pages
1. Crie o repositório `folha-semanal` e envie estes arquivos.
2. **Settings → Pages** → Source: **Deploy from a branch** → branch `main`, pasta `/ (root)` → Save.
3. Em 1 ou 2 minutos o app fica em `https://SEU-USUARIO.github.io/folha-semanal/`.

## Instalar
- **iPhone:** abra o endereço no Safari → Compartilhar → **Adicionar à Tela de Início**.
- **Android:** Chrome → menu ⋮ → **Instalar app**.
- **Mac ou PC:** Chrome ou Edge → ícone de instalar na barra de endereço (ou menu → **Instalar Folha Semanal**).
  No Mac com Safari: Arquivo → **Adicionar ao Dock**.

## Bom saber
- Cada pessoa só vê os próprios dados (regras de segurança no banco, em `setup.sql`).
- Sem internet, o app continua funcionando; as alterações são enviadas quando a conexão voltar.
- Anexos (imagens, documentos, áudios) até 50 MB cada. O plano grátis do Supabase dá 1 GB de arquivos.
- O plano grátis do Supabase pausa o projeto depois de 7 dias sem nenhum uso. Usando o app no dia a dia isso não acontece; se pausar, é só reativar no painel do Supabase.
- Lembretes tocam com o app aberto e viram notificação com o app em segundo plano (se você permitir).
  Notificação com o app totalmente fechado exige um envio pelo servidor (Web Push), que pode ser adicionado depois.
- Para trazer o que já estava escrito na versão anterior: lá, Ajustes → **Exportar backup**; aqui, Ajustes → **Restaurar backup**.
