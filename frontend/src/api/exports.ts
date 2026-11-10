import { apiFetch } from './client'
import type { ExportEntity } from './types'

export interface DownloadedFile {
  blob: Blob
  filename: string
}

function filenameFrom(disposition: string | null, fallback: string): string {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
  return match ? decodeURIComponent(match[1]) : fallback
}

/** Downloads a CSV export with the same filters as the list (server checks `exports:csv`). */
export async function downloadCsv(entity: ExportEntity, filters: object = {}): Promise<DownloadedFile> {
  const response = await apiFetch<Response>(`/api/v1/exports/${entity}.csv`, {
    query: filters,
    responseType: 'response',
  })
  const blob = await response.blob()
  return { blob, filename: filenameFrom(response.headers.get('content-disposition'), `${entity}.csv`) }
}

export function saveFile({ blob, filename }: DownloadedFile): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
