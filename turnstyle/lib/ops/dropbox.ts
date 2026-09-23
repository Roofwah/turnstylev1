import { DROPBOX_FOLDER_STRUCTURE } from './constants'

/**
 * MVP: user pastes a parent folder URL. Future: Dropbox API creates subfolders.
 */
export function normalizeDropboxFolderUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export function getDropboxSubfolderPath(parentUrl: string, subfolder: string): string {
  const base = normalizeDropboxFolderUrl(parentUrl)
  return `${base}/${subfolder}`
}

export function getFolderStructureForDisplay(parentUrl: string | null) {
  if (!parentUrl) {
    return DROPBOX_FOLDER_STRUCTURE.map((label) => ({ label, url: null }))
  }
  const base = normalizeDropboxFolderUrl(parentUrl)
  return DROPBOX_FOLDER_STRUCTURE.map((label) => ({
    label,
    url: `${base}/${encodeURIComponent(label)}`,
  }))
}

/** Placeholder for future Dropbox API integration */
export type DropboxSyncAdapter = {
  createFolderStructure: (parentPath: string) => Promise<{ folders: string[] }>
  listFiles: (folderPath: string) => Promise<{ name: string; url: string }[]>
}

export const dropboxSyncStub: DropboxSyncAdapter = {
  async createFolderStructure(parentPath) {
    return {
      folders: DROPBOX_FOLDER_STRUCTURE.map((f) => `${parentPath}/${f}`),
    }
  },
  async listFiles() {
    return []
  },
}
