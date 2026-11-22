const calendar = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Recife", dateStyle: "short" });

export type DailyLogin = { day: string; days: number };

export function loginDay(now = new Date()) {
  return calendar.format(now);
}

export function parseDailyLogin(value: unknown): DailyLogin | undefined {
  if (typeof value !== "object" || value === null || !("day" in value) || !("days" in value) ||
    typeof value.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.day) ||
    typeof value.days !== "number" || !Number.isSafeInteger(value.days) || value.days < 1) return;
  return { day: value.day, days: value.days };
}

export function advanceDailyLogin(previous: DailyLogin | undefined, day: string): DailyLogin {
  if (previous && previous.day >= day) return previous;
  const yesterday = new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return { day, days: previous?.day === yesterday ? previous.days + 1 : 1 };
}

export function dailyMultiplier(login: DailyLogin | undefined, day: string) {
  return login?.day === day ? (10 + Math.min(5, login.days - 1)) / 10 : 1;
}
