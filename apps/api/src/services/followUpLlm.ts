import { GoogleGenerativeAI } from "@google/generative-ai";
import type { FollowUpAssistKind, FollowUpEvaluationScores } from "@team-dashboard/shared";
import { FOLLOW_UP_ALL_QUESTIONS, FOLLOW_UP_EVALUATION_DIMENSIONS } from "@team-dashboard/shared";

export class FollowUpLlmError extends Error {
  status: 400 | 502;

  constructor(message: string, status: 400 | 502 = 502) {
    super(message);
    this.name = "FollowUpLlmError";
    this.status = status;
  }
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new FollowUpLlmError("GEMINI_API_KEY is not configured", 502);
  }
  return key;
}

export function getGeminiModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
}

async function generateText(prompt: string): Promise<string> {
  try {
    const genAI = new GoogleGenerativeAI(getApiKey());
    const model = genAI.getGenerativeModel({ model: getGeminiModelName() });
    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim();
    if (!text) {
      throw new FollowUpLlmError("Gemini returned an empty response", 502);
    }
    return text;
  } catch (err) {
    if (err instanceof FollowUpLlmError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Gemini request failed";
    throw new FollowUpLlmError(message, 502);
  }
}

function formatQa(answers: Array<{ questionKey: string; answerText: string }>): string {
  const byKey = new Map(answers.map((a) => [a.questionKey, a.answerText]));
  return FOLLOW_UP_ALL_QUESTIONS.map((q) => {
    const answer = byKey.get(q.key)?.trim() || "(sin respuesta)";
    return `Q [${q.sectionKey}] ${q.label}\nA: ${answer}`;
  }).join("\n\n");
}

export async function assistFromAnswers(input: {
  kind: FollowUpAssistKind;
  memberName: string;
  period: string;
  overallStatus: string | null;
  answers: Array<{ questionKey: string; answerText: string }>;
  tlFeedback?: string;
}): Promise<string> {
  const qa = formatQa(input.answers);
  if (input.kind === "tl_feedback") {
    const prompt = `You are the Tech Lead writing feedback after a monthly 1:1.
Team member: ${input.memberName}
Period: ${input.period}
Overall status: ${input.overallStatus ?? "undefined"}

Session answers:
${qa}

Write a short paragraph (or 3–5 bullets) in English covering:
- Observed strengths
- Improvement areas
- Concrete examples taken ONLY from the answers
- Expectations for next month

Rules: do not invent facts that are not in the answers; professional and supportive tone; no heading markdown; reply with the feedback text only.`;
    return generateText(prompt);
  }

  const prompt = `You are the Tech Lead writing notes for the informal monthly evaluation (1–5 scale).
Team member: ${input.memberName}
Period: ${input.period}
Overall status: ${input.overallStatus ?? "undefined"}
Current TL feedback (if any): ${input.tlFeedback?.trim() || "(empty)"}

Session answers:
${qa}

Write 2–4 sentences in English with concrete notes for the month (evidence, focus for next cycle).
Rules: do not invent facts; do not invent numeric scores; reply with the notes text only.`;
  return generateText(prompt);
}

function splitBilingualMarkdown(content: string): { contentMdEs: string; contentMdEn: string } {
  const trimmed = content.trim();
  const enHeader = trimmed.search(/^#\s+Monthly 1:1 Summary/im);
  if (enHeader > 0) {
    let es = trimmed.slice(0, enHeader).trim();
    es = es.replace(/\n---\s*$/, "").trim();
    const en = trimmed.slice(enHeader).trim();
    return { contentMdEs: es, contentMdEn: en };
  }
  return { contentMdEs: trimmed, contentMdEn: "" };
}

function parseLocalesJson(raw: string): { contentMdEs: string; contentMdEn: string } | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      contentMdEs?: unknown;
      contentMdEn?: unknown;
      es?: unknown;
      en?: unknown;
    };
    const contentMdEs =
      typeof parsed.contentMdEs === "string"
        ? parsed.contentMdEs
        : typeof parsed.es === "string"
          ? parsed.es
          : null;
    const contentMdEn =
      typeof parsed.contentMdEn === "string"
        ? parsed.contentMdEn
        : typeof parsed.en === "string"
          ? parsed.en
          : null;
    if (contentMdEs == null || contentMdEn == null) {
      return null;
    }
    return { contentMdEs: contentMdEs.trim(), contentMdEn: contentMdEn.trim() };
  } catch {
    return null;
  }
}

