export const parseSearchParams = (url: string): URLSearchParams | null => {
  try {
    return new URL(url).searchParams;
  } catch {
    return null;
  }
}
