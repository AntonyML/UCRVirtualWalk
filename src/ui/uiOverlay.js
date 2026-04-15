/**
 * uiOverlay.js – Activity Modal (DOM layer, outside WebGL canvas).
 * Bridge between Three.js raycaster clicks and the HTML UI.
 */

let _modal = null
let _onClose = null

export function initActivityModal({ onClose } = {}) {
  _onClose = onClose

  // Inject modal HTML
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
        <h2 id="activity-modal-title"></h2>
      </div>
      <div id="activity-modal-body">
        <pre id="activity-modal-text"></pre>
      </div>
      <div id="activity-modal-footer">
        <a
          id="activity-modal-link"
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          style="display:none"
        >IR AL FORMULARIO ↗</a>
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

  if (titleEl) titleEl.textContent = activity.title || ''
  if (textEl) textEl.textContent = activity.full_text || ''

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

  _modal.classList.add('visible')
  document.body.classList.add('modal-open')
}

export function closeActivityModal() {
  if (!_modal) return
  _modal.classList.remove('visible')
  document.body.classList.remove('modal-open')
  if (typeof _onClose === 'function') _onClose()
}

export function isModalOpen() {
  return _modal ? _modal.classList.contains('visible') : false
}
