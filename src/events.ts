export type Ev = { type: string; [k: string]: unknown };
type H = (e: Ev) => void;
const hs = new Set<H>();
export const on = (h: H) => {
  hs.add(h);
};
export const emit = (e: Ev) => {
  for (const h of hs) h(e);
};
