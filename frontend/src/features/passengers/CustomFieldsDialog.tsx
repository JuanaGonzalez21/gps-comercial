import { zodResolver } from '@hookform/resolvers/zod'
import { useIsMutating } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { getErrorMessage, isApiError } from '@/api/errors'
import {
  customFieldMutationKey,
  isPathSafeFieldKey,
  useCreatePassengerCustomField,
  useDeletePassengerCustomField,
  usePassengerCustomFields,
  useUpdatePassengerCustomField,
} from '@/api/passengers'
import type { ResourceScopedRef } from '@/api/resources'
import type { PassengerCustomField, PassengerOut } from '@/api/types'
import { isRetryableError } from '@/features/drivers/shared/formErrors'
import { Alert, Button, Dialog, EditIcon, EmptyState, PlusIcon, Spinner, TextField, TrashIcon } from '@/ui'
import { customFieldSchema, MAX_CUSTOM_FIELDS } from './customFieldSchema'

// Editor of one passenger's custom fields (RF-27). Each change is one request; the backend reads
// the passenger and merges it into the complete set, so no other field is lost. Writes run one at
// a time (two parallel merges could overwrite each other) and every result is re-read from Wialon.

type FieldForm = { key: string; value: string }

interface Notice {
  tone: 'success' | 'error'
  text: string
}

interface Failure {
  message: string
  retryable: boolean
}

function toFailure(error: unknown): Failure {
  const message = getErrorMessage(error, 'No se pudo guardar el campo. Inténtalo de nuevo.')
  // 404/409: someone changed the passenger meanwhile; the list is re-read right away.
  const stale = isApiError(error) && (error.code === 'not_found' || error.code === 'conflict')
  return { message: stale ? `${message} La lista se actualizó con los datos de Wialon.` : message, retryable: isRetryableError(error) }
}

function FailureAlert({ title, failure, onRetry }: { title: string; failure: Failure; onRetry: () => void }) {
  return (
    <Alert
      tone="error"
      role="alert"
      title={title}
      action={
        failure.retryable ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Reintentar
          </Button>
        ) : undefined
      }
    >
      {failure.message}
    </Alert>
  )
}

interface CustomFieldRowProps {
  passengerRef: ResourceScopedRef
  field: PassengerCustomField
  otherKeys: string[]
  canEdit: boolean
  /** Another write is running: wait for it before starting a new one. */
  locked: boolean
  focusRequested: boolean
  onFocused: () => void
  onNotice: (notice: Notice) => void
  onRemoved: () => void
  onSaved: (key: string) => void
}

