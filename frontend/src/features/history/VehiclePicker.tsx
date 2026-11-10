import { useId, useState, type ChangeEvent, type KeyboardEvent, type Ref } from 'react'
import { useHistoryVehicle, useVehicleOptions } from '@/api/history'
import { formatNumber } from '@/lib/format'
import { useDebouncedValue } from '@/lib/hooks'
import { Button, RefreshIcon, SearchIcon, SelectField, TextField, type SelectOption } from '@/ui'

const SEARCH_DEBOUNCE_MS = 300

export interface VehiclePickerProps {
  /** Selected vehicle id as a string ('' = none), as held by the form. */
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  name: string
  selectRef: Ref<HTMLSelectElement>
  error?: string
}

/**
 * Searchable vehicle selector built from native controls (fully keyboard and screen reader
 * friendly): a search box filters on the server, a select lists the matches. The current choice
 * is always kept as an option, even when a new search does not include it.
 *
 * Renders three cells of the query grid (search, list status, select), so the select lines up
 * with the date fields as in the design; the status describes both controls.
 */
export function VehiclePicker({ value, onChange, onBlur, name, selectRef, error }: VehiclePickerProps) {
  const statusId = useId()
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS)
  const options = useVehicleOptions(search)
  const [chosen, setChosen] = useState<{ id: number; name: string } | null>(null)

  const items = options.data?.items ?? []
  const selectedId = value ? Number(value) : null
  const listedName = items.find((vehicle) => vehicle.id === selectedId)?.name
  const knownName = listedName ?? (chosen && chosen.id === selectedId ? chosen.name : undefined)
  // A vehicle chosen through the URL (?vehicle=ID) may not be in the first page of options.
  const lookup = useHistoryVehicle(
    selectedId !== null && knownName === undefined && !options.isPending ? selectedId : null,
  )
  const selectedLabel =
    knownName ??
    lookup.data?.name ??
    (lookup.isError ? `Vehículo ${selectedId} (no disponible)` : `Vehículo ${selectedId}`)

  const selectOptions: SelectOption[] = [{ value: '', label: 'Selecciona un vehículo' }]
  if (selectedId !== null && listedName === undefined) {
    selectOptions.push({ value: String(selectedId), label: selectedLabel })
  }
  for (const vehicle of items) selectOptions.push({ value: String(vehicle.id), label: vehicle.name })

  let listStatus: string
  if (options.isPending) listStatus = 'Cargando vehículos…'
  else if (!options.data) listStatus = 'No pudimos cargar la lista de vehículos.'
  else if (options.isPlaceholderData) listStatus = 'Buscando vehículos…'
  else if (options.data.total === 0) {
    listStatus = search ? `Ningún vehículo coincide con «${search}».` : 'No hay vehículos disponibles.'
  } else if (options.data.total > items.length) {
    listStatus = `Se muestran ${formatNumber(items.length)} de ${formatNumber(options.data.total)} vehículos. Escribe en el buscador para afinar.`
  } else {
    listStatus =
      options.data.total === 1
        ? search
          ? '1 vehículo coincide con la búsqueda.'
          : '1 vehículo disponible.'
        : search
          ? `${formatNumber(options.data.total)} vehículos coinciden con la búsqueda.`
          : `${formatNumber(options.data.total)} vehículos disponibles.`
  }

  const handleSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const id = Number(event.target.value)
    const match = items.find((vehicle) => vehicle.id === id)
    if (match) setChosen({ id: match.id, name: match.name })
    onChange(event.target.value)
  }

  // Enter in the search box filters; it must not submit the history form.
  const preventSubmit = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.preventDefault()
  }

  return (
    <>
      <TextField
        type="search"
        label="Buscar vehículo"
        placeholder="Parte del nombre"
        leadingIcon={<SearchIcon />}
        describedBy={statusId}
        fieldClassName="history-form__search"
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        onKeyDown={preventSubmit}
        autoComplete="off"
        enterKeyHint="search"
      />
      <div className="history-form__list-status">
        <p id={statusId} role="status">
          {listStatus}
        </p>
        {options.isError && !options.data && (
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshIcon />}
            onClick={() => void options.refetch()}
            loading={options.isFetching}
            loadingText="Reintentando…"
          >
            Reintentar
          </Button>
        )}
      </div>
      <SelectField
        label="Vehículo"
        isRequired
        name={name}
        ref={selectRef}
        value={value}
        onChange={handleSelect}
        onBlur={onBlur}
        options={selectOptions}
        error={error}
        describedBy={statusId}
      />
    </>
  )
}
