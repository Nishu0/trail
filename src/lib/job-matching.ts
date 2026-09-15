export function matchingTerms(text: string, terms: string[]) {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/reactjs/g, "react")
      .replace(/nextjs/g, "next.js");
  return terms.filter((term) => {
    if (term.toLowerCase() === "move")
      return /\bMove(?:VM)?\b(?!\s+(?:fast|forward|on|over|to|up|out)\b)/.test(
        text,
      );
    if (term.toLowerCase() === "go")
      return /\b(?:Go|[Gg]olang)\b(?!\s+(?:for|to|with|ahead|back|out|on)\b)/.test(
        text,
      );
    return new RegExp(
      `(^|[^a-z0-9])${normalize(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`,
      "i",
    ).test(normalize(text));
  });
}