function CustomFieldRow({
  passengerRef,
  field,
  otherKeys,
  canEdit,
  locked,
  focusRequested,
  onFocused,
  onNotice,
  onRemoved,
  onSaved,
}: CustomFieldRowProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view')
  const [failure, setFailure] = useState<Failure | null>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const questionRef = useRef<HTMLParagraphElement>(null)
  const update = useUpdatePassengerCustomField(passengerRef)
  const remove = useDeletePassengerCustomField(passengerRef)
  const editable = canEdit && isPathSafeFieldKey(field.key)

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<FieldForm>({
    resolver: zodResolver(customFieldSchema(otherKeys)),
    defaultValues: { key: field.key, value: field.value },
  })

  useEffect(() => {
    if (mode === 'edit') setFocus('value')
    if (mode === 'delete') questionRef.current?.focus()
  }, [mode, setFocus])

  useEffect(() => {
    if (!focusRequested || mode !== 'view') return
    editButtonRef.current?.focus()
    onFocused()
  }, [focusRequested, mode, onFocused])

  const startEditing = () => {
    // Start from the value on screen now (it may have been re-read from Wialon meanwhile).
    reset({ key: field.key, value: field.value })
    setFailure(null)
    setMode('edit')
  }

  const backToView = () => {
    setFailure(null)
    setMode('view')
  }

  const save = async (values: FieldForm) => {
    setFailure(null)
    const renamed = values.key !== field.key
    try {
      const saved = await update.mutateAsync({
        key: field.key,
        input: renamed ? { value: values.value, new_key: values.key } : { value: values.value },
      })
      setMode('view')
      onNotice({
        tone: 'success',
        text: renamed
          ? `El campo «${field.key}» ahora se llama «${saved.key}». Cambio guardado en Wialon.`
          : `Campo «${field.key}» guardado en Wialon.`,
      })
      onSaved(saved.key)
    } catch (error) {
      if (isApiError(error) && error.code === 'not_found') {
        onNotice({ tone: 'error', text: toFailure(error).message })
      }
      setFailure(toFailure(error))
    }
  }

  const confirmDelete = async () => {
    setFailure(null)
    try {
      await remove.mutateAsync(field.key)
      onNotice({ tone: 'success', text: `Campo «${field.key}» eliminado de Wialon. Los demás se conservaron.` })
      onRemoved()
    } catch (error) {
      if (isApiError(error) && error.code === 'not_found') {
        onNotice({ tone: 'error', text: toFailure(error).message })
      }
      setFailure(toFailure(error))
    }
  }

  if (mode === 'edit') {
    return (
      <li className="passenger-field passenger-field--active">
        <form
          className="passenger-field__form"
          noValidate
          aria-label={`Editar el campo ${field.key}`}
          onSubmit={handleSubmit(save)}
        >
          <div className="roster-form__pair">
            <TextField label="Clave" isRequired autoComplete="off" error={errors.key?.message} {...register('key')} />
            <TextField label="Valor" autoComplete="off" error={errors.value?.message} {...register('value')} />
          </div>
          {failure && (
            <FailureAlert
              title="No se pudo guardar el campo"
              failure={failure}
              // The typed values are still in the form: submit them again.
              onRetry={() => void handleSubmit(save)()}
            />
          )}
          <div className="passenger-field__actions">
            <Button type="submit" size="sm" loading={update.isPending} loadingText="Guardando…" disabled={locked && !update.isPending}>
              Guardar campo
            </Button>
            <Button size="sm" variant="secondary" onClick={backToView} disabled={update.isPending}>
              Cancelar
            </Button>
          </div>
        </form>
      </li>
    )
  }

  if (mode === 'delete') {
    return (
      <li className="passenger-field passenger-field--active">
        <p ref={questionRef} tabIndex={-1} className="passenger-field__question">
          ¿Eliminar el campo «{field.key}»? Los demás campos del pasajero se conservan.
        </p>
        {failure && <FailureAlert title="No se pudo eliminar el campo" failure={failure} onRetry={() => void confirmDelete()} />}
        <div className="passenger-field__actions">
          <Button
            size="sm"
            variant="danger"
            loading={remove.isPending}
            loadingText="Eliminando…"
            disabled={locked && !remove.isPending}
            onClick={() => void confirmDelete()}
          >
            Eliminar campo
          </Button>
          <Button size="sm" variant="secondary" onClick={backToView} disabled={remove.isPending}>
            Cancelar
          </Button>
        </div>
      </li>
    )
  }

  return (
    <li className="passenger-field">
      <div className="passenger-field__content">
        <p className="passenger-field__key">{field.key}</p>
        <p className="passenger-field__value">{field.value || <span className="roster-muted">Sin valor</span>}</p>
      </div>
      {editable && (
        <div className="passenger-field__actions">
          <Button
            ref={editButtonRef}
            size="sm"
            variant="ghost"
            icon={<EditIcon />}
            disabled={locked}
            onClick={startEditing}
          >
            Editar <span className="visually-hidden">el campo {field.key}</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<TrashIcon />}
            className="passenger-field__delete"
            disabled={locked}
            onClick={() => {
              setFailure(null)
              setMode('delete')
            }}
          >
            Eliminar <span className="visually-hidden">el campo {field.key}</span>
          </Button>
        </div>
      )}
      {canEdit && !editable && (
        <p className="passenger-field__note">Esta clave no se puede editar desde la aplicación; usa Wialon.</p>
      )}
    </li>
  )
}

