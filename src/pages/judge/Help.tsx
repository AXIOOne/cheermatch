import { HelpLayout } from '@/components/help/HelpLayout';

export default function JudgeHelp() {
  return <HelpLayout audience="judge" basePath="/judge/help" showManualDownload manualHref="/docs/cheermatch-judge-manual.pdf" />;
}
