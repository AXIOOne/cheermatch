export type HelpBlock =
  | { type: 'p'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'steps'; items: string[] }
  | { type: 'bullets'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'callout'; variant: 'note' | 'warning' | 'tip'; title?: string; text: string }
  | { type: 'link'; label: string; to: string; external?: boolean };

export interface HelpTopic {
  slug: string;
  title: string;
  summary: string;
  audience: 'admin' | 'judge' | 'both';
  keywords: string[];
  blocks: HelpBlock[];
}
