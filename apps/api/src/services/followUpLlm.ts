import { GoogleGenerativeAI } from "@google/generative-ai";
import type { FollowUpAssistKind } from "@team-dashboard/shared";
import { FOLLOW_UP_ALL_QUESTIONS } from "@team-dashboard/shared";

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

export async function generateMonthlyReportMarkdown(input: {
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
}): Promise<string> {
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

Debes producir UN solo documento Markdown con DOS bloques concatenados:

1) Español con exactamente esta estructura de secciones (títulos ##):
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

2) Separador ---
luego el mismo contenido en inglés con títulos:
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
- Responde SOLO el markdown final, sin preámbulo`;

  return generateText(prompt);
}
