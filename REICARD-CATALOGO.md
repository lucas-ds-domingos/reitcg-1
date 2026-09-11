# Catálogo de cartas do ReiCard

## O que foi corrigido

- Todas as expansões são carregadas pelo endpoint `/api/catalog/sets` do próprio ReiCard.
- Cada álbum usa `/api/catalog/set?id=...`, com tentativas em outros idiomas quando a edição não existe no catálogo inglês.
- A última lista válida de álbuns e cartas fica armazenada no navegador para resistir a falhas temporárias do catálogo externo.
- As cartas são ordenadas numericamente e usam o total oficial correto no número de colecionador, por exemplo `002/064`.
- O link da Liga Pokémon inclui o código da edição (`ed`), o número local (`num`) e o número completo. Quando o catálogo não fornece um código de edição compatível, o botão abre uma pesquisa completa e não força uma página possivelmente errada.
- Imagens tentam, nesta ordem: versão leve, versão em alta resolução e arquivo equivalente em outro idioma.
- O valor médio usa a média das variantes disponíveis do TCGplayer. Se não houver, tenta Cardmarket. Falha de consulta e carta sem cotação são exibidas como situações diferentes.

## Auditoria completa

Execute:

```bash
npm run catalog:audit
```

O comando percorre todos os álbuns do TCGdex e cria `CATALOG-AUDIT.json` com divergências de quantidade, imagens ausentes na fonte e edições sem código para link direto da Liga.

## Publicação no Railway

Configure `DATABASE_URL` com a conexão do Neon e use os comandos padrão:

```bash
npm install
npm run build
npm start
```

O Railway define `PORT` automaticamente e o Next.js utiliza essa variável.

## Observação sobre preços

Nem toda carta possui anúncio ativo no TCGplayer ou Cardmarket. Nesses casos, o ReiCard informa “Sem cotação” em vez de inventar um valor. A Liga Pokémon não oferece uma API pública documentada para o ReiCard importar seus preços; por isso ela é usada como consulta externa de conferência.
