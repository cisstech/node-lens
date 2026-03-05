export const prettyJSON = (v: unknown) => {
  try {
    if (typeof v === 'string') return JSON.stringify(JSON.parse(v), null, 2);
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
