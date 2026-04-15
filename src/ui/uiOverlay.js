/**
 * uiOverlay.js – Activity Modal (DOM layer, outside WebGL canvas).
 * Bridge between Three.js raycaster clicks and the HTML UI.
 */

import { replaceEmojisAndArrowsToHtml, getIconUrl, ARROW_ICON } from './emojiMap.js'
import { resetMobileState, destroyMobileControls, initMobileControls, isMobileDevice } from './mobileControls.js'

let _modal = null
let _onClose = null

const LOGO_URL = 'https://guapiles.ucr.ac.cr/wp-content/uploads/2024/02/UCR01.png'

export function initActivityModal({ onClose } = {}) {
  _onClose = onClose

  const existing = document.getElementById('activity-modal')
  if (existing) {
    _modal = existing
    _bindEvents()
    return
  }

  const container = document.createElement('div')
  container.id = 'activity-modal'
  container.setAttribute('role', 'dialog')
  container.setAttribute('aria-modal', 'true')
  container.setAttribute('aria-labelledby', 'activity-modal-title')
  container.innerHTML = `
    <div id="activity-modal-backdrop"></div>
    <div id="activity-modal-panel">
      <button id="activity-modal-close" aria-label="Cerrar">&times;</button>
      <div id="activity-modal-header">
        <img id="modal-logo" src="${LOGO_URL}" alt="UCR logo" class="modal-logo" />
        <h2 id="activity-modal-title"></h2>
      </div>
      <div id="activity-modal-body">
        <div id="activity-modal-text"></div>
      </div>
      <div id="activity-modal-footer">
        <a
          id="activity-modal-link"
          class="modal-action"
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          style="display:none"
        >IR AL FORMULARIO <img class="inline-icon arrow-icon" src="${getIconUrl(ARROW_ICON)}" alt="->" /></a>
        <a
          id="activity-modal-calendar"
          class="modal-action"
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          style="display:none; margin-left:12px"
        >AÑADIR A CALENDARIO</a>
      </div>
    </div>
  `
  document.body.appendChild(container)
  _modal = container
  _bindEvents()
}

function _bindEvents() {
  const closeBtn = document.getElementById('activity-modal-close')
  const backdrop = document.getElementById('activity-modal-backdrop')

  if (closeBtn) closeBtn.addEventListener('click', closeActivityModal)
  if (backdrop) backdrop.addEventListener('click', closeActivityModal)

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && _modal && _modal.classList.contains('visible')) {
      closeActivityModal()
    }
  })
}

/**
 * Show the modal with the given activity object { title, full_text, link }.
 */
export function showActivityModal(activity) {
  if (!_modal) return

  const titleEl = document.getElementById('activity-modal-title')
  const textEl = document.getElementById('activity-modal-text')
  const linkEl = document.getElementById('activity-modal-link')

  if (titleEl) titleEl.innerHTML = replaceEmojisAndArrowsToHtml(activity.title || '')
  if (textEl) textEl.innerHTML = replaceEmojisAndArrowsToHtml(activity.full_text || '')

  const hasLink = typeof activity.link === 'string' && activity.link.trim().length > 0
  if (linkEl) {
    if (hasLink) {
      linkEl.href = activity.link.trim()
      linkEl.style.display = 'inline-flex'
    } else {
      linkEl.href = '#'
      linkEl.style.display = 'none'
    }
  }

  // Configure calendar button
  try {
    const calEl = document.getElementById('activity-modal-calendar')
    if (calEl) {
      const url = buildGoogleCalendarUrl(activity)
      if (url) {
        calEl.href = url
        calEl.style.display = 'inline-flex'
      } else {
        calEl.href = '#'
        calEl.style.display = 'none'
      }
    }
  } catch (e) {}

  // Tear down mobile controls while modal is open to avoid stuck/capture issues
  try { destroyMobileControls() } catch (e) {}
  _modal.classList.add('visible')
  document.body.classList.add('modal-open')
}

