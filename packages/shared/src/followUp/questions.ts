import type { FollowUpOverallStatus, FollowUpSectionKey, FollowUpTendencia } from "../types/followUp";

export type FollowUpQuestionDef = {
  key: string;
  sectionKey: FollowUpSectionKey;
  label: string;
  hint?: string;
};

export type FollowUpSectionDef = {
  key: FollowUpSectionKey;
  title: string;
  shortTitle: string;
  durationHint?: string;
  description?: string;
  questions: FollowUpQuestionDef[];
};

export const FOLLOW_UP_OVERALL_STATUS_OPTIONS = [
  { value: "excelente", label: "Excellent" },
  { value: "bien", label: "Good" },
  { value: "neutral", label: "Neutral" },
  { value: "preocupado", label: "Concerned" },
  { value: "riesgo", label: "At risk" },
] as const;

export const FOLLOW_UP_EVALUATION_DIMENSIONS = [
  {
    key: "calidadTecnica",
    label: "Technical quality",
    description: "Code, design, and deliverable quality",
  },
  {
    key: "cumplimiento",
    label: "Commitment delivery",
    description: "Meeting dates and sprint agreements",
  },
  {
    key: "comunicacion",
    label: "Communication",
    description: "Clarity, proactivity, and transparency",
  },
  {
    key: "colaboracion",
    label: "Collaboration",
    description: "Teamwork and peer support",
  },
  {
    key: "autonomia",
    label: "Autonomy",
    description: "Ability to resolve without constant TL support",
  },
  {
    key: "proactividad",
    label: "Proactivity",
    description: "Anticipating risks and proposing improvements",
  },
  {
    key: "aprendizaje",
    label: "Learning",
    description: "Curiosity and adoption of new technologies",
  },
] as const;

export const FOLLOW_UP_SECTIONS: FollowUpSectionDef[] = [
  {
    key: "bienestar",
    title: "Well-being & satisfaction",
    shortTitle: "Well-being",
    durationHint: "5 min",
    description: "Spot issues before they affect the project.",
    questions: [
      {
        key: "bienestar_sentimiento",
        sectionKey: "bienestar",
        label: "How have you felt this month?",
      },
      {
        key: "bienestar_frustracion",
        sectionKey: "bienestar",
        label: "Is anything frustrating or blocking you?",
      },
      {
        key: "bienestar_carga",
        sectionKey: "bienestar",
        label: "Does the workload feel appropriate?",
      },
      {
        key: "bienestar_dinamica",
        sectionKey: "bienestar",
        label: "Would you change anything about team dynamics?",
      },
    ],
  },
  {
    key: "logros",
    title: "Achievements & results",
    shortTitle: "Achievements",
    durationHint: "5 min",
    description: "Recognizing contributions builds engagement.",
    questions: [
      {
        key: "logros_orgullo",
        sectionKey: "logros",
        label: "What achievement are you most proud of this month?",
      },
      {
        key: "logros_impacto",
        sectionKey: "logros",
        label: "Which task or project had the biggest impact?",
      },
      {
        key: "logros_aprendizaje",
        sectionKey: "logros",
        label: "What did you learn recently?",
      },
    ],
  },
  {
    key: "desempeno",
    title: "Performance & feedback",
    shortTitle: "Performance",
    durationHint: "10 min",
    description: "Two-way feedback space.",
    questions: [
      {
        key: "desempeno_bien",
        sectionKey: "desempeno",
        label: "What do you think you did well?",
      },
      {
        key: "desempeno_mejorar",
        sectionKey: "desempeno",
        label: "What could you improve?",
      },
      {
        key: "desempeno_habilidad",
        sectionKey: "desempeno",
        label: "Any technical or soft skill you want to develop?",
      },
      {
        key: "desempeno_apoyo_tl",
        sectionKey: "desempeno",
        label: "How can I support you better as a leader?",
      },
    ],
  },
  {
    key: "desarrollo",
    title: "Professional development",
    shortTitle: "Growth",
    durationHint: "5 min",
    description: "Especially important in consulting.",
    questions: [
      {
        key: "desarrollo_tecnologia",
        sectionKey: "desarrollo",
        label: "What technology would you like to learn?",
      },
      {
        key: "desarrollo_carrera",
        sectionKey: "desarrollo",
        label: "Are you interested in growing toward Senior, Lead, Architect, or a specialty?",
      },
      {
        key: "desarrollo_cursos",
        sectionKey: "desarrollo",
        label: "Any courses or certifications that interest you?",
      },
    ],
  },
  {
    key: "acciones",
    title: "Actions & commitments",
    shortTitle: "Actions",
    durationHint: "5 min",
    description: "Leave with clear agreements.",
    questions: [
      {
        key: "acciones_objetivos",
        sectionKey: "acciones",
        label: "Define 1–2 goals for next month",
      },
      {
        key: "acciones_apoyos",
        sectionKey: "acciones",
        label: "Support needed",
      },
      {
        key: "acciones_fecha",
        sectionKey: "acciones",
        label: "Follow-up date",
      },
    ],
  },
];

export const FOLLOW_UP_CLOSING_QUESTION: FollowUpQuestionDef = {
  key: "cierre_start_stop_continue",
  sectionKey: "cierre",
  label: "Is there anything I should start, stop, or continue doing as your leader?",
  hint: "Start / Stop / Continue",
};

export const FOLLOW_UP_ALL_QUESTIONS: FollowUpQuestionDef[] = [
  ...FOLLOW_UP_SECTIONS.flatMap((section) => section.questions),
  FOLLOW_UP_CLOSING_QUESTION,
];

export function isValidPeriod(period: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
}

/** 1:1s always cover the previous calendar month. */
export function defaultFollowUpPeriod(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${month}`;
}

/** Recent periods ending at the default Follow Up month (newest first). */
export function listFollowUpPeriodOptions(
  count = 18,
  now = new Date(),
): string[] {
  const end = defaultFollowUpPeriod(now);
  const [year, month] = end.split("-").map(Number);
  const options: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(year!, month! - 1 - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    options.push(`${d.getFullYear()}-${mm}`);
  }
  return options;
}

export function formatOverallStatus(status: FollowUpOverallStatus | null | undefined): string {
  if (!status) {
    return "—";
  }
  return FOLLOW_UP_OVERALL_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function formatSessionStatus(status: "draft" | "completed"): string {
  return status === "completed" ? "Completed" : "In progress";
}

export function formatTendencia(tendencia: FollowUpTendencia): string {
  if (tendencia === "up") {
    return "Improving";
  }
  if (tendencia === "down") {
    return "Declining";
  }
  return "Stable";
}

export function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) {
    return period;
  }
  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function averageEvaluationScores(scores: {
  calidadTecnica: number;
  cumplimiento: number;
  comunicacion: number;
  colaboracion: number;
  autonomia: number;
  proactividad: number;
  aprendizaje: number;
}): number {
  const values = [
    scores.calidadTecnica,
    scores.cumplimiento,
    scores.comunicacion,
    scores.colaboracion,
    scores.autonomia,
    scores.proactividad,
    scores.aprendizaje,
  ];
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / values.length) * 10) / 10;
}
