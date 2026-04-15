/* mobileControls.js
   Provides simple virtual joystick and touch-look support for mobile devices.
*/

export function isMobileDevice() {
  try {
    return (
      ('ontouchstart' in window) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
      /Mobi|Android|iPhone/i.test(navigator.userAgent)
    )
  } catch (e) {
    return false
  }
}

export const mobileInput = {
  moveX: 0,
  moveZ: 0,
  lookDeltaX: 0,
  lookDeltaY: 0,
}

let _base = null
let _thumb = null
let _touchArea = null
let _joystickTouchId = null
let _lookTouchId = null
let _joystickCenter = { x: 0, y: 0 }
let _thumbSize = 60
let _prevLookX = 0
let _prevLookY = 0

function updateJoystickCenter() {
  if (!_base) return
  const r = _base.getBoundingClientRect()
  _joystickCenter.x = r.left + r.width / 2
  _joystickCenter.y = r.top + r.height / 2
  _thumbSize = Math.min(60, Math.max(40, Math.round(r.width * 0.45)))
}

function onJoystickStart(e) {
  if (_joystickTouchId !== null) return
  const t = e.changedTouches && e.changedTouches[0]
  if (!t) return
  _joystickTouchId = t.identifier
  updateJoystickCenter()
  e.preventDefault()
}

function onJoystickMove(e) {
  if (_joystickTouchId === null) return
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i]
    if (t.identifier !== _joystickTouchId) continue
    const dx = t.clientX - _joystickCenter.x
    const dy = t.clientY - _joystickCenter.y
    const baseRect = _base.getBoundingClientRect()
    const maxRadius = Math.max(16, (baseRect.width / 2) - (_thumbSize / 2))
    const nx = clamp(dx / maxRadius, -1, 1)
    const ny = clamp(dy / maxRadius, -1, 1)
    // update visual thumb
    const tx = clamp(nx * maxRadius, -maxRadius, maxRadius)
    const ty = clamp(ny * maxRadius, -maxRadius, maxRadius)
    if (_thumb) _thumb.style.transform = `translate(${tx}px, ${ty}px)`
    // map to movement: up (negative ty) -> forward (positive moveZ)
    mobileInput.moveX = Number(nx.toFixed(4))
    mobileInput.moveZ = Number((-ny).toFixed(4))
    e.preventDefault()
    return
  }
}

function onJoystickEnd(e) {
  if (_joystickTouchId === null) return
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i]
    if (t.identifier !== _joystickTouchId) continue
    _joystickTouchId = null
    mobileInput.moveX = 0
    mobileInput.moveZ = 0
    if (_thumb) _thumb.style.transform = 'translate(0px, 0px)'
    e.preventDefault()
    return
  }
}

function onLookStart(e) {
  if (_lookTouchId !== null) return
  const t = e.changedTouches && e.changedTouches[0]
  if (!t) return
  _lookTouchId = t.identifier
  _prevLookX = t.clientX
  _prevLookY = t.clientY
  e.preventDefault()
}

function onLookMove(e) {
  if (_lookTouchId === null) return
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i]
    if (t.identifier !== _lookTouchId) continue
    const dx = t.clientX - _prevLookX
    const dy = t.clientY - _prevLookY
    _prevLookX = t.clientX
    _prevLookY = t.clientY
    mobileInput.lookDeltaX += dx
    mobileInput.lookDeltaY += dy
    e.preventDefault()
    return
  }
}

function onLookEnd(e) {
  if (_lookTouchId === null) return
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i]
    if (t.identifier !== _lookTouchId) continue
    _lookTouchId = null
    e.preventDefault()
    return
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

export function initMobileControls(canvas) {
  if (typeof document === 'undefined') return
  if (_base) return

  // Create joystick base
  _base = document.createElement('div')
  _base.id = 'mobile-joystick-base'
  _base.style.touchAction = 'none'
  _base.style.zIndex = '1200'
  _base.setAttribute('aria-hidden', 'true')

  _thumb = document.createElement('div')
  _thumb.id = 'mobile-joystick-thumb'
  _thumb.style.touchAction = 'none'
  _thumb.style.transform = 'translate(0px, 0px)'
  _base.appendChild(_thumb)
  document.body.appendChild(_base)

  // Create right-side touch area for look
  _touchArea = document.createElement('div')
  _touchArea.id = 'mobile-touch-area'
  _touchArea.style.touchAction = 'none'
  _touchArea.setAttribute('aria-hidden', 'true')
  document.body.appendChild(_touchArea)

  updateJoystickCenter()
  window.addEventListener('resize', updateJoystickCenter, { passive: true })

  _base.addEventListener('touchstart', onJoystickStart, { passive: false })
  window.addEventListener('touchmove', onJoystickMove, { passive: false })
  window.addEventListener('touchend', onJoystickEnd, { passive: false })
  window.addEventListener('touchcancel', onJoystickEnd, { passive: false })

  _touchArea.addEventListener('touchstart', onLookStart, { passive: false })
  window.addEventListener('touchmove', onLookMove, { passive: false })
  window.addEventListener('touchend', onLookEnd, { passive: false })
  window.addEventListener('touchcancel', onLookEnd, { passive: false })
}

export function destroyMobileControls() {
  try {
    if (_base && _base.parentElement) _base.parentElement.removeChild(_base)
    if (_touchArea && _touchArea.parentElement) _touchArea.parentElement.removeChild(_touchArea)
  } catch (e) {}
  try {
    _base && _base.removeEventListener && _base.removeEventListener('touchstart', onJoystickStart)
    window.removeEventListener && window.removeEventListener('touchmove', onJoystickMove)
    window.removeEventListener && window.removeEventListener('touchend', onJoystickEnd)
    window.removeEventListener && window.removeEventListener('touchcancel', onJoystickEnd)
    _touchArea && _touchArea.removeEventListener && _touchArea.removeEventListener('touchstart', onLookStart)
    window.removeEventListener && window.removeEventListener('touchmove', onLookMove)
    window.removeEventListener && window.removeEventListener('touchend', onLookEnd)
    window.removeEventListener && window.removeEventListener('touchcancel', onLookEnd)
    window.removeEventListener && window.removeEventListener('resize', updateJoystickCenter)
  } catch (e) {}
  _base = null
  _thumb = null
  _touchArea = null
  _joystickTouchId = null
  _lookTouchId = null
  mobileInput.moveX = 0
  mobileInput.moveZ = 0
  mobileInput.lookDeltaX = 0
  mobileInput.lookDeltaY = 0
}
