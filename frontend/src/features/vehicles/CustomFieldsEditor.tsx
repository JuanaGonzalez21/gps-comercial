import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { getErrorMessage, isApiError } from '@/api/errors'
import type { CustomField } from '@/api/types'
import {
  isPendingField,
  refetchVehicleCustomFields,
  useCreateVehicleCustomField,
  useCustomFieldWritesPending,
  useDeleteVehicleCustomField,
  useUpdateVehicleCustomField,
  useVehicleCustomFields,
} from '@/api/vehicleDetail'
import { useAuth } from '@/auth/useAuth'
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  EditIcon,
  EmptyState,
  ErrorState,
  PlusIcon,
  RefreshIcon,
  Skeleton,
  Spinner,
  TextField,
  TrashIcon,
  useToast,
} from '@/ui'
import {
  CUSTOM_FIELD_NAME_MAX,
  CUSTOM_FIELD_VALUE_MAX,
  customFieldSchema,
  normalizeFieldName,
  type CustomFieldFormInput,
  type CustomFieldFormValues,
} from './customFieldSchema'

// Vehicle custom fields (RF-19..RF-22). Every write is optimistic (the list changes at once and is
// rolled back if Wialon fails), shows "Guardando…", and ends in a toast or an inline error with
// "Reintentar". Edits send the value the user started from, so a change made in Wialon meanwhile
// is reported (409) instead of being overwritten silently.

const SAVE_FAILED = 'No pudimos guardar el campo en Wialon.'
const EMPTY_FIELD: CustomFieldFormInput = { name: '', value: '' }

type FieldName = keyof CustomFieldFormInput
type ServerErrors = Partial<Record<FieldName, string>>
type SubmitWith = (handler: (values: CustomFieldFormValues) => Promise<void>) => void

function fieldErrorsFrom(error: unknown): ServerErrors {
  if (!isApiError(error) || error.code !== 'validation_error') return {}
  const errors: ServerErrors = {}
  if (error.fieldErrors.name) errors.name = error.fieldErrors.name
  if (error.fieldErrors.value) errors.value = error.fieldErrors.value
  return errors
}

// ---------- Form shared by "add" and "edit" ----------

interface CustomFieldFormProps {
  /** Accessible name of the form. */
  label: string
  defaultValues: CustomFieldFormInput
  takenNames: readonly string[]
  submitLabel: string
  onSubmit: (values: CustomFieldFormValues) => Promise<void>
  onCancel: () => void
  /** Field errors returned by the API (duplicate name, validation). */
  serverErrors?: ServerErrors
  initialFocus?: FieldName | null
  /** Alerts shown above the buttons; receives a submit helper for "Reintentar"/"Sobrescribir". */
  renderNotice?: (submitWith: SubmitWith) => ReactNode
}

function CustomFieldForm({
  label,
  defaultValues,
  takenNames,
  submitLabel,
  onSubmit,
  onCancel,
  serverErrors,
  initialFocus = 'name',
  renderNotice,
}: CustomFieldFormProps) {
  const idPrefix = useId()
  const schema = useMemo(() => customFieldSchema(takenNames), [takenNames])
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<CustomFieldFormInput, unknown, CustomFieldFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  // Mount only: a new form instance (key) is created whenever the starting point changes.
  const initialFocusRef = useRef(initialFocus)
  useEffect(() => {
    if (initialFocusRef.current) setFocus(initialFocusRef.current)
  }, [setFocus])

  useEffect(() => {
    if (!serverErrors) return
    let first: FieldName | null = null
    for (const field of ['name', 'value'] as const) {
      const message = serverErrors[field]
      if (!message) continue
      setError(field, { message })
      first ??= field
    }
    if (first) setFocus(first)
  }, [serverErrors, setError, setFocus])

  const submitWith: SubmitWith = (handler) => {
    void handleSubmit(handler)()
  }

  return (
    <form
      className="cf-form"
      aria-label={label}
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !isSubmitting) {
          event.stopPropagation()
          onCancel()
        }
      }}
    >
      <div className="cf-form__fields">
        <TextField
          id={`${idPrefix}-name`}
          label="Nombre"
          hint={`Hasta ${CUSTOM_FIELD_NAME_MAX} caracteres.`}
          isRequired
          autoComplete="off"
          error={errors.name?.message}
          disabled={isSubmitting}
          {...register('name')}
        />
        <TextField
          id={`${idPrefix}-value`}
          label="Valor"
          hint={`Hasta ${CUSTOM_FIELD_VALUE_MAX} caracteres; puede quedar vacío.`}
          autoComplete="off"
          error={errors.value?.message}
          disabled={isSubmitting}
          {...register('value')}
        />
      </div>
      {renderNotice?.(submitWith)}
      <div className="cf-form__actions">
        <Button type="submit" size="sm" loading={isSubmitting} loadingText="Guardando…">
          {submitLabel}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

