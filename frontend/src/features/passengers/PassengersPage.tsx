import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { getErrorMessage } from '@/api/errors'
import {
  useAssignPassenger,
  useDeletePassenger,
  usePassengers,
  useUnassignPassenger,
  type PassengerQueryParams,
} from '@/api/passengers'
import { useResources } from '@/api/resources'
import type { PassengerOut, VehicleRef, VehicleSummary } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { AssignVehicleDialog } from '@/features/drivers/shared/AssignVehicleDialog'
import { ConfirmAction } from '@/features/drivers/shared/ConfirmAction'
import { ROSTER_PAGE_SIZE, useRosterListState } from '@/features/drivers/shared/listState'
import { RosterFilters } from '@/features/drivers/shared/RosterFilters'
import { RosterListContent } from '@/features/drivers/shared/RosterListContent'
import { RosterActions } from '@/features/drivers/shared/RosterTable'
import { useVehicleOptions } from '@/features/drivers/shared/useVehicleOptions'
import { ExportCsvButton } from '@/features/exports/ExportCsvButton'
import { formatNumber } from '@/lib/format'
import { useDocumentTitle, useMediaQuery } from '@/lib/hooks'
import {
  Alert,
  Button,
  EditIcon,
  EmptyState,
  LinkIcon,
  PageHeader,
  Pagination,
  PlusIcon,
  SearchIcon,
  SelectField,
  TrashIcon,
  UnlinkIcon,
  UsersIcon,
  useToast,
  type SelectOption,
} from '@/ui'
import { CustomFieldsDialog } from './CustomFieldsDialog'
import { PassengerCards, PassengerTable } from './PassengerList'
import { PassengerFormDialog } from './PassengerFormDialog'
import '@/features/drivers/shared/roster.css'
import './passengers.css'

const COMPACT_QUERY = '(max-width: 47.99rem)'

type PassengerDialog =
  | { kind: 'create' }
  | { kind: 'edit' | 'fields' | 'assign' | 'unassign' | 'delete'; passenger: PassengerOut }

function describeVehiclePassengers(vehicle: VehicleSummary): string | null {
  if (vehicle.passenger_count === 0) return null
  return vehicle.passenger_count === 1 ? '1 pasajero' : `${vehicle.passenger_count} pasajeros`
}

/** "?vehicle_id=12" opens the list filtered by that vehicle (for example from its detail page). */
function initialVehicleFilter(params: URLSearchParams): string {
  const value = params.get('vehicle_id') ?? ''
  return /^[1-9]\d*$/.test(value) ? value : ''
}

