# Mapa de testes do frontend

A suíte usa Vitest Browser Mode com Chromium. Ela valida três camadas:

1. telas e fluxos reais de usuário;
2. estado e componentes funcionais do editor;
3. contrato completo entre os facades TypeScript e os bindings Wails.

## Telas e fluxos

| Domínio       | Funcionalidades cobertas                                             |
| ------------- | -------------------------------------------------------------------- |
| Welcome       | entrada do app, criação de workspace, clone e acessos rápidos        |
| Workspaces    | listagem, busca, filtro ativo, criação e edição visual               |
| Collections   | estado vazio, listagem, busca, criação e edição                      |
| Environments  | listagem, busca, filtro de obsoletos, criação com variáveis e edição |
| Requests      | validação/criação, seleção, envio, payload Wails e resposta HTTP     |
| Editor        | headers, query params, bearer, basic auth e API key                  |
| Response      | status, pretty/raw/tree, TypeScript, headers e timing                |
| Tests         | pré-condição sem requests, criação com passos/asserções e execução   |
| History       | registro, detalhes, remoção e limpeza confirmada                     |
| Settings      | tema, escala, animações e pasta do workspace                         |
| Profile       | conta GitHub e estado de sincronização                               |
| Git           | conexão e clone de repositório                                       |
| Pull requests | listagem, filtro, criação, comentário, review e merge                |

## Contratos Wails mapeados

`src/services/services.test.ts` chama e verifica o ID de binding de todas as
operações expostas pelos facades usados no frontend:

- collections: listar, criar, excluir, editar, buscar, exportar e importar;
- environments: listar, criar, excluir, editar, buscar e interpolar;
- folders: listar, buscar, criar, renomear, mover, excluir e ordenar;
- requests: listar, buscar, criar, editar, excluir, fixar, mover, duplicar e enviar;
- prediction: sugestões do editor;
- tests: listar, buscar, criar, editar, excluir e executar;
- workspaces: pasta raiz, listar, ativo, criar, editar, excluir e ativar;
- git/GitHub: autenticação, status, commit, push, pull, conflitos, remoto, clone,
  histórico, branches, checkout, diff e descarte;
- pull requests: lista, detalhe, arquivos, commits, reviews, comentários, criação,
  resposta, review inline e merge.

## Execução

```bash
cd frontend
bun run test
```

O gate completo do repositório, incluindo Go, tipos, lint e formato, é:

```bash
task check
```
