// Normalize document formatting without a vocabulary of technologies or project names.
const sectionNames =
  "(?:personal|selected|technical|featured|hackathon|academic|side) projects|projects(?: & (?:hackathons|work))?|work experience|professional experience|experience|education|technical skills|skills(?: & technologies)?|summary|profile|about|certifications|achievements|honors[^:\\n]*|community|publications|awards";
export const resumeHeading = new RegExp(`^(?:${sectionNames})\\s*:?$`, "i");
export const projectsHeading =
  /^(?:(?:personal|selected|technical|featured|hackathon|academic|side)\s+)?projects(?:\s*&\s*(?:hackathons|work))?\s*:?$/i;
export function resumeLines(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap((raw) => {
      const line = raw
        .trim()
        .replace(/^#{1,6}\s+/, "")
        .replace(/\*\*/g, "");
      const inline = new RegExp(`^(${sectionNames})\\s*:\\s*(.+)$`, "i").exec(
        line,
      );
      return inline ? [inline[1], inline[2].trim()] : line ? [line] : [];
    });
}
