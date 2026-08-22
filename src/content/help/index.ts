import { adminTopics } from './admin-topics';
import { judgeTopics } from './judge-topics';
import type { HelpTopic } from './types';

export type { HelpTopic, HelpBlock } from './types';

export const allTopics: HelpTopic[] = [...adminTopics, ...judgeTopics];

export function topicsFor(audience: 'admin' | 'judge'): HelpTopic[] {
  return allTopics.filter((t) => t.audience === audience || t.audience === 'both');
}

export function findTopic(audience: 'admin' | 'judge', slug?: string): HelpTopic {
  const list = topicsFor(audience);
  return list.find((t) => t.slug === slug) || list[0];
}

export function searchTopics(audience: 'admin' | 'judge', query: string): HelpTopic[] {
  const list = topicsFor(audience);
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.summary.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.includes(q))
  );
}
