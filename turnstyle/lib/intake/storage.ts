import type { CampaignBuilderPrefill } from './types'
import { INTAKE_STORAGE_KEY } from './types'

export function saveIntakePrefill(prefill: CampaignBuilderPrefill): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(prefill))
}

export function loadIntakePrefill(): CampaignBuilderPrefill | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(INTAKE_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CampaignBuilderPrefill
  } catch {
    return null
  }
}

export function clearIntakePrefill(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(INTAKE_STORAGE_KEY)
}
