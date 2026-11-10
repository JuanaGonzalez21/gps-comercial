import './map-legend.css'

/**
 * Legend of the vehicle markers. The visible label is short (as in the design); the marker shape,
 * which also tells the statuses apart, is read to screen readers (never colour alone).
 */
export function MapLegend() {
  return (
    <ul className="map-legend" role="list" aria-label="Leyenda del mapa">
      <li>
        <span className="map-legend__swatch map-legend__swatch--moving" aria-hidden="true" />
        En movimiento<span className="visually-hidden"> (círculo con flecha de rumbo)</span>
      </li>
      <li>
        <span className="map-legend__swatch map-legend__swatch--stopped" aria-hidden="true" />
        Detenido<span className="visually-hidden"> (cuadrado)</span>
      </li>
      <li>
        <span className="map-legend__swatch map-legend__swatch--no_signal" aria-hidden="true" />
        Sin señal<span className="visually-hidden"> (rombo con exclamación)</span>
      </li>
    </ul>
  )
}