/** Passengers (Wialon tags): list, CRUD, assignment and custom fields (RF-08, RF-09, RF-27, RF-28). */
export default function PassengersPage() {
  useDocumentTitle('Pasajeros')
  const { hasPermission } = useAuth()
  const toast = useToast()
  const canWrite = hasPermission('passengers:write')
  const canAssign = hasPermission('assignments:write')
  const linkVehicles = hasPermission('vehicles:read')
  const isCompact = useMediaQuery(COMPACT_QUERY)

  const [searchParams] = useSearchParams()
  const [vehicleId, setVehicleId] = useState(() => initialVehicleFilter(searchParams))
  const list = useRosterListState(vehicleId)
  const filters = { ...list.filters, vehicle_id: vehicleId ? Number(vehicleId) : undefined }
  const params: PassengerQueryParams = { ...filters, page: list.page, page_size: ROSTER_PAGE_SIZE }
  const passengers = usePassengers(params)
  const vehicleOptions = useVehicleOptions('', linkVehicles)
  const resources = useResources(hasPermission('drivers:read'))
  const resourceList = resources.data ?? []
  const resourceNames =
    resourceList.length > 1 ? new Map(resourceList.map((resource) => [resource.id, resource.name])) : null

  const [dialog, setDialog] = useState<PassengerDialog | null>(null)
  const deletePassenger = useDeletePassenger()
  const assignPassenger = useAssignPassenger()
  const unassignPassenger = useUnassignPassenger()
  const headingRef = useRef<HTMLHeadingElement>(null)
  // After a delete/unassign the opener button is gone: focus the list heading once the dialog
  // has closed (while it is open the rest of the page is inert).
  const focusListOnClose = useRef(false)
  useEffect(() => {
    if (dialog !== null || !focusListOnClose.current) return
    focusListOnClose.current = false
    headingRef.current?.focus()
  }, [dialog])

  const openDialog = (next: PassengerDialog) => {
    deletePassenger.reset()
    unassignPassenger.reset()
    setDialog(next)
  }
  const closeDialog = () => setDialog(null)

  const clearFilters = () => {
    list.clearFilters()
    setVehicleId('')
  }

  // ---- Vehicle filter options (the selected one stays listed even before the list loads) ----
  const vehicles = vehicleOptions.data?.items ?? []
  const vehicleSelectOptions: SelectOption[] = [
    { value: '', label: vehicleOptions.isPending ? 'Cargando…' : 'Todos' },
    ...vehicles.map((vehicle) => ({ value: String(vehicle.id), label: vehicle.name })),
  ]
  if (vehicleId && !vehicles.some((vehicle) => String(vehicle.id) === vehicleId)) {
    vehicleSelectOptions.push({ value: vehicleId, label: `Vehículo ${vehicleId}` })
  }

  const handleSaved = (passenger: PassengerOut, created: boolean) => {
    closeDialog()
    toast.show(
      created
        ? { tone: 'success', title: 'Pasajero creado', description: `«${passenger.name}» ya está en Wialon.` }
        : {
            tone: 'success',
            title: 'Cambios guardados',
            description: `Se actualizó «${passenger.name}» en Wialon; sus campos personalizados se conservaron.`,
          },
    )
  }

  const handleAssign = (passenger: PassengerOut) => async (vehicle: VehicleRef) => {
    await assignPassenger.mutateAsync({ ref: passenger, unitId: vehicle.id })
    closeDialog()
    toast.show({
      tone: 'success',
      title: 'Vehículo asignado',
      description: `Se asignó «${vehicle.name}» a «${passenger.name}».`,
    })
  }

  const confirmUnassign = (passenger: PassengerOut) =>
    unassignPassenger.mutate(passenger, {
      onSuccess: () => {
        focusListOnClose.current = true
        closeDialog()
        toast.show({
          tone: 'success',
          title: 'Pasajero desasignado',
          description: `«${passenger.name}» ya no está asignado a «${passenger.vehicle?.name ?? 'su vehículo'}».`,
        })
      },
    })

  const confirmDelete = (passenger: PassengerOut) =>
    deletePassenger.mutate(passenger, {
      onSuccess: () => {
        focusListOnClose.current = true
        closeDialog()
        if (passengers.data?.items.length === 1 && list.page > 1) list.goToPage(list.page - 1)
        toast.show({
          tone: 'success',
          title: 'Pasajero eliminado',
          description: `«${passenger.name}» se eliminó de Wialon.`,
        })
      },
    })

  const renderActions =
    canWrite || canAssign
      ? (passenger: PassengerOut) => (
          <RosterActions label={`Acciones de ${passenger.name}`}>
            {canWrite && (
              <Button
                size="sm"
                variant="ghost"
                icon={<EditIcon />}
                onClick={() => openDialog({ kind: 'edit', passenger })}
              >
                Editar <span className="visually-hidden">a {passenger.name}</span>
              </Button>
            )}
            {canAssign && (
              <Button
                size="sm"
                variant="ghost"
                icon={<LinkIcon />}
                onClick={() => openDialog({ kind: 'assign', passenger })}
              >
                {passenger.vehicle ? 'Cambiar vehículo ' : 'Asignar vehículo '}
                <span className="visually-hidden">
                  {passenger.vehicle ? 'de' : 'a'} {passenger.name}
                </span>
              </Button>
            )}
            {canAssign && passenger.vehicle && (
              <Button
                size="sm"
                variant="ghost"
                icon={<UnlinkIcon />}
                onClick={() => openDialog({ kind: 'unassign', passenger })}
              >
                Desasignar <span className="visually-hidden">a {passenger.name}</span>
              </Button>
            )}
            {canWrite && (
              <Button
                size="sm"
                variant="ghost"
                icon={<TrashIcon />}
                onClick={() => openDialog({ kind: 'delete', passenger })}
              >
                Eliminar <span className="visually-hidden">a {passenger.name}</span>
              </Button>
            )}
          </RosterActions>
        )
      : null

  const total = passengers.data?.total

  return (
    <>
      <PageHeader
        title="Pasajeros"
        description="Pasajeros registrados en Wialon, su vehículo y sus campos personalizados."
        actions={
          <>
            <ExportCsvButton entity="passengers" filters={filters} />
            {canWrite && (
              <Button icon={<PlusIcon />} onClick={() => openDialog({ kind: 'create' })}>
                Nuevo pasajero
              </Button>
            )}
          </>
        }
      />

      <RosterFilters
        label="Filtrar pasajeros"
        searchLabel="Buscar pasajero"
        searchPlaceholder="Nombre, código o teléfono"
        search={list.searchInput}
        onSearchChange={list.setSearchInput}
        assigned={list.assigned}
        onAssignedChange={list.setAssigned}
        sort={list.sort}
        onSortChange={list.setSort}
        showSort={isCompact}
        hasFilters={list.hasFilters}
        onClear={clearFilters}
      >
        {linkVehicles && (
          <SelectField
            label="Vehículo"
            options={vehicleSelectOptions}
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
            hint={vehicleOptions.isError ? 'No se pudo cargar la lista de vehículos.' : undefined}
          />
        )}
      </RosterFilters>

      {passengers.isError && passengers.data && (
        <Alert
          tone="warning"
          role="status"
          className="roster-alert"
          title="No se pudo actualizar la lista"
          action={
            <Button size="sm" variant="secondary" onClick={() => void passengers.refetch()}>
              Reintentar
            </Button>
          }
        >
          {getErrorMessage(passengers.error)}
        </Alert>
      )}

      <section className="roster-panel" aria-labelledby="passengers-list-title">
        <div className="roster-panel__header">
          <h2 id="passengers-list-title" ref={headingRef} tabIndex={-1} className="roster-panel__title">
            Lista de pasajeros
          </h2>
          <p className="roster-panel__meta" role="status">
            {total === undefined ? '' : total === 1 ? '1 pasajero' : `${formatNumber(total)} pasajeros`}
          </p>
        </div>

        <RosterListContent
          data={passengers.data}
          isError={passengers.isError}
          error={passengers.error}
          isFetching={passengers.isFetching}
          onRetry={() => void passengers.refetch()}
          compact={isCompact}
          columns={renderActions ? 6 : 5}
          loadingText="Cargando pasajeros…"
          errorTitle="No pudimos cargar los pasajeros"
          hasFilters={list.hasFilters}
          onFirstPage={() => list.goToPage(1)}
          noMatchesState={
            <EmptyState
              icon={<SearchIcon />}
              title="Ningún pasajero coincide con los filtros"
              description="Prueba con otro nombre, código o teléfono, otro vehículo, o quita los filtros."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              }
            />
          }
          emptyState={
            <EmptyState
              icon={<UsersIcon />}
              title="Aún no hay pasajeros"
              description={
                canWrite
                  ? 'Crea el primer pasajero para asignarlo a un vehículo. Se guardará en Wialon.'
                  : 'Cuando se registren pasajeros en Wialon, aparecerán aquí.'
              }
              action={
                canWrite ? (
                  <Button icon={<PlusIcon />} onClick={() => openDialog({ kind: 'create' })}>
                    Crear el primer pasajero
                  </Button>
                ) : undefined
              }
            />
          }
        >
          {(page) =>
            isCompact ? (
              <PassengerCards
                items={page.items}
                resourceNames={resourceNames}
                linkVehicles={linkVehicles}
                onOpenFields={(passenger) => openDialog({ kind: 'fields', passenger })}
                renderActions={renderActions}
              />
            ) : (
              <PassengerTable
                items={page.items}
                resourceNames={resourceNames}
                linkVehicles={linkVehicles}
                onOpenFields={(passenger) => openDialog({ kind: 'fields', passenger })}
                renderActions={renderActions}
                sort={list.sort}
                onSortChange={list.setSort}
                busy={passengers.isPlaceholderData}
              />
            )
          }
        </RosterListContent>

        {passengers.data && passengers.data.total > 0 && (
          <Pagination
            page={list.page}
            pages={passengers.data.pages}
            total={passengers.data.total}
            pageSize={ROSTER_PAGE_SIZE}
            onPageChange={list.goToPage}
            label="Paginación de pasajeros"
            itemLabel="pasajeros"
            disabled={passengers.isPlaceholderData}
          />
        )}
      </section>

      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <PassengerFormDialog
          passenger={dialog.kind === 'edit' ? dialog.passenger : null}
          resources={resourceList}
          onClose={closeDialog}
          onSaved={handleSaved}
        />
      )}

      {dialog?.kind === 'fields' && (
        <CustomFieldsDialog passenger={dialog.passenger} canEdit={canWrite} onClose={closeDialog} />
      )}

      {dialog?.kind === 'assign' && (
        <AssignVehicleDialog
          personName={dialog.passenger.name}
          noun="pasajero"
          currentVehicle={dialog.passenger.vehicle}
          onClose={closeDialog}
          onAssign={handleAssign(dialog.passenger)}
          describeVehicle={describeVehiclePassengers}
        />
      )}

      {dialog?.kind === 'unassign' && (
        <ConfirmAction
          title={`¿Desasignar a «${dialog.passenger.name}»?`}
          message={`El pasajero dejará de estar asignado a «${dialog.passenger.vehicle?.name ?? 'su vehículo'}» en Wialon. Puedes volver a asignarlo después.`}
          confirmLabel="Desasignar"
          destructive={false}
          busy={unassignPassenger.isPending}
          error={unassignPassenger.error}
          errorTitle="No se pudo desasignar"
          onConfirm={() => confirmUnassign(dialog.passenger)}
          onCancel={closeDialog}
        />
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmAction
          title={`¿Eliminar a «${dialog.passenger.name}»?`}
          message="El pasajero y sus campos personalizados se eliminarán de Wialon. Esta acción no se puede deshacer."
          confirmLabel="Eliminar pasajero"
          busy={deletePassenger.isPending}
          error={deletePassenger.error}
          errorTitle="No se pudo eliminar"
          onConfirm={() => confirmDelete(dialog.passenger)}
          onCancel={closeDialog}
        />
      )}
    </>
  )
}
