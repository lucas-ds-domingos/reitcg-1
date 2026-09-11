# ReiCard — Railway + Neon

Pacote completo do ReiCard preparado para publicação no Railway usando PostgreSQL do Neon.

## Recursos incluídos

- Login próprio por e-mail e senha, sem ChatGPT.
- Cadastro com ciência dos Termos de Uso, Política de Privacidade e LGPD.
- Proteção especial e autorização do responsável para menores.
- Catálogo de álbuns físicos Pokémon.
- Imagens, numeração oficial e valores médios das cartas.
- Scanner pela câmera com confirmação da edição.
- Quantidade, cartas repetidas e cartas faltantes.
- Amigos e listas compartilhadas dentro do ReiCard.
- Compartilhamento de repetidas, faltantes ou ambas pelo WhatsApp.
- Exclusão da conta e dos dados vinculados.

## 1. Configurar o Neon

Crie um banco PostgreSQL no Neon e copie a **connection string pooled**. No computador:

```bash
copy .env.example .env
```

Preencha `DATABASE_URL` no arquivo `.env` e execute:

```bash
npm install
npm run db:migrate
```

As migrations ficam em `drizzle-neon/`. Não execute as migrations da pasta `drizzle/`, pois elas pertencem somente à antiga demonstração com D1.

## 2. Testar localmente

```bash
npm run dev
```

Acesse `http://localhost:3000`.

## 3. Publicar no GitHub

Envie todos os arquivos deste pacote, exceto `.env` e `node_modules`. O `.gitignore` já protege esses itens.

## 4. Configurar o Railway

1. Crie um projeto no Railway e conecte o repositório GitHub.
2. Em **Variables**, adicione `DATABASE_URL` com a connection string pooled do Neon.
3. Defina `NODE_ENV=production`.
4. Build command: `npm run build`.
5. Start command: `npm start`.
6. Gere o domínio público do serviço.

O Railway fornece a variável `PORT` automaticamente e o Next.js a utiliza no início da aplicação.

## Comandos do banco

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
npm run db:check
```

Nunca envie o arquivo `.env`, a senha do Neon ou qualquer credencial para o GitHub.
