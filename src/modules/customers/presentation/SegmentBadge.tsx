import { segmentColors } from '@/core/theme/tokens';
import { Badge } from '@/shared/components/ui';
import { SEGMENT_META, type Segment } from '../domain/customer';

const TONE = { frecuente: 'green', frio: 'teal', sin_segmentar: 'gray' } as const;

export function SegmentBadge({ segment }: { segment: Segment }) {
  const m = SEGMENT_META[segment];
  return <Badge label={m.label} tone={TONE[segment]} dot={segmentColors[segment]} />;
}
