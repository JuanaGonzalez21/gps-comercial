// Order matters: the global L must exist before the clustering plugin is evaluated.
import L from './leafletGlobal'
import 'leaflet.markercluster'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { installPageZoomGuard } from './pageZoomGuard'

// Once, for every map in the app (all of them load Leaflet through this module).
if (typeof document !== 'undefined') installPageZoomGuard()

export default L