// ---------- One field: view, edit, conflict ----------

interface CustomFieldRowProps {
  vehicleId: number
  field: CustomField
  otherNames: readonly string[]
  canWrite: boolean
  onRequestDelete: (field: CustomField) => void
}

type FocusTarget = 'edit' | 'row' | 'notice'

function CustomFieldRow({ vehicleId, field, otherNames, canWrite, onRequestDelete }: CustomFieldRowProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const update = useUpdateVehicleCustomField(vehicleId)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<CustomFieldFormInput>({ name: field.name, value: field.value })
  /** Value the user started editing from: sent as expected_value (RF-22). */
  const [baseValue, setBaseValue] = useState(field.value)
  const [formVersion, setFormVersion] = useState(0)
  const [formFocus, setFormFocus] = useState<FieldName | null>('name')
  const [failure, setFailure] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<ServerErrors | undefined>(undefined)
  const [conflictFromSave, setConflictFromSave] = useState(false)

  const rowRef = useRef<HTMLLIElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  const focusRef = useRef<FocusTarget | null>(null)

  // Focus moves once the element of the new state exists (no setState inside the effect).
  useEffect(() => {
    const target = focusRef.current
    if (!target) return
    const element =
      target === 'edit' ? editButtonRef.current : target === 'notice' ? noticeRef.current : rowRef.current
    if (!element) return
    focusRef.current = null
    element.focus()
  })

  const pending = isPendingField(field)
  const busy = pending || saving
  // Wialon now holds a value different from the one the user started from.
  const conflict = editing && field.value !== baseValue

  function openForm(values: CustomFieldFormInput, focus: FieldName | null, errors?: ServerErrors) {
    setDraft(values)
    setServerErrors(errors)
    setFormFocus(focus)
    setFormVersion((version) => version + 1)
    setEditing(true)
  }

  function startEdit() {
    setBaseValue(field.value)
    setFailure(null)
    setConflictFromSave(false)
    openForm({ name: field.name, value: field.value }, 'name')
  }

  function cancelEdit() {
    setEditing(false)
    setFailure(null)
    setConflictFromSave(false)
    setServerErrors(undefined)
    focusRef.current = 'edit'
  }

  function adoptCurrentValue() {
    setBaseValue(field.value)
    setConflictFromSave(false)
    setFailure(null)
    openForm({ name: field.name, value: field.value }, 'value')
  }

  async function save(values: CustomFieldFormValues, expectedValue: string) {
    if (values.name === field.name && values.value === field.value) {
      cancelEdit() // nothing to send: Wialon already holds exactly this
      return
    }
    setDraft(values)
    setBaseValue(expectedValue)
    setFailure(null)
    setServerErrors(undefined)
    setConflictFromSave(false)
    setEditing(false) // optimistic: the row shows the new value at once
    setSaving(true)
    focusRef.current = 'row'
    try {
      await update.mutateAsync({ fieldId: field.id, ...values, expected_value: expectedValue })
      setSaving(false)
      focusRef.current = 'edit'
      toast.show({ tone: 'success', title: 'Campo actualizado', description: `«${values.name}» se guardó en Wialon.` })
    } catch (error) {
      setSaving(false)
      await handleSaveError(error, values, expectedValue)
    }
  }

  async function handleSaveError(error: unknown, values: CustomFieldFormValues, expectedValue: string) {
    if (isApiError(error) && error.code === 'not_found') {
      toast.show({
        tone: 'error',
        title: 'El campo ya no existe',
        description: `«${field.name}» fue eliminado en Wialon. La lista se actualizó.`,
      })
      void refetchVehicleCustomFields(queryClient, vehicleId).catch(() => undefined)
      return
    }
    if (isApiError(error) && error.code === 'conflict') {
      // 409 means either "changed in Wialon" or "name taken": read the field again to know which.
      const latest = await refetchVehicleCustomFields(queryClient, vehicleId).catch(() => null)
      if (!latest) {
        setFailure(error.detail)
        focusRef.current = 'notice'
        openForm(values, null)
        return
      }
      const current = latest.find((item) => item.id === field.id)
      if (!current) {
        toast.show({
          tone: 'error',
          title: 'El campo ya no existe',
          description: `«${field.name}» fue eliminado en Wialon. La lista se actualizó.`,
        })
        return
      }
      if (current.name === values.name && current.value === values.value) {
        // A previous attempt whose answer was lost had already been applied.
        focusRef.current = 'edit'
        toast.show({ tone: 'success', title: 'Campo actualizado', description: 'El cambio ya estaba guardado en Wialon.' })
        return
      }
      if (current.value !== expectedValue) {
        setConflictFromSave(true)
        focusRef.current = 'notice'
        openForm(values, null)
        return
      }
      openForm(values, null, { name: error.detail })
      return
    }
    const fieldErrors = fieldErrorsFrom(error)
    if (Object.keys(fieldErrors).length > 0) {
      openForm(values, null, fieldErrors)
      return
    }
    setFailure(getErrorMessage(error, SAVE_FAILED))
    focusRef.current = 'notice'
    openForm(values, null)
  }

  function renderNotice(submitWith: SubmitWith) {
    if (conflict) {
      return (
        <Alert ref={noticeRef} focusable tone="warning" role="alert" title="Este campo cambió en Wialon mientras lo editabas">
          <p>
            {conflictFromSave ? 'Tu cambio no se guardó. ' : ''}
            Valor actual en Wialon: <strong>{field.value === '' ? '(vacío)' : `«${field.value}»`}</strong>.
          </p>
          <div className="cf-notice__actions">
            <Button size="sm" variant="secondary" icon={<RefreshIcon />} onClick={adoptCurrentValue}>
              Usar el valor actual
            </Button>
            <Button size="sm" variant="danger" onClick={() => submitWith((values) => save(values, field.value))}>
              Sobrescribir con mi valor
            </Button>
          </div>
        </Alert>
      )
    }
    if (failure) {
      return (
        <Alert ref={noticeRef} focusable tone="error" role="alert" title="No se guardó el cambio">
          <p>{failure} El valor anterior se mantiene.</p>
          <div className="cf-notice__actions">
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshIcon />}
              onClick={() => submitWith((values) => save(values, baseValue))}
            >
              Reintentar
            </Button>
          </div>
        </Alert>
      )
    }
    return null
  }

  return (
    <li
      ref={rowRef}
      className={['cf-item', busy && 'cf-item--busy', editing && 'cf-item--editing'].filter(Boolean).join(' ')}
      tabIndex={-1}
      aria-busy={busy || undefined}
    >
      {editing ? (
        <CustomFieldForm
          key={formVersion}
          label={`Editar el campo ${field.name}`}
          defaultValues={draft}
          takenNames={otherNames}
          submitLabel="Guardar cambios"
          serverErrors={serverErrors}
          initialFocus={formFocus}
          onSubmit={(values) => save(values, baseValue)}
          onCancel={cancelEdit}
          renderNotice={renderNotice}
        />
      ) : (
        <>
          <dl className="cf-item__data">
            <dt className="cf-item__name">{field.name}</dt>
            <dd className="cf-item__value">
              {field.value === '' ? <span className="muted-text">Sin valor</span> : field.value}
            </dd>
          </dl>
          {busy ? (
            <p className="cf-item__status">
              <Spinner size="sm" />
              <span>Guardando…</span>
            </p>
          ) : (
            canWrite && (
              <div className="cf-item__actions">
                <Button ref={editButtonRef} size="sm" variant="ghost" icon={<EditIcon />} onClick={startEdit}>
                  Editar{' '}<span className="visually-hidden">el campo {field.name}</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="cf-action--danger"
                  icon={<TrashIcon />}
                  onClick={() => onRequestDelete(field)}
                >
                  Eliminar{' '}<span className="visually-hidden">el campo {field.name}</span>
                </Button>
              </div>
            )
          )}
        </>
      )}
    </li>
  )
}

