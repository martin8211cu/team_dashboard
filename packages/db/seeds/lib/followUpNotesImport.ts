import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Knex } from "knex";

const NOTES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../evaluacion-rh/notas",
);

/** Filename nickname → roster full name */
export const FOLLOW_UP_NICKNAME_TO_NAME: Record<string, string> = {
  Diana: "Diana Hernández de León",
  Edgardo: "Edgardo Balderas Morales",
  Gio: "Eduardo Sanchez Lopez",
  Gustavo: "Gustavo Herrera Alonso",
  Lalo: "Eduardo Moreno Lopez",
  Ricardo: "Juan Gallegos Cardona",
  Toni: "Francisco Antonio Garcia Quintana",
};

type OverallStatus = "excelente" | "bien" | "neutral" | "preocupado" | "riesgo";

const QUESTION_MATCHERS: Array<{
  key: string;
  sectionKey: string;
  patterns: RegExp[];
}> = [
  {
    key: "bienestar_sentimiento",
    sectionKey: "bienestar",
    patterns: [/c[oó]mo te has sentido este mes/i],
  },
  {
    key: "bienestar_frustracion",
    sectionKey: "bienestar",
    patterns: [/frustrando o bloqueando/i],
  },
  {
    key: "bienestar_carga",
    sectionKey: "bienestar",
    patterns: [/carga de trabajo/i],
  },
  {
    key: "bienestar_dinamica",
    sectionKey: "bienestar",
    patterns: [/din[aá]mica del equipo/i],
  },
  {
    key: "logros_orgullo",
    sectionKey: "logros",
    patterns: [/m[aá]s orgulloso este mes/i],
  },
  {
    key: "logros_impacto",
    sectionKey: "logros",
    patterns: [/mayor impacto/i],
  },
  {
    key: "logros_aprendizaje",
    sectionKey: "logros",
    patterns: [/aprendiste recientemente/i],
  },
  {
    key: "desempeno_bien",
    sectionKey: "desempeno",
    patterns: [/hiciste bien/i],
  },
  {
    key: "desempeno_mejorar",
    sectionKey: "desempeno",
    patterns: [/podr[ií]as mejorar/i],
  },
  {
    key: "desempeno_habilidad",
    sectionKey: "desempeno",
    patterns: [/habilidad t[eé]cnica o blanda/i],
  },
  {
    key: "desempeno_apoyo_tl",
    sectionKey: "desempeno",
    patterns: [/apoyar mejor como l[ií]der/i],
  },
  {
    key: "desarrollo_tecnologia",
    sectionKey: "desarrollo",
    patterns: [/tecnolog[ií]a te gustar[ií]a aprender/i],
  },
  {
    key: "desarrollo_carrera",
    sectionKey: "desarrollo",
    patterns: [/Senior,\s*Lead,\s*Arquitecto/i],
  },
  {
    key: "desarrollo_cursos",
    sectionKey: "desarrollo",
    patterns: [/cursos o certificaciones/i],
  },
  {
    key: "acciones_objetivos",
    sectionKey: "acciones",
    patterns: [/objetivos para el pr[oó]ximo mes/i],
  },
  {
    key: "acciones_apoyos",
    sectionKey: "acciones",
    patterns: [/^apoyos requeridos/i, /•\s*Apoyos requeridos/i],
  },
  {
    key: "acciones_fecha",
    sectionKey: "acciones",
    patterns: [/fecha de seguimiento/i],
  },
];

function parseFilename(name: string): { period: string; nick: string } | null {
  const match = /^(\d{4})-(\d{2})-(.+)\.md$/i.exec(name);
  if (!match) {
    return null;
  }
  return { period: `${match[1]}-${match[2]}`, nick: match[3]! };
}

function parseOverallStatus(text: string): OverallStatus | null {
  const line = text.split(/\r?\n/).find((row) => /estado general/i.test(row));
  if (!line) {
    return null;
  }
  const marked = [
    { re: /excelente\s*x/i, value: "excelente" as const },
    { re: /bien\s*x/i, value: "bien" as const },
    { re: /neutral\s*x/i, value: "neutral" as const },
    { re: /preocupado\s*x/i, value: "preocupado" as const },
    { re: /riesgo\s*x/i, value: "riesgo" as const },
  ];
  for (const option of marked) {
    if (option.re.test(line)) {
      return option.value;
    }
  }
  return null;
}

