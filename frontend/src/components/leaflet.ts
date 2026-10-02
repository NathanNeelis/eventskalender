import L from 'leaflet'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Bundlers break Leaflet's default icon URL detection; point it at the bundled assets.
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })

export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/** Default map centre: the Netherlands. */
export const DEFAULT_CENTER: [number, number] = [52.1, 5.3]