export async function generateMonthlyReportLocales(input: {
  period: string;
  teamLabel: string;
  techLead: string;
  sessions: Array<{
    memberName: string;
    overallStatus: string | null;
    meetingDate: string | null;
    tlFeedback: string;
    closingAnswer: string;
    answers: Array<{ questionKey: string; sectionKey: string; answerText: string }>;
    evaluation: {
      calidadTecnica: number;
      cumplimiento: number;
      comunicacion: number;
      colaboracion: number;
      autonomia: number;
      proactividad: number;
      aprendizaje: number;
      tendencia: string;
      observaciones: string;
      promedio: number;
    } | null;
    agreements: Array<{ description: string; status: string; notes: string }>;
  }>;
}): Promise<{ contentMdEs: string; contentMdEn: string }> {
  const completed = input.sessions.length;
  const payload = JSON.stringify(input.sessions, null, 2);

  const prompt = `Genera un resumen mensual de 1:1 para Business Manager y Competence Manager.

Metadatos:
- Equipo: ${input.teamLabel}
- Tech Lead: ${input.techLead}
- Periodo: ${input.period}
- 1:1 completadas: ${completed}

Datos de sesiones (JSON):
${payload}

Debes producir DOS versiones del mismo informe (mismo contenido, idiomas distintos).

Español (contentMdEs) con exactamente esta estructura Markdown:
# Resumen general de 1:1 mensuales — ${input.period}
**Equipo:** ...
**Tech Lead:** ...
**Periodo:** ...
**Audiencia:** Business Manager y Competence Manager
**Confidencialidad:** Uso interno

## Snapshot del mes
(tabla Indicador | Resultado con: 1:1 realizadas, colaboradores en riesgo/preocupado, promedio indicadores 1-5, acuerdos abiertos)
luego tabla Estado general por colaborador

## Clima y bienestar
## Logros destacados del mes
## Puntos de atención para BM y Competence Manager
## Apoyos solicitados a BM / Competence Manager
## Próximos pasos

Inglés (contentMdEn) con:
# Monthly 1:1 Summary — ${input.period}
## Month snapshot
## Morale and well-being
## Key accomplishments this month
## Watchpoints for BM and Competence Manager
## Support requested from BM / Competence Manager
## Next steps

Reglas:
- Sintetiza temas recurrentes sin listar tickets operativos en exceso
- No inventes colaboradores ni datos ausentes
- Si no hay riesgos, dilo explícitamente
- Responde SOLO un JSON válido (sin fences markdown) con esta forma exacta:
{"contentMdEs":"...markdown español...","contentMdEn":"...markdown inglés..."}
- Escapa correctamente saltos de línea dentro de los strings JSON`;

  const raw = await generateText(prompt);
  const parsed = parseLocalesJson(raw);
  if (parsed && parsed.contentMdEs && parsed.contentMdEn) {
    return parsed;
  }

  // Fallback: model returned concatenated bilingual markdown
  const split = splitBilingualMarkdown(raw);
  if (!split.contentMdEs.trim()) {
    throw new FollowUpLlmError("Gemini report missing Spanish content", 502);
  }
  if (!split.contentMdEn.trim()) {
    throw new FollowUpLlmError("Gemini report missing English content", 502);
  }
  return split;
}

const EVAL_HEADERS_ES: Record<(typeof FOLLOW_UP_EVALUATION_DIMENSIONS)[number]["key"], string> = {
  calidadTecnica: "Calidad técnica",
  cumplimiento: "Cumplimiento",
  comunicacion: "Comunicación",
  colaboracion: "Colaboración",
  autonomia: "Autonomía",
  proactividad: "Proactividad",
  aprendizaje: "Aprendizaje",
};

export type EvaluationTableInput = {
  memberName: string;
  scores: FollowUpEvaluationScores | null;
  tlPromedio: number | null;
  selfPromedio: number | null;
};

function cell(value: string | number | null | undefined): string {
  if (value == null || value === "") {
    return "—";
  }
  return String(value).replaceAll("|", "\\|");
}

function scoreCell(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function markdownTable(headers: string[], rows: string[][]): string {
  const head = `| ${headers.map(cell).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(cell).join(" | ")} |`).join("\n");
  return [head, sep, body].filter(Boolean).join("\n");
}

export function buildEvaluationTables(rows: EvaluationTableInput[]): {
  es: string;
  en: string;
} {
  const sorted = [...rows].sort((a, b) => a.memberName.localeCompare(b.memberName));
  const esHeaders = [
    "Colaborador",
    ...FOLLOW_UP_EVALUATION_DIMENSIONS.map((dim) => EVAL_HEADERS_ES[dim.key]),
    "Promedio TL",
    "Promedio autoevaluación",
  ];
  const enHeaders = [
    "Member",
    ...FOLLOW_UP_EVALUATION_DIMENSIONS.map((dim) => dim.label),
    "TL avg",
    "Self avg",
  ];

  const esRows = sorted.map((row) => [
    row.memberName,
    ...FOLLOW_UP_EVALUATION_DIMENSIONS.map((dim) => scoreCell(row.scores?.[dim.key] ?? null)),
    scoreCell(row.tlPromedio),
    scoreCell(row.selfPromedio),
  ]);
  const enRows = esRows;

  return {
    es: `## Evaluaciones\n\n${markdownTable(esHeaders, esRows)}`,
    en: `## Evaluations\n\n${markdownTable(enHeaders, enRows)}`,
  };
}