function stripQuestionPrefix(raw: string, patterns: RegExp[]): string {
  let answer = raw.trim();
  for (const pattern of patterns) {
    answer = answer.replace(pattern, "").trim();
  }
  return answer.replace(/^[¿?:\-\t\s]+/, "").trim();
}

function parseAnswers(text: string): Array<{
  key: string;
  sectionKey: string;
  answerText: string;
}> {
  const lines = text.split(/\r?\n/);
  const answers: Array<{ key: string; sectionKey: string; answerText: string }> = [];

  for (const line of lines) {
    const cleaned = line.replace(/^[•\t\s]+/, "").trim();
    if (!cleaned) {
      continue;
    }
    for (const matcher of QUESTION_MATCHERS) {
      if (!matcher.patterns.some((pattern) => pattern.test(cleaned))) {
        continue;
      }
      let answerText = "";
      const qIndex = cleaned.indexOf("?");
      if (qIndex >= 0) {
        answerText = cleaned.slice(qIndex + 1).trim();
      } else {
        const parts = cleaned.split(/\t+/);
        answerText = parts.length > 1 ? parts.slice(1).join(" ").trim() : "";
        if (!answerText) {
          answerText = stripQuestionPrefix(cleaned, matcher.patterns);
        }
      }
      answerText = answerText.replace(/\t+/g, " ").trim();
      if (
        answerText.toLowerCase().startsWith("tl\t") ||
        /^retroalimentaci[oó]n del tl/i.test(answerText)
      ) {
        answerText = "";
      }
      answers.push({
        key: matcher.key,
        sectionKey: matcher.sectionKey,
        answerText,
      });
      break;
    }
  }

  const byKey = new Map(answers.map((a) => [a.key, a]));
  return [...byKey.values()];
}

function parseActionAgreements(
  answers: Array<{ key: string; answerText: string }>,
): string[] {
  const objectives = answers.find((a) => a.key === "acciones_objetivos")?.answerText?.trim();
  const supports = answers.find((a) => a.key === "acciones_apoyos")?.answerText?.trim();
  const items: string[] = [];
  if (objectives) {
    items.push(objectives);
  }
  if (supports) {
    items.push(`Support needed: ${supports}`);
  }
  return items;
}

function scoresFromOverall(status: OverallStatus): number {
  switch (status) {
    case "excelente":
      return 5;
    case "bien":
      return 4;
    case "neutral":
      return 3;
    case "preocupado":
      return 2;
    case "riesgo":
      return 1;
  }
}

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/\s+/)
    .filter(Boolean);
}

function namesCompatible(a: string, b: string): boolean {
  const aTokens = nameTokens(a);
  const bTokens = nameTokens(b);
  const [shorter, longer] =
    aTokens.length <= bTokens.length ? [aTokens, bTokens] : [bTokens, aTokens];
  if (shorter.length === 0) {
    return false;
  }
  if (shorter[0] !== longer[0]) {
    return false;
  }
  return shorter.every((token) => longer.includes(token));
}

async function ensureMember(
  knex: Knex,
  fullName: string,
): Promise<{ id: number; name: string; created: boolean }> {
  const members = await knex("team_members").select<{ id: number; name: string }[]>("id", "name");
  const exact = members.find((m) => m.name.toLowerCase() === fullName.toLowerCase());
  if (exact) {
    return { id: exact.id, name: exact.name, created: false };
  }

  const compatible = members.filter((m) => namesCompatible(m.name, fullName));
  if (compatible.length >= 1) {
    compatible.sort((a, b) => b.name.length - a.name.length);
    return { id: compatible[0]!.id, name: compatible[0]!.name, created: false };
  }

  const [inserted] = await knex("team_members")
    .insert({
      name: fullName,
      email: null,
      active: true,
    })
    .returning<{ id: number; name: string }[]>(["id", "name"]);
  return { id: inserted!.id, name: inserted!.name, created: true };
}

