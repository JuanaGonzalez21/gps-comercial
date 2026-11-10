import L from 'leaflet'

// leaflet.markercluster is a UMD script that extends the global `L` instead of importing Leaflet.
// Leaflet's UMD build already assigns window.L; doing it here as well, in a module evaluated
// before the plugin (ES imports run in order), keeps that true whatever the bundler does.
const globalScope = globalThis as typeof globalThis & { L?: typeof L }
globalScope.L ??= L

export default L
