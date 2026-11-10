import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useCreateDriver, useUpdateDriver } from '@/api/drivers'
import type { DriverOut, ResourceOut } from '@/api/types'
import { Alert, Button, Dialog, SelectField, TextField } from '@/ui'
import { applySubmitError } from './shared/formErrors'
import {
  blankToNull,
  codeField,
  CODE_MAX,
  DESCRIPTION_MAX,
  descriptionField,
  nameField,
  NAME_MAX,
  phoneField,
  resourceField,
  toResourceId,
} from './shared/personSchema'
import { TextAreaField } from './shared/TextAreaField'

// Create or edit a driver (RF-16, RF-18). Declarative validation with zod mirrors the backend;
// the server's 422/409 answers are shown on the same fields.

const driverSchema = z.object({
  resource_id: resourceField,
  name: nameField,
  code: codeField,
  phone: phoneField,
  description: descriptionField,
})
type DriverFormInput = z.input<typeof driverSchema>
type DriverFormOutput = z.output<typeof driverSchema>

interface DriverFormDialogProps {
  /** null creates a new driver. */
  driver: DriverOut | null
  resources: readonly ResourceOut[]
  onClose: () => void
  onSaved: (driver: DriverOut, created: boolean) => void
}

export function DriverFormDialog({ driver, resources, onClose, onSaved }: DriverFormDialogProps) {
  const formId = useId()
  const creating = driver === null
  // Ids are scoped by resource: the choice only matters when the account has several.
  const showResource = creating && resources.length > 1
  const createDriver = useCreateDriver()
  const updateDriver = useUpdateDriver()
  const [failure, setFailure] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<DriverFormInput, unknown, DriverFormOutput>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      resource_id: '',
      name: driver?.name ?? '',
      code: driver?.code ?? '',
      phone: driver?.phone ?? '',
      description: driver?.description ?? '',
    },
  })

  // The dialog has just opened (its effect runs first): start on the main field.
  useEffect(() => {
    setFocus('name')
  }, [setFocus])

  useEffect(() => {
    if (failure) errorRef.current?.focus()
  }, [failure])

  const fieldNames = new Set(['name', 'code', 'phone', 'description', ...(showResource ? ['resource_id'] : [])])

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null)
    const input = {
      name: values.name,
      code: blankToNull(values.code),
      phone: blankToNull(values.phone),
      description: blankToNull(values.description),
    }
    try {
      const saved = driver
        ? await updateDriver.mutateAsync({ ref: driver, input })
        : await createDriver.mutateAsync({ ...input, resource_id: toResourceId(values.resource_id) })
      onSaved(saved, creating)
    } catch (error) {
      setFailure(applySubmitError(error, setError, (name) => fieldNames.has(name)).message)
    }
  })

  return (
    <Dialog
      open
      title={creating ? 'Nuevo conductor' : `Editar a «${driver.name}»`}
      description={<p>Los cambios se guardan en Wialon. Los campos con * son obligatorios.</p>}
      onClose={onClose}
      busy={isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={isSubmitting} loadingText="Guardando…">
            {creating ? 'Crear conductor' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <form id={formId} className="roster-form" noValidate onSubmit={onSubmit}>
        {failure && (
          <Alert ref={errorRef} focusable tone="error" role="alert" title="No se pudo guardar el conductor">
            {failure}
          </Alert>
        )}
        {showResource && (
          <SelectField
            label="Recurso de Wialon"
            hint="Wialon guarda cada conductor dentro de un recurso."
            options={[
              { value: '', label: 'Recurso predeterminado' },
              ...resources.map((resource) => ({ value: String(resource.id), label: resource.name })),
            ]}
            error={errors.resource_id?.message}
            {...register('resource_id')}
          />
        )}
        <TextField
          label="Nombre"
          isRequired
          autoComplete="off"
          hint={`Máximo ${NAME_MAX} caracteres.`}
          error={errors.name?.message}
          {...register('name')}
        />
        <div className="roster-form__pair">
          <TextField
            label="Código"
            autoComplete="off"
            hint={`Opcional, único. Máx. ${CODE_MAX}.`}
            error={errors.code?.message}
            {...register('code')}
          />
          <TextField
            label="Teléfono"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="+57 300 123 4567"
            hint="Opcional."
            error={errors.phone?.message}
            {...register('phone')}
          />
        </div>
        <TextAreaField
          label="Descripción"
          hint={`Opcional. Máximo ${DESCRIPTION_MAX} caracteres.`}
          rows={3}
          error={errors.description?.message}
          {...register('description')}
        />
      </form>
    </Dialog>
  )
}
