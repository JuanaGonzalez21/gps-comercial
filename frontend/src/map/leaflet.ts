// Order matters: the global L must exist before the clustering plugin is evaluated.
import L from './leafletGlobal'
import 'leaflet.markercluster'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'

export default L
