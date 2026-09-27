export const DISTRICTS: Record<string, [number, number]> = {
  Jaffna: [9.6615, 80.0255],
  Kilinochchi: [9.3803, 80.377],
  Mannar: [8.981, 79.9044],
  Vavuniya: [8.7542, 80.4982],
  Mullaitivu: [9.2671, 80.8142],
  Trincomalee: [8.5711, 81.2335],
  Batticaloa: [7.7102, 81.6924],
  Ampara: [7.2912, 81.6724],
  Hambantota: [6.1248, 81.1185],
  Matara: [6.0535, 80.5353],
  Galle: [6.0328, 80.215],
  Ratnapura: [6.7056, 80.3847],
  Monaragala: [6.8728, 81.3507],
  Badulla: [6.9819, 81.0556],
  'Nuwara Eliya': [6.9497, 80.7837],
  Kandy: [7.2906, 80.6337],
  Matale: [7.4675, 80.6234],
  Kurunegala: [7.4818, 80.3609],
  Puttalam: [8.0362, 79.8283],
  Anuradhapura: [8.3114, 80.4168],
  Polonnaruwa: [7.9403, 81.0188],
  Kegalle: [7.2513, 80.3464],
  Kalutara: [6.5854, 79.9607],
  Gampaha: [7.084, 80.0098],
  Colombo: [6.9271, 79.8612],
  Kalmunai: [7.4167, 81.8333],
};

export function lastCompleteIsoWeek(now = new Date()) {
  const utc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = utc.getUTCDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const end = new Date(utc);
  if (day !== 0) {
    end.setUTCDate(end.getUTCDate() - day);
  }
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const iso = new Date(start);
  iso.setUTCDate(iso.getUTCDate() + 3);
  const yearStart = new Date(Date.UTC(iso.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((iso.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getUTCDay() + 6) % 7)) / 7);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    year: iso.getUTCFullYear(),
    week,
  };
}

export function lastNCompleteIsoWeeks(n: number, now = new Date()) {
  const latest = lastCompleteIsoWeek(now);
  const weeks = [];
  const startD = new Date(`${latest.start}T00:00:00Z`);
  const endD = new Date(`${latest.end}T00:00:00Z`);

  for (let i = 0; i < n; i++) {
    const s = new Date(startD);
    s.setUTCDate(s.getUTCDate() - i * 7);
    const e = new Date(endD);
    e.setUTCDate(e.getUTCDate() - i * 7);

    const iso = new Date(s);
    iso.setUTCDate(iso.getUTCDate() + 3);
    const yearStart = new Date(Date.UTC(iso.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((iso.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getUTCDay() + 6) % 7)) / 7);

    weeks.push({
      start: s.toISOString().slice(0, 10),
      end: e.toISOString().slice(0, 10),
      year: iso.getUTCFullYear(),
      week,
    });
  }
  return weeks.reverse();
}

export function nextIsoWeek(year: number, week: number) {
  if (week >= 52) return { year: year + 1, week: 1 };
  return { year, week: week + 1 };
}

const BASELINE: Record<string, number> = {
  Colombo: 90,
  Gampaha: 70,
  Kalutara: 40,
  Kandy: 45,
  Galle: 35,
  Ratnapura: 40,
  Kurunegala: 35,
  Kegalle: 30,
  Batticaloa: 28,
  Jaffna: 22,
  Anuradhapura: 20,
  Badulla: 22,
  Matara: 28,
  Trincomalee: 20,
};

/** Blend Keras output with recent case level. The BiLSTM was trained around a median of 8 cases/week. */
export function calibrateToRecent(
  modelPred: number,
  lastCases?: number | null,
  lag1?: number | null,
): number {
  if (lastCases == null || !Number.isFinite(lastCases)) {
    return Math.max(0, Math.round(modelPred));
  }
  const prev = lag1 != null && Number.isFinite(lag1) ? lag1 : lastCases;
  const trend = lastCases - prev;
  const persist = Math.max(0, lastCases + (trend >= 0 ? 0.1 * trend : 0.55 * trend));
  const weight = Math.min(0.75, Math.max(0.25, lastCases / (lastCases + 50)));
  return Math.max(0, Math.round((1 - weight) * Math.max(0, modelPred) + weight * persist));
}

export function estimatePredictedCases(input: {
  district: string;
  dengue_cases?: number | null;
  avg_temp?: number | null;
  avg_humidity?: number | null;
  total_rainfall?: number | null;
}) {
  const reported = Number(input.dengue_cases);
  const baseline = BASELINE[input.district] ?? 18;
  const seed = Number.isFinite(reported) && reported > 0 ? reported : baseline;
  const temp = input.avg_temp ?? 28;
  const hum = input.avg_humidity ?? 75;
  const rain = input.total_rainfall ?? 10;
  let score = 0.55;
  if (temp >= 26 && temp <= 32) score += 0.2;
  else if (temp >= 24 && temp <= 34) score += 0.1;
  if (hum >= 80) score += 0.15;
  else if (hum >= 70) score += 0.08;
  if (rain >= 25) score += 0.15;
  else if (rain >= 10) score += 0.08;
  const predicted = Math.max(1, Math.round(seed * score));
  const spread = Math.max(3, Math.round(Math.sqrt(predicted) * 2.2));
  return {
    predicted_cases: predicted,
    confidence_low: Math.max(0, predicted - spread),
    confidence_high: predicted + spread,
  };
}
