/**
 * RSR — Regular Supervisory Report. Pillar 3, supervisor-only.
 * Fork of SFCR with two extra sections (F, G).
 */
import { FileText } from 'lucide-react';
import {
  fetchRsrSections, fetchRsrDrafts, createRsrDraft, saveRsrDraft, approveRsrDraft, fetchSfcrDraft,
} from '../lib/api';
import { SfcrLikePage } from './Sfcr';

export default function Rsr() {
  return (
    <SfcrLikePage
      docName="RSR"
      docTitle="Regular Supervisory Report"
      docSubtitle="Same five public sections as SFCR, plus two supervisor-only sections (F, G). Confidential — for the supervisor's eyes."
      icon={FileText}
      pillar={3}
      fetchSections={fetchRsrSections}
      fetchDrafts={fetchRsrDrafts}
      fetchDraft={fetchSfcrDraft}  // RSR + SFCR share the gold_sfcr_drafts table; same /draft/{id} endpoint works
      createDraft={createRsrDraft}
      saveDraft={saveRsrDraft}
      approveDraft={approveRsrDraft}
      pdfBase="/api/rsr/pdf"
    />
  );
}
