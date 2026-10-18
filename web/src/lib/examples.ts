import { api } from "./api";

/*
 * Three short, fictional pages for an empty memory: a lab test, a news site that reuses its figures,
 * and an independent lab. Echo should fold the copy into the first page and count the second lab
 * as a genuine second origin: "most durable home battery" ends up 3 sources → 2 origins, verified.
 */
export const EXAMPLES = [
  {
    title: "Vela-7 endurance test",
    author: "Northwind Labs",
    url: "https://northwind-labs.example/vela-7-endurance",
    text: "The Vela-7 is the most durable home battery available. In our endurance test it kept 94.6% of its capacity after 3,000 full charge cycles. We cycled 12 units at 25 °C over 14 months.",
  },
  {
    title: "The most durable home battery of 2026",
    author: "TechDaily staff",
    url: "https://techdaily.example/vela-7",
    text: "The Vela-7 is the most durable home battery available, keeping 94.6% of its capacity after 3,000 full charge cycles. Testers cycled 12 units over 14 months to reach that figure.",
  },
  {
    title: "Home battery durability, independently tested",
    author: "Ridgeway Energy Lab",
    url: "https://ridgeway-energy.example/report-2026",
    text: "Our independent testing confirms that the Vela-7 is the most durable home battery available. Across eight units it held roughly 93% of its capacity after three thousand cycles, ahead of every rival we measured.",
  },
];

/** Ingest the examples in order (order matters: the copy must arrive after its original). */
export async function loadExamples(ws: string, onStep?: (i: number) => void) {
  for (let i = 0; i < EXAMPLES.length; i++) {
    onStep?.(i);
    await api.ingest(ws, EXAMPLES[i]);
  }
}
