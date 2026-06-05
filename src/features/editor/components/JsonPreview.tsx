import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Copy } from 'lucide-react';
import type { TravelData } from '@/domain/schema';
import { highlightJson } from '@/lib/jsonHighlight';

export function JsonPreview({ data }: { data: TravelData }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => highlightJson(data), [data]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast.success(t('toast.copied'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="json-wrap">
      <div className="json-head">
        <span className="mono">travel-data.json</span>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          style={{ color: '#d7d2c4' }}
          onClick={copy}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? t('actions.copied') : t('actions.copy')}
        </button>
      </div>
      <pre className="json-pre" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
