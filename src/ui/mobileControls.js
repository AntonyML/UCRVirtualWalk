/* mobileControls.js
   Robust mobile controls: virtual joystick (left), touch-look (right).
   Supports PointerEvents (preferred) with Touch fallback, per-frame updates,
   deadzone, smoothing, and clean teardown.
*/

export function isMobileDevice() {
  try {
    if (typeof window === 'undefined') return false
    if (typeof _forceMobile === 'boolean') return _forceMobile
    const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0)
    const coarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
    const smallScreen = typeof window.innerWidth === 'number' && window.innerWidth <= 900
    return Boolean(hasTouch || coarsePointer || smallScreen)
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

export function setMobileMode(force) {
  if (force === true) _forceMobile = true
  else if (force === false) _forceMobile = false
  else _forceMobile = null
}

export function clearMobileMode() {
  _forceMobile = null
}

let _base = null
let _thumb = null
let _touchArea = null
let _joystickId = null
let _lookId = null
let _joystickCenter = { x: 0, y: 0 }
let _thumbSize = 60
let _running = false
let _rafId = 0
let _joystickTargetX = 0
let _joystickTargetZ = 0
let _pendingLookX = 0
let _pendingLookY = 0
let _lastPointerType = null
let _forceMobile = null
let _lastJoystickMoveTime = 0
let _lastLookMoveTime = 0

const DEADZONE = 0.15
const SMOOTHING = 0.18
const THUMB_MAX = 40
const STICKY_TIMEOUT = 1500 // ms without moves => force release

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }
function lerp(a, b, t) { return a + (b - a) * t }

function updateJoystickCenter() {
  if (!_base) return
  const r = _base.getBoundingClientRect()
  _joystickCenter.x = r.left + r.width / 2
  _joystickCenter.y = r.top + r.height / 2
  _thumbSize = Math.min(60, Math.max(36, Math.round(r.width * 0.45)))
}

