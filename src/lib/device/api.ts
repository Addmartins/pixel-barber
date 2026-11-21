export function deviceApi(path: `/api/${string}`) {
  const origin = process.env.NEXT_PUBLIC_BACKEND_ORIGIN;
  return origin ? new URL(path, origin).toString() : path;
}
