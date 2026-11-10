import { useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '@/api/errors'
import {
  useAssignDriver,
  useDeleteDriver,
  useDrivers,
  useUnassignDriver,
  type DriverQueryParams,
} from '@/api/drivers'
import { useResources } from '@/api/resources'
import type { DriverOut, VehicleRef, VehicleSummary } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { ExportCsvButton } from '@/features/exports/ExportCsvButton'
import { formatNumber } from '@/lib/format'
import { useDocumentTitle, useMediaQuery } from '@/lib/hooks'
import {
  Alert,
  Button,
  EmptyState,
  PageHeader,
  Pagination,
  PlusIcon,
  SearchIcon,
  SteeringWheelIcon,
  SwapIcon,
  TrashIcon,
  UnlinkIcon,
  useToast,
  type ActionMenuItem,
} from '@/ui'
import { DriverCards, DriverTable } from './DriverList'
import { DriverFormDialog } from './DriverFormDialog'
import { AssignVehicleDialog } from './shared/AssignVehicleDialog'
import { ConfirmAction } from './shared/ConfirmAction'
import { ROSTER_PAGE_SIZE, useRosterListState } from './shared/listState'
import { RosterFilters } from './shared/RosterFilters'
import { RosterListContent } from './shared/RosterListContent'
import { RosterRowActions } from './shared/RosterTable'
import './shared/roster.css'

/** Below 48rem the list becomes cards (UX-01). */
const COMPACT_QUERY = '(max-width: 47.99rem)'

type DriverDialog =
  | { kind: 'create' }
  | { kind: 'edit' | 'assign' | 'unassign' | 'delete'; driver: DriverOut }

function describeVehicleDriver(vehicle: VehicleSummary): string | null {
  return vehicle.driver ? `conductor: ${vehicle.driver.name}` : null
}

/** Drivers stored in Wialon: list, CRUD and vehicle binding (RF-16, RF-17, RF-18). */
export default function DriversPage() {
  useDocumentTitle('Conductores')
  const { hasPermission } = useAuth()
  const toast = useToast()
  const canWrite = hasPermission('drivers:write')
  const canAssign = hasPermission('assignments:write')
  const linkVehicles = hasPermission('vehicles:read')
  const isCompact = useMediaQuery(COMPACT_QUERY)

  const list = useRosterListState()
  const params: DriverQueryParams = { ...list.filters, page: list.page, page_size: ROSTER_PAGE_SIZE }
  const drivers = useDrivers(params)
  const resources = useResources(hasPermission('drivers:read'))
  const resourceList = resources.data ?? []
  const resourceNames =
    resourceList.length > 0 ? new Map(resourceList.map((resource) => [resource.id, resource.name])) : null

  const [dialog, setDialog] = useState<DriverDialog | null>(null)
  const deleteDriver = useDeleteDriver()
  const assignDriver = useAssignDriver()
  const unassignDriver = useUnassignDriver()
  const headingRef = useRef<HTMLHeadingElement>(null)
  // After a delete/unassign the button that opened the dialog is gone: once the dialog has
  // closed (the page is no longer inert), focus goes to the list heading instead.
  const focusListOnClose = useRef(false)
  useEffect(() => {
    if (dialog !== null || !focusListOnClose.current) return
    focusListOnClose.current = false
    headingRef.current?.focus()
  }, [dialog])

  const openDialog = (next: DriverDialog) => {
    deleteDriver.reset()
    unassignDriver.reset()
    setDialog(next)
  }
  const closeDialog = () => setDialog(null)

  const handleSaved = (driver: DriverOut, created: boolean) => {
    closeDialog()
    toast.show(
      created
        ? { tone: 'success', title: 'Conductor creado', description: `«${driver.name}» ya está en Wialon.` }
        : { tone: 'success', title: 'Cambios guardados', description: `Se actualizó «${driver.name}» en Wialon.` },
    )
  }

  const handleAssign = (driver: DriverOut) => async (vehicle: VehicleRef) => {
    await assignDriver.mutateAsync({ ref: driver, unitId: vehicle.id })
    // The dashed "Asignar vehículo" button that opened the dialog becomes a link: focus the list.
    if (!driver.vehicle) focusListOnClose.current = true
    closeDialog()
    toast.show({
      tone: 'success',
      title: 'Vehículo asignado',
      description: `Se asignó «${vehicle.name}» a «${driver.name}».`,
    })
  }

  const confirmUnassign = (driver: DriverOut) =>
    unassignDriver.mutate(driver, {
      onSuccess: () => {
        focusListOnClose.current = true
        closeDialog()
        toast.show({
          tone: 'success',
          title: 'Conductor desvinculado',
          description: `«${driver.name}» ya no está vinculado a «${driver.vehicle?.name ?? 'su vehículo'}».`,
        })
      },
    })

  const confirmDelete = (driver: DriverOut) =>
    deleteDriver.mutate(driver, {
      onSuccess: () => {
        focusListOnClose.current = true
        closeDialog()
        // The last row of a page is gone: show the previous page instead of an empty one.
        if (drivers.data?.items.length === 1 && list.page > 1) list.goToPage(list.page - 1)
        toast.show({ tone: 'success', title: 'Conductor eliminado', description: `«${driver.name}» se eliminó de Wialon.` })
      },
    })

  const renderActions =
    canWrite || canAssign
      ? (driver: DriverOut) => {
          const items: ActionMenuItem[] = []
          if (canAssign && driver.vehicle) {
            items.push(
              { label: 'Cambiar vehículo', icon: <SwapIcon />, onSelect: () => openDialog({ kind: 'assign', driver }) },
              { label: 'Desvincular', icon: <UnlinkIcon />, onSelect: () => openDialog({ kind: 'unassign', driver }) },
            )
          }
          if (canWrite) {
            items.push({
              label: 'Eliminar',
              icon: <TrashIcon />,
              tone: 'danger',
              onSelect: () => openDialog({ kind: 'delete', driver }),
            })
          }
          return (
            <RosterRowActions
              name={driver.name}
              onEdit={canWrite ? () => openDialog({ kind: 'edit', driver }) : undefined}
              menuItems={items}
            />
          )
        }
      : null
  const onAssign = canAssign ? (driver: DriverOut) => openDialog({ kind: 'assign', driver }) : null

  const total = drivers.data?.total

  return (
    <>
      <PageHeader
        title="Conductores"
        description="Conductores registrados en Wialon y el vehículo al que están vinculados."
        actions={
          <>
            <ExportCsvButton entity="drivers" filters={list.filters} />
            {canWrite && (
              <Button icon={<PlusIcon />} onClick={() => openDialog({ kind: 'create' })}>
                Nuevo conductor
              </Button>
            )}
          </>
        }
      />

      <RosterFilters
        label="Filtrar conductores"
        searchLabel="Buscar conductor"
        searchPlaceholder="Nombre, código o teléfono"
        search={list.searchInput}
        onSearchChange={list.setSearchInput}
        assigned={list.assigned}
        onAssignedChange={list.setAssigned}
        sort={list.sort}
        onSortChange={list.setSort}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
      />

      {drivers.isError && drivers.data && (
        <Alert
          tone="warning"
          role="status"
          className="roster-alert"
          title="No se pudo actualizar la lista"
          action={
            <Button size="sm" variant="secondary" onClick={() => void drivers.refetch()}>
              Reintentar
            </Button>
          }
        >
          {getErrorMessage(drivers.error)}
        </Alert>
      )}

      <section className="card roster-panel" aria-labelledby="drivers-list-title">
        <div className="roster-panel__header">
          <h2 id="drivers-list-title" ref={headingRef} tabIndex={-1} className="card-title roster-panel__title">
            Lista de conductores
          </h2>
          <p className="card-meta" role="status">
            {total === undefined ? '' : total === 1 ? '1 conductor' : `${formatNumber(total)} conductores`}
          </p>
        </div>

        <RosterListContent
          data={drivers.data}
          isError={drivers.isError}
          error={drivers.error}
          isFetching={drivers.isFetching}
          onRetry={() => void drivers.refetch()}
          compact={isCompact}
          columns={renderActions ? 5 : 4}
          loadingText="Cargando conductores…"
          errorTitle="No pudimos cargar los conductores"
          hasFilters={list.hasFilters}
          onFirstPage={() => list.goToPage(1)}
          noMatchesState={
            <EmptyState
              icon={<SearchIcon />}
              title="Ningún conductor coincide con los filtros"
              description="Prueba con otro nombre, código o teléfono, o quita los filtros."
              action={
                <Button variant="secondary" onClick={list.clearFilters}>
                  Limpiar filtros
                </Button>
              }
            />
          }
          emptyState={
            <EmptyState
              icon={<SteeringWheelIcon />}
              title="Aún no hay conductores"
              description={
                canWrite
                  ? 'Crea el primer conductor para vincularlo a un vehículo. Se guardará en Wialon.'
                  : 'Cuando se registren conductores en Wialon, aparecerán aquí.'
              }
              action={
                canWrite ? (
                  <Button icon={<PlusIcon />} onClick={() => openDialog({ kind: 'create' })}>
                    Crear el primer conductor
                  </Button>
                ) : undefined
              }
            />
          }
        >
          {(page) =>
            isCompact ? (
              <DriverCards
                items={page.items}
                resourceNames={resourceNames}
                linkVehicles={linkVehicles}
                onAssign={onAssign}
                renderActions={renderActions}
              />
            ) : (
              <DriverTable
                items={page.items}
                resourceNames={resourceNames}
                linkVehicles={linkVehicles}
                onAssign={onAssign}
                renderActions={renderActions}
                sort={list.sort}
                onSortChange={list.setSort}
                busy={drivers.isPlaceholderData}
              />
            )
          }
        </RosterListContent>

        {drivers.data && drivers.data.total > 0 && (
          <div className="roster-panel__footer">
            <Pagination
              page={list.page}
              pages={drivers.data.pages}
              total={drivers.data.total}
              pageSize={ROSTER_PAGE_SIZE}
              onPageChange={list.goToPage}
              label="Paginación de conductores"
              itemLabel="conductores"
              disabled={drivers.isPlaceholderData}
            />
          </div>
        )}
      </section>

      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <DriverFormDialog
          driver={dialog.kind === 'edit' ? dialog.driver : null}
          resources={resourceList}
          onClose={closeDialog}
          onSaved={handleSaved}
        />
      )}

      {dialog?.kind === 'assign' && (
        <AssignVehicleDialog
          personName={dialog.driver.name}
          noun="conductor"
          currentVehicle={dialog.driver.vehicle}
          onClose={closeDialog}
          onAssign={handleAssign(dialog.driver)}
          describeVehicle={describeVehicleDriver}
        />
      )}

      {dialog?.kind === 'unassign' && (
        <ConfirmAction
          title={`¿Desvincular a «${dialog.driver.name}»?`}
          message={`El conductor dejará de estar vinculado a «${dialog.driver.vehicle?.name ?? 'su vehículo'}» en Wialon. Puedes volver a asignarlo después.`}
          confirmLabel="Desvincular"
          destructive={false}
          busy={unassignDriver.isPending}
          error={unassignDriver.error}
          errorTitle="No se pudo desvincular"
          onConfirm={() => confirmUnassign(dialog.driver)}
          onCancel={closeDialog}
        />
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmAction
          title={`¿Eliminar a «${dialog.driver.name}»?`}
          message="El conductor se eliminará de Wialon. Esta acción no se puede deshacer."
          confirmLabel="Eliminar conductor"
          busy={deleteDriver.isPending}
          error={deleteDriver.error}
          errorTitle="No se pudo eliminar"
          onConfirm={() => confirmDelete(dialog.driver)}
          onCancel={closeDialog}
        />
      )}
    </>
  )
}
