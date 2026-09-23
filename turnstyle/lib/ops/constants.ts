/** Standard Dropbox subfolder structure inside each promotion folder */
export const DROPBOX_FOLDER_STRUCTURE = [
  '01 Intake Brief',
  '02 Quote',
  '03 Invoice',
  '04 Authority Letter',
  '05 Terms and Conditions',
  '06 Permit Applications',
  '07 Permit Approvals',
  '08 Entry Files',
  '09 Pure Random Draws',
  '10 Draw Certificates',
  '11 Winner Notifications',
  '12 Publication Proof',
  '13 Final Report',
] as const

export type DropboxFolderLabel = (typeof DROPBOX_FOLDER_STRUCTURE)[number]

export const DOCUMENT_TYPES = [
  { fileType: 'intake_brief', label: 'Intake brief', folder: '01 Intake Brief' },
  { fileType: 'quote_approved', label: 'Quote approved', folder: '02 Quote' },
  { fileType: 'invoice_issued', label: 'Invoice issued', folder: '03 Invoice' },
  { fileType: 'invoice_paid', label: 'Invoice paid', folder: '03 Invoice' },
  { fileType: 'letter_of_authority', label: 'Letter of authority', folder: '04 Authority Letter' },
  { fileType: 'draft_terms', label: 'Draft terms', folder: '05 Terms and Conditions' },
  { fileType: 'final_terms', label: 'Final terms', folder: '05 Terms and Conditions' },
  { fileType: 'permit_applications', label: 'Permit applications', folder: '06 Permit Applications' },
  { fileType: 'permit_approvals', label: 'Permit approvals', folder: '07 Permit Approvals' },
  { fileType: 'creative_assets', label: 'Creative assets', folder: '01 Intake Brief' },
  { fileType: 'entry_file', label: 'Entry file', folder: '08 Entry Files' },
  { fileType: 'draw_record', label: 'Draw record', folder: '09 Pure Random Draws' },
  { fileType: 'winner_notification', label: 'Winner notification', folder: '11 Winner Notifications' },
  { fileType: 'final_report', label: 'Final report', folder: '13 Final Report' },
] as const

export type DocumentFileType = (typeof DOCUMENT_TYPES)[number]['fileType']

export const OPS_DOCUMENT_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  REQUIRED: 'Required',
  WAITING_ON_CLIENT: 'Waiting on client',
  IN_PROGRESS: 'In progress',
  READY_FOR_REVIEW: 'Ready for review',
  APPROVED: 'Approved',
  LODGED: 'Lodged',
  RECEIVED: 'Received',
  COMPLETE: 'Complete',
  OVERDUE: 'Overdue',
  NOT_APPLICABLE: 'Not applicable',
}

export const DRAW_FILE_STATUS_LABELS: Record<string, string> = {
  NOT_REQUIRED: 'Not required',
  REQUIRED: 'Required',
  REQUESTED: 'Requested',
  RECEIVED: 'Received',
  CHECKED: 'Checked',
  READY_FOR_DRAW: 'Ready for draw',
  USED_IN_DRAW: 'Used in draw',
  ARCHIVED: 'Archived',
}

export const CERTIFICATE_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  GENERATED: 'Generated',
  REVIEWED: 'Reviewed',
  SENT_TO_CLIENT: 'Sent to client',
  SAVED_TO_DROPBOX: 'Saved to Dropbox',
}

export const CALCULATED_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  AWAITING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Approved',
  TERMS_IN_PROGRESS: 'Terms in progress',
  PERMIT_PENDING: 'Permit pending',
  READY_TO_LAUNCH: 'Ready to launch',
  LIVE: 'Live',
  DRAW_DUE: 'Draw due',
  DRAW_OVERDUE: 'Draw overdue',
  COMPLETE: 'Complete',
  ARCHIVED: 'Archived',
}
