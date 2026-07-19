// Diff unificado linha-a-linha reutilizável: a resposta HTTP compara execuções
// consecutivas (features/response) e a aba de git compara versões de arquivo /
// commits (features/git). O algoritmo LCS e o render moram aqui para não
// duplicar entre as duas telas.

// Uma linha do diff unificado: contexto (igual), adicionada ou removida.
export type DiffLine = { type: "ctx" | "add" | "del"; text: string };

// Diff linha a linha clássico via LCS (subsequência comum mais longa).
// `a` é a versão antiga (baseline) e `b` a atual; linhas só em `a` viram
// "del", só em `b` viram "add" e as comuns viram "ctx".
export const diffLines = (a: string[], b: string[]): DiffLine[] => {
  const n = a.length;
  const m = b.length;

  // Matriz de comprimentos da LCS: lcs[i][j] = LCS de a[i:] e b[j:].
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  // Reconstrói a sequência de operações percorrendo a matriz.
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "ctx", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: "del", text: a[i] });
      i++;
    } else {
      out.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: a[i++] });
  while (j < m) out.push({ type: "add", text: b[j++] });
  return out;
};

// Computa o diff entre dois blocos de texto (split por linha). Devolve lista
// vazia quando os textos são idênticos.
export function computeDiff(oldText: string, newText: string): DiffLine[] {
  if (oldText === newText) return [];
  return diffLines(oldText.split("\n"), newText.split("\n"));
}

// Converte um patch unificado do GitHub (o campo `patch` de PullRequestFile) em
// DiffLine[] para o mesmo render. O patch já vem pronto (com hunks @@); só
// classificamos cada linha pelo prefixo, sem recomputar LCS. Linhas de hunk
// (@@) e o marcador "\ No newline" entram como contexto.
export function parsePatch(patch: string): DiffLine[] {
  if (!patch) return [];
  return patch.split("\n").map((raw): DiffLine => {
    const marker = raw[0];
    if (marker === "+") return { type: "add", text: raw.slice(1) };
    if (marker === "-") return { type: "del", text: raw.slice(1) };
    if (marker === " ") return { type: "ctx", text: raw.slice(1) };
    // Cabeçalho de hunk (@@ … @@), "\ No newline…" ou linha vazia: contexto cru.
    return { type: "ctx", text: raw };
  });
}

interface UnifiedDiffProps {
  lines: DiffLine[];
  // Mensagem exibida quando não há diferenças (textos idênticos).
  emptyLabel?: string;
}

// Render do diff unificado: cada linha ganha prefixo (+/-/espaço) e cor
// semântica (add → success, del → destructive, ctx → neutro).
export function UnifiedDiff({ lines, emptyLabel = "Sem diferenças." }: UnifiedDiffProps) {
  if (lines.length === 0) {
    return <div className="text-muted-foreground italic">{emptyLabel}</div>;
  }

  return (
    <pre className="whitespace-pre-wrap break-words">
      {lines.map((line, idx) => {
        // Linha adicionada → success; removida → destructive; contexto → neutro
        const cls =
          line.type === "add"
            ? "bg-success/15 border-l-2 border-success text-success"
            : line.type === "del"
              ? "bg-destructive/10 border-l-2 border-destructive text-destructive"
              : "border-l-2 border-transparent text-muted-foreground";
        const prefix = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";
        return (
          <div key={`diff-${idx}`} className={`${cls} pl-2 pr-1`}>
            <span className="select-none text-muted-foreground mr-2">{prefix}</span>
            {line.text}
          </div>
        );
      })}
    </pre>
  );
}