function AddCustomFieldForm({
  passengerRef,
  existingKeys,
  locked,
  onNotice,
}: {
  passengerRef: ResourceScopedRef
  existingKeys: string[]
  locked: boolean
  onNotice: (notice: Notice) => void
}) {
  const titleId = useId()
  const create = useCreatePassengerCustomField(passengerRef)
  const [failure, setFailure] = useState<Failure | null>(null)
  const full = existingKeys.length >= MAX_CUSTOM_FIELDS

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<FieldForm>({
    resolver: zodResolver(customFieldSchema(existingKeys)),
    defaultValues: { key: '', value: '' },
  })

  const add = async (values: FieldForm) => {
    setFailure(null)
    try {
      await create.mutateAsync(values)
      reset({ key: '', value: '' })
      setFocus('key') // ready for the next one
      onNotice({ tone: 'success', text: `Campo «${values.key}» agregado en Wialon.` })
    } catch (error) {
      setFailure(toFailure(error))
    }
  }

  return (
    <form className="passenger-fields__add" noValidate aria-labelledby={titleId} onSubmit={handleSubmit(add)}>
      <h3 id={titleId} className="passenger-fields__title">
        Agregar campo
      </h3>
      {full ? (
        <p className="field__hint">Este pasajero ya tiene el máximo de {MAX_CUSTOM_FIELDS} campos.</p>
      ) : (
        <>
          <div className="roster-form__pair">
            <TextField
              label="Clave del nuevo campo"
              isRequired
              autoComplete="off"
              placeholder="Ej.: Empresa"
              error={errors.key?.message}
              {...register('key')}
            />
            <TextField
              label="Valor del nuevo campo"
              autoComplete="off"
              error={errors.value?.message}
              {...register('value')}
            />
          </div>
          {failure && (
            <FailureAlert
              title="No se pudo agregar el campo"
              failure={failure}
              onRetry={() => void handleSubmit(add)()}
            />
          )}
          <div>
            <Button
              type="submit"
              size="sm"
              icon={<PlusIcon />}
              loading={create.isPending}
              loadingText="Guardando…"
              disabled={locked && !create.isPending}
            >
              Agregar campo
            </Button>
          </div>
        </>
      )}
    </form>
  )
}

interface CustomFieldsDialogProps {
  passenger: PassengerOut
  canEdit: boolean
  onClose: () => void
}

export function CustomFieldsDialog({ passenger, canEdit, onClose }: CustomFieldsDialogProps) {
  const passengerRef: ResourceScopedRef = { resource_id: passenger.resource_id, id: passenger.id }
  const listTitleId = useId()
  const fields = usePassengerCustomFields(passengerRef, passenger.custom_fields)
  const writing = useIsMutating({ mutationKey: customFieldMutationKey(passengerRef) }) > 0
  const [notice, setNotice] = useState<Notice | null>(null)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const listTitleRef = useRef<HTMLHeadingElement>(null)

  const items = fields.data ?? []
  const keys = items.map((field) => field.key)

  return (
    <Dialog
      open
      size="lg"
      title={`Campos personalizados de «${passenger.name}»`}
      description={
        <p>
          {canEdit
            ? 'Cada cambio se guarda en Wialon por separado y conserva los demás campos.'
            : 'Solo lectura: tu rol no permite editar campos.'}
        </p>
      }
      onClose={onClose}
      busy={writing}
      footer={
        <Button variant="secondary" onClick={onClose} disabled={writing}>
          Cerrar
        </Button>
      }
    >
      <div className="passenger-fields">
        {/* Live region present from the start, so every result is announced. */}
        <div role="status" className="passenger-fields__notice">
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        </div>

        {fields.isError && (
          <Alert
            tone="warning"
            title="No pudimos leer los campos actuales en Wialon"
            action={
              <Button size="sm" variant="secondary" onClick={() => void fields.refetch()} loading={fields.isFetching}>
                Reintentar
              </Button>
            }
          >
            {`Se muestran los datos de la lista. ${getErrorMessage(fields.error)}`}
          </Alert>
        )}

        <section aria-labelledby={listTitleId} className="passenger-fields__section">
          <div className="passenger-fields__header">
            <h3 id={listTitleId} ref={listTitleRef} tabIndex={-1} className="passenger-fields__title">
              Campos actuales ({items.length})
            </h3>
            {fields.isFetching && (
              <span className="roster-saving">
                <Spinner size="sm" />
                <span>Actualizando desde Wialon…</span>
              </span>
            )}
          </div>
          {items.length === 0 ? (
            <EmptyState
              headingLevel="h3"
              title="Este pasajero no tiene campos personalizados"
              description={canEdit ? 'Agrega el primero con el formulario de abajo.' : undefined}
            />
          ) : (
            <ul className="passenger-fields__list" role="list">
              {items.map((field) => (
                <CustomFieldRow
                  key={field.key}
                  passengerRef={passengerRef}
                  field={field}
                  otherKeys={keys.filter((key) => key !== field.key)}
                  canEdit={canEdit}
                  locked={writing}
                  focusRequested={focusKey === field.key}
                  onFocused={() => setFocusKey(null)}
                  onNotice={setNotice}
                  onSaved={setFocusKey}
                  onRemoved={() => listTitleRef.current?.focus()}
                />
              ))}
            </ul>
          )}
        </section>

        {canEdit && (
          <AddCustomFieldForm passengerRef={passengerRef} existingKeys={keys} locked={writing} onNotice={setNotice} />
        )}
      </div>
    </Dialog>
  )
}
