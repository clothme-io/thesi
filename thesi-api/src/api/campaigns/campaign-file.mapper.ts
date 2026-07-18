import { formatSizeLabel } from 'src/shared/storage/file-helpers';
import type {
  CampaignFileMeta,
  CampaignFileRow,
} from './campaign.repository';

export function toFileMeta(row: CampaignFileRow): CampaignFileMeta {
  return {
    id: row.id,
    name: row.originalName,
    sizeLabel: formatSizeLabel(row.sizeBytes),
  };
}