function _setThumbPosition(nx, nz) {
  if (!_thumb || !_base) return
  const baseRect = _base.getBoundingClientRect()
  const maxRadius = Math.max(16, (baseRect.width / 2) - (_thumbSize / 2))
  const tx = clamp(nx * maxRadius, -maxRadius, maxRadius)
  const ty = clamp(-nz * maxRadius, -maxRadius, maxRadius)
  _thumb.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px)`
}

function _computeNormalized(dx, dy) {
  const baseRect = _base.getBoundingClientRect()
  const maxRadius = Math.max(16, (baseRect.width / 2) - (_thumbSize / 2))
  const nx = clamp(dx / maxRadius, -1, 1)
  const ny = clamp(dy / maxRadius, -1, 1)
  return { nx, ny }
}

// Pointer/touch handlers for joystick and look
function _onJoystickStartPointer(clientX, clientY, id, pointerType) {
  if (!_base) return
  if (_joystickId !== null) return
  _joystickId = id
  updateJoystickCenter()
  _lastPointerType = pointerType || _lastPointerType
  _lastJoystickMoveTime = Date.now()
  // initial move
  const dx = clientX - _joystickCenter.x
  const dy = clientY - _joystickCenter.y
  const { nx, ny } = _computeNormalized(dx, dy)
  _joystickTargetX = nx
  _joystickTargetZ = -ny
  _setThumbPosition(nx, -_joystickTargetZ)
}

function _onJoystickMovePointer(clientX, clientY, id) {
  if (_joystickId === null || id !== _joystickId) return
  _lastJoystickMoveTime = Date.now()
  const dx = clientX - _joystickCenter.x
  const dy = clientY - _joystickCenter.y
  const { nx, ny } = _computeNormalized(dx, dy)
  _joystickTargetX = nx
  _joystickTargetZ = -ny
  _setThumbPosition(nx, -_joystickTargetZ)
}

function _onJoystickEndPointer(id) {
  if (_joystickId === null || id !== _joystickId) return
  _joystickId = null
  _joystickTargetX = 0
  _joystickTargetZ = 0
  if (_thumb) {
    try {
      // snap immediately to center to avoid visual drift
      _thumb.style.transition = 'none'
      _thumb.style.transform = 'translate(0px, 0px)'
      // restore transition on next frame
      window.requestAnimationFrame(() => {
        if (_thumb) _thumb.style.transition = ''
      })
    } catch (err) {}
  }
  // ensure input resets immediately (avoid lingering movement due to smoothing)
  mobileInput.moveX = 0
  mobileInput.moveZ = 0
}

function _onLookStartPointer(clientX, clientY, id, pointerType) {
  if (!_touchArea) return
  if (_lookId !== null) return
  _lookId = id
  _lastPointerType = pointerType || _lastPointerType
  _pendingLookX = 0
  _pendingLookY = 0
  _touchArea._lastX = clientX
  _touchArea._lastY = clientY
  _lastLookMoveTime = Date.now()
}

function _onLookMovePointer(clientX, clientY, id) {
  if (_lookId === null || id !== _lookId) return
  _lastLookMoveTime = Date.now()
  const prevX = _touchArea._lastX || clientX
  const prevY = _touchArea._lastY || clientY
  const dx = clientX - prevX
  const dy = clientY - prevY
  _touchArea._lastX = clientX
  _touchArea._lastY = clientY
  _pendingLookX += dx
  _pendingLookY += dy
}

function _onLookEndPointer(id) {
  if (_lookId === null || id !== _lookId) return
  _lookId = null
}

// Event adapter: Pointer events preferred, Touch as fallback
function _onPointerDown(e) {
  if (e.pointerType && e.pointerType === 'mouse') return
  const el = e.target
  if (el && (el.closest && (el.closest('#mobile-joystick-base')))) {
    _onJoystickStartPointer(e.clientX, e.clientY, e.pointerId, e.pointerType)
    try {
      if (e.target && typeof e.target.setPointerCapture === 'function') e.target.setPointerCapture(e.pointerId)
      else if (_base && typeof _base.setPointerCapture === 'function') _base.setPointerCapture(e.pointerId)
    } catch (err) {}
    e.preventDefault()
    return
  }
  if (el && (el.closest && (el.closest('#mobile-touch-area')))) {
    _onLookStartPointer(e.clientX, e.clientY, e.pointerId, e.pointerType)
    try {
      if (e.target && typeof e.target.setPointerCapture === 'function') e.target.setPointerCapture(e.pointerId)
      else if (_touchArea && typeof _touchArea.setPointerCapture === 'function') _touchArea.setPointerCapture(e.pointerId)
    } catch (err) {}
    e.preventDefault()
    return
  }
}

function _onPointerMove(e) {
  if (e.pointerType && e.pointerType === 'mouse') return
  if (_joystickId !== null) _onJoystickMovePointer(e.clientX, e.clientY, e.pointerId)
  if (_lookId !== null) _onLookMovePointer(e.clientX, e.clientY, e.pointerId)
}

function _onPointerUp(e) {
  if (e.pointerType && e.pointerType === 'mouse') return
  _onJoystickEndPointer(e.pointerId)
  _onLookEndPointer(e.pointerId)
}

function _onTouchStart(e) {
  try {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      const el = document.elementFromPoint(t.clientX, t.clientY)
      if (!el) continue
      if (el.closest && el.closest('#mobile-joystick-base')) {
        _onJoystickStartPointer(t.clientX, t.clientY, t.identifier, 'touch')
      } else if (el.closest && el.closest('#mobile-touch-area')) {
        _onLookStartPointer(t.clientX, t.clientY, t.identifier, 'touch')
      }
    }
  } catch (err) {}
}

function _onTouchMove(e) {
  try {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      _onJoystickMovePointer(t.clientX, t.clientY, t.identifier)
      _onLookMovePointer(t.clientX, t.clientY, t.identifier)
    }
    e.preventDefault()
  } catch (err) {}
}

function _onTouchEnd(e) {
  try {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      _onJoystickEndPointer(t.identifier)
      _onLookEndPointer(t.identifier)
    }
    e.preventDefault()
  } catch (err) {}
}

function _startLoop() {
  if (_running) return
  _running = true
  function loop() {
    // Smooth movement towards target
    const mag = Math.hypot(_joystickTargetX, _joystickTargetZ)
    let tx = 0, tz = 0
    if (mag > 0) {
      if (mag <= DEADZONE) {
        tx = 0; tz = 0
      } else {
        const scaled = (mag - DEADZONE) / (1 - DEADZONE)
        tx = (_joystickTargetX / mag) * scaled
        tz = (_joystickTargetZ / mag) * scaled
      }
    }
    mobileInput.moveX = Number(lerp(mobileInput.moveX, tx, SMOOTHING).toFixed(4))
    mobileInput.moveZ = Number(lerp(mobileInput.moveZ, tz, SMOOTHING).toFixed(4))

    // Transfer pending look deltas to mobileInput once per frame
    if (_pendingLookX !== 0 || _pendingLookY !== 0) {
      mobileInput.lookDeltaX += _pendingLookX
      mobileInput.lookDeltaY += _pendingLookY
      _pendingLookX = 0
      _pendingLookY = 0
    }

    // safety: if pointer doesn't release for long, force end (prevents stuck states)
    const now = Date.now()
    if (_joystickId !== null && _lastJoystickMoveTime > 0 && now - _lastJoystickMoveTime > STICKY_TIMEOUT) {
      try { _onJoystickEndPointer(_joystickId) } catch (err) {}
    }
    if (_lookId !== null && _lastLookMoveTime > 0 && now - _lastLookMoveTime > STICKY_TIMEOUT) {
      try { _onLookEndPointer(_lookId) } catch (err) {}
    }

    _rafId = window.requestAnimationFrame(loop)
  }
  _rafId = window.requestAnimationFrame(loop)
}

function _stopLoop() {
  _running = false
  if (_rafId) {
    window.cancelAnimationFrame(_rafId)
    _rafId = 0
  }
}

export function initMobileControls(canvas) {
  if (typeof document === 'undefined') return
  if (_base) return

  // Create joystick base
  _base = document.createElement('div')
  _base.id = 'mobile-joystick-base'
  _base.style.touchAction = 'none'
  _base.style.zIndex = '1200'
  _base.setAttribute('aria-hidden', 'true')
  _base.style.setProperty('display', 'flex', 'important')

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
  _touchArea.style.setProperty('display', 'block', 'important')
  document.body.appendChild(_touchArea)

  updateJoystickCenter()
  window.addEventListener('resize', updateJoystickCenter, { passive: true })

  // handle page visibility/blur to ensure clean release
  function _onVisibilityChange() {
    if (document.hidden) {
      try { if (_joystickId !== null) _onJoystickEndPointer(_joystickId) } catch (err) {}
      try { if (_lookId !== null) _onLookEndPointer(_lookId) } catch (err) {}
    }
  }

  function _onWindowBlur() {
    try { if (_joystickId !== null) _onJoystickEndPointer(_joystickId) } catch (err) {}
    try { if (_lookId !== null) _onLookEndPointer(_lookId) } catch (err) {}
  }

  document.addEventListener('visibilitychange', _onVisibilityChange, { passive: true })
  window.addEventListener('blur', _onWindowBlur)

  if (window.PointerEvent) {
    window.addEventListener('pointerdown', _onPointerDown, { passive: false })
    window.addEventListener('pointermove', _onPointerMove, { passive: false })
    window.addEventListener('pointerup', _onPointerUp, { passive: false })
    window.addEventListener('pointercancel', _onPointerUp, { passive: false })
  } else {
    _base.addEventListener('touchstart', _onTouchStart, { passive: false })
    window.addEventListener('touchmove', _onTouchMove, { passive: false })
    window.addEventListener('touchend', _onTouchEnd, { passive: false })
    window.addEventListener('touchcancel', _onTouchEnd, { passive: false })
  }

  // Start per-frame transfer loop
  _startLoop()
}

export function destroyMobileControls() {
  try {
    if (_base && _base.parentElement) _base.parentElement.removeChild(_base)
    if (_touchArea && _touchArea.parentElement) _touchArea.parentElement.removeChild(_touchArea)
  } catch (e) {}
  try {
    window.removeEventListener && window.removeEventListener('resize', updateJoystickCenter)
    if (window.PointerEvent) {
      window.removeEventListener && window.removeEventListener('pointerdown', _onPointerDown)
      window.removeEventListener && window.removeEventListener('pointermove', _onPointerMove)
      window.removeEventListener && window.removeEventListener('pointerup', _onPointerUp)
      window.removeEventListener && window.removeEventListener('pointercancel', _onPointerUp)
    } else {
      _base && _base.removeEventListener && _base.removeEventListener('touchstart', _onTouchStart)
      window.removeEventListener && window.removeEventListener('touchmove', _onTouchMove)
      window.removeEventListener && window.removeEventListener('touchend', _onTouchEnd)
      window.removeEventListener && window.removeEventListener('touchcancel', _onTouchEnd)
    }
    // remove visibility / blur handlers
    document.removeEventListener && document.removeEventListener('visibilitychange', _onVisibilityChange)
    window.removeEventListener && window.removeEventListener('blur', _onWindowBlur)
  } catch (e) {}

  _stopLoop()
  _base = null
  _thumb = null
  _touchArea = null
  _joystickId = null
  _lookId = null
  _joystickCenter = { x: 0, y: 0 }
  _thumbSize = 60
  _joystickTargetX = 0
  _joystickTargetZ = 0
  _pendingLookX = 0
  _pendingLookY = 0
  mobileInput.moveX = 0
  mobileInput.moveZ = 0
  mobileInput.lookDeltaX = 0
  mobileInput.lookDeltaY = 0
}

// Reset mobile control internal state without tearing down DOM
export function resetMobileState() {
  try {
    const jid = _joystickId
    const lid = _lookId

    // snap thumb to center visually
    if (_thumb) {
      try {
        _thumb.style.transition = 'none'
        _thumb.style.transform = 'translate(0px, 0px)'
        window.requestAnimationFrame(() => {
          if (_thumb) _thumb.style.transition = ''
        })
      } catch (e) {}
    }

    // clear targets and pending deltas
    _joystickTargetX = 0
    _joystickTargetZ = 0
    _pendingLookX = 0
    _pendingLookY = 0
    _lastJoystickMoveTime = 0
    _lastLookMoveTime = 0

    // clear public-facing inputs
    mobileInput.moveX = 0
    mobileInput.moveZ = 0
    mobileInput.lookDeltaX = 0
    mobileInput.lookDeltaY = 0

    _joystickId = null
    _lookId = null

    // try to release pointer capture (best-effort)
    try {
      if (jid !== null && _base && typeof _base.releasePointerCapture === 'function') _base.releasePointerCapture(jid)
    } catch (e) {}
    try {
      if (lid !== null && _touchArea && typeof _touchArea.releasePointerCapture === 'function') _touchArea.releasePointerCapture(lid)
    } catch (e) {}
  } catch (e) {}
}