// Build a Google Calendar event creation URL (TEMPLATE). If date/time can be parsed, include dates.
function buildGoogleCalendarUrl(activity) {
  if (!activity) return null
  const title = (activity.title || '').trim()
  let details = (activity.full_text || '').trim()
  if (typeof activity.link === 'string' && activity.link.trim()) {
    details += '\n\nFormulario: ' + activity.link.trim()
  }

  // attempt to parse date and time from activity.full_text
  const text = activity.full_text || ''
  const dateMatch = text.match(/Fecha(?:\s*de\s*inicio)?\s*:\s*([^\n\r]+)/i)
  const timeMatch = text.match(/Hora(?:\s*de\s*inicio)?\s*:\s*([^\n\r]+)/i)
  const rangeMatch = text.match(/De\s+([^\n\r]+?)\s+(?:a|hasta|-)\s+([^\n\r]+)/i)

  let datesParam = null
  try {
    const monthMap = {
      enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
    }

    function parseDateStr(s) {
      if (!s) return null
      // try to find day number and month name and optional year
      const m = s.match(/(\d{1,2})\s*(?:de\s*)?([A-Za-zñÑ]+)/i)
      let year = (new Date()).getFullYear()
      const yMatch = s.match(/(19|20)\d{2}/)
      if (yMatch) year = parseInt(yMatch[0], 10)
      if (m) {
        const day = parseInt(m[1], 10)
        const monthName = m[2].toLowerCase()
        const mm = monthMap[monthName]
        if (mm) return { year, month: mm, day }
      }
      return null
    }

    function parseTimeStr(s) {
      if (!s) return null
      let ss = String(s).toLowerCase().replace(/\./g, '').trim()
      // handle 'm.d.' -> midday
      if (ss.indexOf('m d') !== -1 || ss.indexOf('md') !== -1 || ss.indexOf('md') !== -1) {
        return { hour: 12, minute: 0 }
      }
      const am = /a\s?m\b/.test(ss) || /am\b/.test(ss)
      const pm = /p\s?m\b/.test(ss) || /pm\b/.test(ss)
      const num = ss.match(/(\d{1,2})(?::(\d{2}))?/)
      if (!num) return null
      let h = parseInt(num[1], 10)
      const m2 = num[2] ? parseInt(num[2], 10) : 0
      if (pm && h < 12) h += 12
      if (am && h === 12) h = 0
      return { hour: h, minute: m2 }
    }

    let startObj = null
    let endObj = null
    if (dateMatch) {
      const d = parseDateStr(dateMatch[1])
      if (d) startObj = { date: d }
    }
    if (timeMatch && startObj) {
      const t = parseTimeStr(timeMatch[1])
      if (t) startObj.time = t
    }
    if (rangeMatch && startObj) {
      // try to parse end time from range
      const t1 = parseTimeStr(rangeMatch[1])
      const t2 = parseTimeStr(rangeMatch[2])
      if (t1 && !startObj.time) startObj.time = t1
      if (t2) endObj = { date: startObj.date, time: t2 }
    }

    if (startObj && startObj.date) {
      const y = startObj.date.year
      const mo = startObj.date.month
      const da = String(startObj.date.day).padStart(2, '0')
      if (startObj.time) {
        const hh = String(startObj.time.hour).padStart(2, '0')
        const mm = String(startObj.time.minute).padStart(2, '0')
        const startStr = `${y}${mo}${da}T${hh}${mm}00`
        let endStr = null
        if (endObj && endObj.time) {
          const eh = String(endObj.time.hour).padStart(2, '0')
          const em = String(endObj.time.minute).padStart(2, '0')
          endStr = `${y}${mo}${da}T${eh}${em}00`
        } else {
          // default 1 hour
          const dt = new Date(y, parseInt(mo, 10) - 1, startObj.date.day, startObj.time.hour, startObj.time.minute)
          dt.setHours(dt.getHours() + 1)
          const ey = dt.getFullYear()
          const emo = String(dt.getMonth() + 1).padStart(2, '0')
          const eda = String(dt.getDate()).padStart(2, '0')
          const eh = String(dt.getHours()).padStart(2, '0')
          const em = String(dt.getMinutes()).padStart(2, '0')
          endStr = `${ey}${emo}${eda}T${eh}${em}00`
        }
        datesParam = `${startStr}/${endStr}`
      } else {
        // all-day event
        const startAll = `${y}${mo}${da}`
        datesParam = `${startAll}/${startAll}`
      }
    }
  } catch (e) {
    datesParam = null
  }

  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
  const parts = []
  if (title) parts.push('text=' + encodeURIComponent(title))
  if (details) parts.push('details=' + encodeURIComponent(details))
  // try to extract location
  const locMatch = text.match(/Lugar\s*:\s*([^\n\r]+)/i)
  if (locMatch) parts.push('location=' + encodeURIComponent(locMatch[1].trim()))
  if (datesParam) parts.push('dates=' + encodeURIComponent(datesParam))

  const url = base + '&' + parts.join('&')
  return url
}

export function closeActivityModal() {
  if (!_modal) return
  _modal.classList.remove('visible')
  document.body.classList.remove('modal-open')
  // Reset mobile state after closing modal and re-init controls on mobile
  try { resetMobileState() } catch (e) {}
  try {
    if (isMobileDevice()) {
      const canvas = document.querySelector && document.querySelector('#scene')
      if (canvas) initMobileControls(canvas)
    }
  } catch (e) {}
  if (typeof _onClose === 'function') _onClose()
}

export function isModalOpen() {
  return _modal ? _modal.classList.contains('visible') : false
}