// ---------- Section ----------

interface DeleteFailure {
  field: CustomField
  message: string
}

type SectionFocus = 'heading' | 'add' | 'add-notice' | 'delete-notice'

export function CustomFieldsEditor({ vehicleId }: { vehicleId: number }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { hasPermission } = useAuth()
  const canWrite = hasPermission('vehicles:custom_fields:write')
  const fieldsQuery = useVehicleCustomFields(vehicleId)
  const create = useCreateVehicleCustomField(vehicleId)
  const remove = useDeleteVehicleCustomField(vehicleId)
  const pendingWrites = useCustomFieldWritesPending(vehicleId)

  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const addNoticeRef = useRef<HTMLDivElement>(null)
  const deleteNoticeRef = useRef<HTMLDivElement>(null)
  const focusRef = useRef<SectionFocus | null>(null)

  const [adding, setAdding] = useState(false)
  const [addFailure, setAddFailure] = useState<string | null>(null)
  const [addErrors, setAddErrors] = useState<ServerErrors | undefined>(undefined)
  const [confirming, setConfirming] = useState<CustomField | null>(null)
  const [deleteFailure, setDeleteFailure] = useState<DeleteFailure | null>(null)

  useEffect(() => {
    const target = focusRef.current
    if (!target) return
    const element = {
      heading: headingRef.current,
      add: addButtonRef.current,
      'add-notice': addNoticeRef.current,
      'delete-notice': deleteNoticeRef.current,
    }[target]
    if (!element) return
    focusRef.current = null
    element.focus()
  })

  const fields = fieldsQuery.data
  const confirmedNames = useMemo(
    () => (fields ?? []).filter((field) => !isPendingField(field)).map((field) => field.name),
    [fields],
  )

  function openAdd() {
    setAddFailure(null)
    setAddErrors(undefined)
    setAdding(true)
  }

  function closeAdd() {
    setAdding(false)
    setAddFailure(null)
    setAddErrors(undefined)
    focusRef.current = 'add'
  }

  async function submitAdd(values: CustomFieldFormValues) {
    setAddFailure(null)
    setAddErrors(undefined)
    try {
      const created = await create.mutateAsync(values)
      setAdding(false)
      focusRef.current = 'add'
      toast.show({ tone: 'success', title: 'Campo agregado', description: `«${created.name}» se guardó en Wialon.` })
    } catch (error) {
      if (isApiError(error) && error.code === 'conflict') {
        const latest = await refetchVehicleCustomFields(queryClient, vehicleId).catch(() => null)
        const existing = latest?.find((field) => normalizeFieldName(field.name) === normalizeFieldName(values.name))
        if (existing && existing.value === values.value) {
          // A previous attempt whose answer was lost had already created it.
          setAdding(false)
          focusRef.current = 'add'
          toast.show({ tone: 'success', title: 'Campo agregado', description: 'El campo ya estaba guardado en Wialon.' })
          return
        }
        setAddErrors({ name: error.detail })
        return
      }
      const fieldErrors = fieldErrorsFrom(error)
      if (Object.keys(fieldErrors).length > 0) {
        setAddErrors(fieldErrors)
        return
      }
      // The form stays mounted with the user's values; the error offers "Reintentar".
      setAddFailure(getErrorMessage(error, SAVE_FAILED))
      focusRef.current = 'add-notice'
    }
  }

  async function deleteField(field: CustomField) {
    setConfirming(null)
    setDeleteFailure(null)
    // The row disappears at once (optimistic): keep keyboard focus inside the section.
    focusRef.current = 'heading'
    try {
      await remove.mutateAsync(field)
      toast.show({ tone: 'success', title: 'Campo eliminado', description: `«${field.name}» se eliminó de Wialon.` })
    } catch (error) {
      if (isApiError(error) && error.code === 'not_found') {
        toast.show({ tone: 'info', title: 'El campo ya no existía', description: `«${field.name}» ya había sido eliminado en Wialon.` })
        return
      }
      setDeleteFailure({ field, message: getErrorMessage(error, 'No pudimos eliminar el campo en Wialon.') })
      focusRef.current = 'delete-notice'
    }
  }

  let content: ReactNode
  if (!fields && fieldsQuery.isError) {
    content = (
      <ErrorState
        headingLevel="h3"
        title="No pudimos cargar los campos personalizados"
        message={getErrorMessage(fieldsQuery.error)}
        onRetry={() => void fieldsQuery.refetch()}
        retrying={fieldsQuery.isFetching}
      />
    )
  } else if (!fields) {
    content = (
      <div className="cf-list" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="cf-item">
            <div className="cf-item__data">
              <Skeleton width="7rem" height="0.875rem" />
              <Skeleton width="12rem" />
            </div>
          </div>
        ))}
      </div>
    )
  } else if (fields.length === 0) {
    content = (
      <EmptyState
        headingLevel="h3"
        title="Este vehículo no tiene campos personalizados"
        description={
          canWrite
            ? 'Agrega el primero con «Agregar campo»: se guardará en Wialon.'
            : 'Cuando se agreguen en Wialon aparecerán aquí.'
        }
      />
    )
  } else {
    content = (
      <ul className="cf-list" role="list">
        {fields.map((field) => (
          <CustomFieldRow
            key={field.id}
            vehicleId={vehicleId}
            field={field}
            otherNames={fields.filter((other) => other.id !== field.id).map((other) => other.name)}
            canWrite={canWrite}
            onRequestDelete={setConfirming}
          />
        ))}
      </ul>
    )
  }

  return (
    <Card as="section" className="vehicle-detail__card vehicle-detail__card--wide" aria-labelledby={headingId}>
      <div className="card-head vehicle-detail__card-head">
        <div>
          <h2 id={headingId} ref={headingRef} tabIndex={-1} className="card-title">
            Campos personalizados
          </h2>
          <p className="card-subtitle">
            Datos adicionales del vehículo, guardados en Wialon.
            {!canWrite && ' Solo los roles Administrador y Operador pueden editarlos.'}
          </p>
        </div>
        {canWrite && fields && !adding && (
          <Button ref={addButtonRef} variant="secondary" size="sm" icon={<PlusIcon />} onClick={openAdd}>
            Agregar campo
          </Button>
        )}
      </div>

      {/* Persistent live region: "Guardando…" is announced even though rows render it visually. */}
      <p className="visually-hidden" role="status">
        {pendingWrites > 0 ? 'Guardando cambios en Wialon…' : ''}
      </p>

      {fieldsQuery.isError && fields && (
        <Alert
          tone="warning"
          role="status"
          title="No se pudo actualizar la lista"
          action={
            <Button size="sm" variant="secondary" onClick={() => void fieldsQuery.refetch()}>
              Reintentar
            </Button>
          }
        >
          {getErrorMessage(fieldsQuery.error)}
        </Alert>
      )}

      {deleteFailure && (
        <Alert
          ref={deleteNoticeRef}
          focusable
          tone="error"
          role="alert"
          title={`No se eliminó «${deleteFailure.field.name}»`}
        >
          <p>{deleteFailure.message} El campo sigue en la lista.</p>
          <div className="cf-notice__actions">
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshIcon />}
              onClick={() => void deleteField(deleteFailure.field)}
            >
              Reintentar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeleteFailure(null)}>
              Descartar aviso
            </Button>
          </div>
        </Alert>
      )}

      {content}

      {canWrite && adding && (
        <div className="cf-add">
          <h3 className="cf-add__title">Nuevo campo</h3>
          <CustomFieldForm
            label="Agregar campo personalizado"
            defaultValues={EMPTY_FIELD}
            takenNames={confirmedNames}
            submitLabel="Agregar campo"
            serverErrors={addErrors}
            onSubmit={submitAdd}
            onCancel={closeAdd}
            renderNotice={(submitWith) =>
              addFailure && (
                <Alert ref={addNoticeRef} focusable tone="error" role="alert" title="No se agregó el campo">
                  <p>{addFailure}</p>
                  <div className="cf-notice__actions">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<RefreshIcon />}
                      onClick={() => submitWith(submitAdd)}
                    >
                      Reintentar
                    </Button>
                  </div>
                </Alert>
              )
            }
          />
        </div>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title="¿Eliminar este campo?"
        description={
          confirming && (
            <p>
              Se eliminará <strong>«{confirming.name}»</strong> de este vehículo en Wialon. Esta acción no se
              puede deshacer.
            </p>
          )
        }
        confirmLabel="Eliminar campo"
        onConfirm={() => confirming && void deleteField(confirming)}
        onCancel={() => setConfirming(null)}
      />
    </Card>
  )
}
