import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useCreatePassenger, useUpdatePassenger } from '@/api/passengers'
import type { PassengerOut, ResourceOut } from '@/api/types'
import { applySubmitError } from '@/features/drivers/shared/formErrors'
import {
  blankToNull,
  codeField,
  CODE_MAX,
  nameField,
  NAME_MAX,
  phoneField,
  resourceField,
  toResourceId,
} from '@/features/drivers/shared/personSchema'
import { Alert, Button, Dialog, PlusIcon, SelectField, TextField, TrashIcon } from '@/ui'
import { FIELD_KEY_MAX, FIELD_VALUE_MAX, MAX_CUSTOM_FIELDS, newCustomFields } from './customFieldSchema'

// Create or edit a passenger (RF-08, RF-28). Creating accepts initial custom fields; editing
// changes the basic data only and the backend keeps every custom field as it is in Wialon (RF-27).

const passengerSchema = z.object({
  resource_id: resourceField,
  name: nameField,
  code: codeField,
  phone: phoneField,
  custom_fields: newCustomFields,
})
type PassengerFormInput = z.input<typeof passengerSchema>
type PassengerFormOutput = z.output<typeof passengerSchema>

const BASIC_FIELDS = ['name', 'code', 'phone']
const CUSTOM_FIELD_ERROR = /^custom_fields\.\d+\.(key|value)$/

interface PassengerFormDialogProps {
  /** null creates a new passenger. */
  passenger: PassengerOut | null
  resources: readonly ResourceOut[]
  onClose: () => void
  onSaved: (passenger: PassengerOut, created: boolean) => void
}

export function PassengerFormDialog({ passenger, resources, onClose, onSaved }: PassengerFormDialogProps) {
  const formId = useId()
  const fieldsTitleId = useId()
  const creating = passenger === null
  const showResource = creating && resources.length > 1
  const createPassenger = useCreatePassenger()
  const updatePassenger = useUpdatePassenger()
  const [failure, setFailure] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<PassengerFormInput, unknown, PassengerFormOutput>({
    resolver: zodResolver(passengerSchema),
    defaultValues: {
      resource_id: '',
      name: passenger?.name ?? '',
      code: passenger?.code ?? '',
      phone: passenger?.phone ?? '',
      custom_fields: [],
    },
  })
  const customFields = useFieldArray({ control, name: 'custom_fields' })

  useEffect(() => {
    setFocus('name')
  }, [setFocus])

  useEffect(() => {
    if (failure) errorRef.current?.focus()
  }, [failure])

  const isFormField = (name: string) =>
    BASIC_FIELDS.includes(name) ||
    (showResource && name === 'resource_id') ||
    (creating && CUSTOM_FIELD_ERROR.test(name))

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null)
    const basic = { name: values.name, code: blankToNull(values.code), phone: blankToNull(values.phone) }
    try {
      const saved = passenger
        ? await updatePassenger.mutateAsync({ ref: passenger, input: basic })
        : await createPassenger.mutateAsync({
            ...basic,
            resource_id: toResourceId(values.resource_id),
            custom_fields: values.custom_fields,
          })
      onSaved(saved, creating)
    } catch (error) {
      setFailure(applySubmitError(error, setError, isFormField).message)
    }
  })

  const arrayError = errors.custom_fields?.message ?? errors.custom_fields?.root?.message

  return (
    <Dialog
      open
      size={creating ? 'lg' : 'md'}
      title={creating ? 'Nuevo pasajero' : `Editar a «${passenger.name}»`}
      description={<p>Los cambios se guardan en Wialon. Los campos con * son obligatorios.</p>}
      onClose={onClose}
      busy={isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={isSubmitting} loadingText="Guardando…">
            {creating ? 'Crear pasajero' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <form id={formId} className="roster-form" noValidate onSubmit={onSubmit}>
        {failure && (
          <Alert ref={errorRef} focusable tone="error" role="alert" title="No se pudo guardar el pasajero">
            {failure}
          </Alert>
        )}
        {showResource && (
          <SelectField
            label="Recurso de Wialon"
            hint="Wialon guarda cada pasajero dentro de un recurso."
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

        {creating ? (
          <section className="passenger-new-fields" aria-labelledby={fieldsTitleId}>
            <h3 id={fieldsTitleId} className="passenger-new-fields__title">
              Campos personalizados <span className="passenger-new-fields__optional">(opcional)</span>
            </h3>
            <p className="field__hint">
              Clave de hasta {FIELD_KEY_MAX} caracteres y valor de hasta {FIELD_VALUE_MAX}. Podrás editarlos
              después.
            </p>
            {customFields.fields.map((item, index) => (
              <fieldset key={item.id} className="passenger-new-field">
                <legend className="visually-hidden">Campo personalizado {index + 1}</legend>
                <TextField
                  label={`Clave del campo ${index + 1}`}
                  isRequired
                  autoComplete="off"
                  error={errors.custom_fields?.[index]?.key?.message}
                  {...register(`custom_fields.${index}.key`)}
                />
                <TextField
                  label={`Valor del campo ${index + 1}`}
                  autoComplete="off"
                  error={errors.custom_fields?.[index]?.value?.message}
                  {...register(`custom_fields.${index}.value`)}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<TrashIcon />}
                  className="passenger-new-field__remove"
                  onClick={() => customFields.remove(index)}
                >
                  Quitar <span className="visually-hidden">el campo {index + 1}</span>
                </Button>
              </fieldset>
            ))}
            {arrayError && (
              <p className="field__error" role="alert">
                {arrayError}
              </p>
            )}
            <Button
              size="sm"
              variant="secondary"
              icon={<PlusIcon />}
              disabled={customFields.fields.length >= MAX_CUSTOM_FIELDS}
              onClick={() => customFields.append({ key: '', value: '' })}
            >
              Agregar campo
            </Button>
          </section>
        ) : (
          <p className="field__hint">
            Los campos personalizados se editan desde «Campos» en la lista y se conservan al guardar estos cambios.
          </p>
        )}
      </form>
    </Dialog>
  )
}
