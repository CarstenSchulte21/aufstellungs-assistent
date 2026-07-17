// Klassifiziert eine kurze Freitext-Antwort eines Spielers via Claude API.
// Rückgabe: 'ja' (Zusage), 'nein' (Absage), 'unsicher', oder 'unklar'
// (nicht sicher erkannt -> Bot bittet um Button-Antwort).
//
// WICHTIG (CLAUDE.md-Prinzip): Das LLM interpretiert nur Freitext. Es schreibt
// NIE selbst in die Datenbank — der Spieler bestätigt anschließend per Button.

export type Klassifikation = "ja" | "nein" | "unsicher" | "unklar";

export async function classifyAntwort(text: string): Promise<Klassifikation> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "unklar"; // ohne Key: Fallback auf Button-Abfrage

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 5,
        system:
          "Du klassifizierst kurze deutsche Antworten eines Tischtennisspielers auf die Frage, ob er an einem Spieltag mitspielt. " +
          "Antworte NUR mit genau einem Wort: ja, nein oder unsicher. " +
          "ja = klare Zusage. nein = klare Absage. unsicher = weiß noch nicht / vielleicht / kommt drauf an.",
        messages: [{ role: "user", content: text }],
      }),
    });
    if (!res.ok) return "unklar";
    const data = await res.json();
    const out: string = (data?.content?.[0]?.text ?? "").toLowerCase();
    if (out.includes("nein")) return "nein";
    if (out.includes("unsicher")) return "unsicher";
    if (out.includes("ja")) return "ja";
    return "unklar";
  } catch {
    return "unklar";
  }
}
