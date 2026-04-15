/**
 * DataLoader – fetches /data/events.json once during startup.
 * Replaces all Wikipedia API logic.
 */

let _eventsData = null

export async function loadEventsData() {
  if (_eventsData) return _eventsData

  const base = import.meta.env.BASE_URL || '/'
  const url = base.endsWith('/') ? `${base}data/events.json` : `${base}/data/events.json`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`[dataLoader] Failed to fetch events.json: ${res.status}`)
  _eventsData = await res.json()
  return _eventsData
}

export function getEventsData() {
  return _eventsData
}

/**
 * Returns the day names array (for lobby doors).
 */
export function getDayNames(data) {
  return Array.isArray(data?.days) ? data.days.map((d) => d.name) : []
}

/**
 * Returns the activities array for a given day name.
 */
export function getActivitiesForDay(data, dayName) {
  if (!Array.isArray(data?.days)) return []
  const day = data.days.find((d) => d.name === dayName)
  return Array.isArray(day?.activities) ? day.activities : []
}
