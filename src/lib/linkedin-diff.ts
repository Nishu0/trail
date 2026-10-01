export type WordChange = { kind: "same" | "added" | "removed"; text: string };
export function wordChanges(before: string, after: string): WordChange[] {
  const a = before.match(/\S+|\s+/g) || [],
    b = after.match(/\S+|\s+/g) || [];
  if (a.length * b.length > 1000000)
    return [
      { kind: "removed", text: before },
      { kind: "added", text: after },
    ].filter((piece) => piece.text) as WordChange[];
  const width = b.length + 1,
    dp = new Uint16Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i * width + j] =
        a[i] === b[j]
          ? 1 + dp[(i + 1) * width + j + 1]
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
  const result: WordChange[] = [];
  const add = (kind: WordChange["kind"], text: string) => {
    const last = result[result.length - 1];
    if (last?.kind === kind) last.text += text;
    else result.push({ kind, text });
  };
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      add("same", a[i++]);
      j++;
    } else if (
      j < b.length &&
      (i === a.length || dp[i * width + j + 1] >= dp[(i + 1) * width + j])
    )
      add("added", b[j++]);
    else add("removed", a[i++]);
  }
  return result;
}