export async function seedFollowUpNotesFromEvaluacionRh(knex: Knex): Promise<void> {
  try {
    await access(NOTES_DIR);
  } catch {
    console.warn(`Follow Up notes dir not found (${NOTES_DIR}); skipping seed`);
    return;
  }

  const files = (await readdir(NOTES_DIR)).filter((name) => name.endsWith(".md")).sort();
  if (files.length === 0) {
    console.warn(`No Follow Up notes in ${NOTES_DIR}; skipping seed`);
    return;
  }

  const adminEmail = process.env.AUTH_ADMIN_EMAIL?.trim().toLowerCase();
  const admin = adminEmail
    ? await knex("team_members").where({ email: adminEmail }).first<{ id: number }>()
    : await knex("team_members").orderBy("id").first<{ id: number }>();
  if (!admin) {
    console.warn("No creator member found for Follow Up seed; skipping");
    return;
  }

  let imported = 0;
  let skipped = 0;
  let membersCreated = 0;

  for (const file of files) {
    const parsed = parseFilename(file);
    if (!parsed) {
      skipped += 1;
      continue;
    }

    const fullName = FOLLOW_UP_NICKNAME_TO_NAME[parsed.nick];
    if (!fullName) {
      console.warn(`Skip unmapped nickname "${parsed.nick}" in ${file}`);
      skipped += 1;
      continue;
    }

    const text = await readFile(path.join(NOTES_DIR, file), "utf8");
    const overallStatus = parseOverallStatus(text);
    const answers = parseAnswers(text);
    const agreements = parseActionAgreements(answers);
    const member = await ensureMember(knex, fullName);
    if (member.created) {
      membersCreated += 1;
      console.log(`+ member ${member.name}`);
    }

    const existing = await knex("follow_up_sessions")
      .where({ member_id: member.id, period: parsed.period })
      .first<{ id: number }>();

    let sessionId: number;
    if (existing) {
      sessionId = existing.id;
      await knex("follow_up_sessions")
        .where({ id: sessionId })
        .update({
          overall_status: overallStatus,
          status: "completed",
          completed_at: knex.fn.now(),
          updated_at: knex.fn.now(),
          tl_feedback: "",
          closing_answer: "",
        });
      await knex("follow_up_answers").where({ session_id: sessionId }).del();
      await knex("follow_up_agreements").where({ session_id: sessionId }).del();
    } else {
      const [inserted] = await knex("follow_up_sessions")
        .insert({
          member_id: member.id,
          period: parsed.period,
          status: "completed",
          overall_status: overallStatus,
          created_by: admin.id,
          completed_at: knex.fn.now(),
          tl_feedback: "",
          closing_answer: "",
        })
        .returning<{ id: number }[]>("id");
      sessionId = inserted!.id;
    }

    if (answers.length > 0) {
      await knex("follow_up_answers").insert(
        answers.map((answer) => ({
          session_id: sessionId,
          section_key: answer.sectionKey,
          question_key: answer.key,
          answer_text: answer.answerText,
        })),
      );
    }

    if (agreements.length > 0) {
      await knex("follow_up_agreements").insert(
        agreements.map((description, index) => ({
          session_id: sessionId,
          description,
          status: "open",
          notes: "Seeded from evaluacion-rh notes",
          sort_order: index,
        })),
      );
    }

    if (overallStatus) {
      const score = scoresFromOverall(overallStatus);
      const evalPayload = {
        session_id: sessionId,
        calidad_tecnica: score,
        cumplimiento: score,
        comunicacion: score,
        colaboracion: score,
        autonomia: score,
        proactividad: score,
        aprendizaje: score,
        tendencia: "stable" as const,
        observaciones:
          "Seeded from evaluacion-rh notes. Scores seeded from overall status — adjust as needed.",
      };
      const hasEval = await knex("follow_up_evaluations").where({ session_id: sessionId }).first();
      if (hasEval) {
        await knex("follow_up_evaluations").where({ session_id: sessionId }).update({
          ...evalPayload,
          updated_at: knex.fn.now(),
        });
      } else {
        await knex("follow_up_evaluations").insert(evalPayload);
      }
    }

    imported += 1;
  }

  console.log(
    `Follow Up notes seed: imported=${imported} skipped=${skipped} membersCreated=${membersCreated}`,
  );
}
