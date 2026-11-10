import { useState } from 'react'
import { isApiError } from '@/api/errors'
import { downloadCsv, saveFile } from '@/api/exports'
import type { ExportEntity } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { Button, DownloadIcon, useToast } from '@/ui'

const LABELS: Record<ExportEntity, string> = {
  vehicles: 'vehículos',
  drivers: 'conductores',
  passengers: 'pasajeros',
}

interface ExportCsvButtonProps {
  entity: ExportEntity
  /** Same filters as the visible list, so the file matches what the user sees. */
  filters?: object
}

/** Hidden for roles without `exports:csv`; the backend enforces the same permission. */
export function ExportCsvButton({ entity, filters }: ExportCsvButtonProps) {
  const { hasPermission } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!hasPermission('exports:csv')) return null

  async function handleClick() {
    setBusy(true)
    try {
      saveFile(await downloadCsv(entity, filters))
      toast.show({ tone: 'success', title: `Exportación de ${LABELS[entity]} lista` })
    } catch (error) {
      const detail = isApiError(error) ? (error.detail ?? undefined) : undefined
      toast.show({ tone: 'error', title: 'No se pudo exportar el CSV', description: detail })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      icon={<DownloadIcon />}
      loading={busy}
      loadingText="Exportando…"
      onClick={handleClick}
    >
      Exportar CSV
    </Button>
  )
}
