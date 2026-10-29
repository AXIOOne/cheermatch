import { useState } from 'react';
import { Info, AlertTriangle, Lightbulb, Maximize2, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { HelpTopic } from '@/content/help';

const calloutStyles = {
  note: { icon: Info, cls: 'border-primary/40 bg-primary/5' },
  warning: { icon: AlertTriangle, cls: 'border-destructive/40 bg-destructive/5' },
  tip: { icon: Lightbulb, cls: 'border-muted-foreground/30 bg-muted/50' },
} as const;

export function HelpArticle({ topic }: { topic: HelpTopic }) {
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  return (
    <article className="max-w-3xl">
      <h1 className="text-3xl font-bold text-foreground">{topic.title}</h1>
      <p className="mt-2 text-muted-foreground">{topic.summary}</p>

      <div className="mt-8 space-y-6">
        {topic.blocks.map((block, i) => {
          switch (block.type) {
            case 'heading':
              return (
                <h2 key={i} className="text-xl font-semibold text-foreground pt-2">
                  {block.text}
                </h2>
              );
            case 'p':
              return (
                <p key={i} className="text-sm leading-relaxed text-foreground/90">
                  {block.text}
                </p>
              );
            case 'bullets':
              return (
                <ul key={i} className="list-disc pl-5 space-y-2 text-sm text-foreground/90">
                  {block.items.map((it, j) => (
                    <li key={j}>{it}</li>
                  ))}
                </ul>
              );
            case 'steps':
              return (
                <ol key={i} className="list-decimal pl-5 space-y-2 text-sm text-foreground/90">
                  {block.items.map((it, j) => (
                    <li key={j}>{it}</li>
                  ))}
                </ol>
              );
            case 'table':
              return (
                <div key={i} className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {block.head.map((h, j) => (
                          <TableHead key={j}>{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {block.rows.map((row, j) => (
                        <TableRow key={j}>
                          {row.map((cell, k) => (
                            <TableCell key={k} className="align-top text-sm">
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            case 'callout': {
              const { icon: Icon, cls } = calloutStyles[block.variant];
              return (
                <div key={i} className={cn('flex gap-3 rounded-md border p-4', cls)}>
                  <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="text-sm text-foreground/90">
                    {block.title && <p className="font-semibold mb-1">{block.title}</p>}
                    <p>{block.text}</p>
                  </div>
                </div>
              );
            }
            case 'image':
              return (
                <figure key={i} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setZoom({ src: block.src, alt: block.alt })}
                    className="group relative block w-full overflow-hidden rounded-md border bg-muted shadow-sm"
                    aria-label={`Enlarge screenshot: ${block.alt}`}
                  >
                    <img src={block.src} alt={block.alt} loading="lazy" className="w-full h-auto" />
                    <span className="absolute right-2 top-2 rounded-md bg-background/90 p-1.5 opacity-0 shadow transition-opacity group-hover:opacity-100">
                      <Maximize2 className="w-4 h-4 text-foreground" />
                    </span>
                  </button>
                  {block.caption && <figcaption className="text-xs text-muted-foreground">{block.caption}</figcaption>}
                </figure>
              );
            case 'video':
              return (
                <figure key={i} className="space-y-2">
                  <div className="overflow-hidden rounded-md border bg-muted shadow-sm">
                    <video
                      src={block.src}
                      poster={block.poster}
                      controls
                      playsInline
                      muted
                      preload="none"
                      className="w-full h-auto"
                    />
                  </div>
                  <figcaption className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <PlayCircle className="w-3.5 h-3.5" />
                    {block.caption || 'Screen recording'}
                  </figcaption>
                </figure>
              );
            default:
              return null;
          }
        })}
      </div>

      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-[96vw] w-[1280px] p-2">
          <DialogTitle className="sr-only">{zoom?.alt || 'Screenshot'}</DialogTitle>
          {zoom && <img src={zoom.src} alt={zoom.alt} className="w-full h-auto rounded" />}
        </DialogContent>
      </Dialog>
    </article>
  );
}
