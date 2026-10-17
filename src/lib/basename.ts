/** React Router basename for a Vite `base` such as `/sens/`. */
export function routerBasename(base: string = import.meta.env.BASE_URL): string {
  if (!base || base === "/") return "/";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}
