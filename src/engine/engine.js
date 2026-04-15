import * as THREE from 'three'
import { buildRoom } from '../game/room.js'
import { disposeSharedRoomMaterialTextures } from '../game/room/textures.js'
import { roundTo, setBodyClickableCursor } from '../misc/helper.js'
import { isModalOpen, closeActivityModal } from '../ui/uiOverlay.js'
import { initMobileControls, mobileInput, isMobileDevice, destroyMobileControls } from '../ui/mobileControls.js'

export function startYourEngines({
  canvas,
  onFps,
  onPointerLockChange,
  onDoorTrigger,
  eventsData,
  roomMode = 'lobby',
  lobbyDays,
  roomSpawn,
}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2))

  if ('outputColorSpace' in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace
  }
  if ('toneMapping' in renderer) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.35
  }

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05030a)

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200)
  const eyeHeight = 1.7
  camera.position.set(0, eyeHeight, 3)
  camera.rotation.order = 'YXZ'
  scene.add(camera)

  const staticDisposables = []
  staticDisposables.push({ dispose: disposeSharedRoomMaterialTextures })

  let currentRoom = null
  let halfW = 6
  let halfL = 6
  let doorById = new Map()
  let doorHitMeshes = []
  let doorHitById = new Map()
  let roomObstacles = []
  let pickableMeshes = []

  let currentRoomMode = roomMode
  let currentDayName = null
  let currentEventsData = eventsData || null
  let currentLobbyDays = Array.isArray(lobbyDays) ? lobbyDays : []

  const mobileEnabled = typeof window !== 'undefined' && isMobileDevice()

  let deferredTextureLoadToken = 0

  function loadTextureAsync(url) {
    const loader = new THREE.TextureLoader()
    if (typeof loader.setCrossOrigin === 'function') loader.setCrossOrigin('anonymous')
    return new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject)
    })
  }

  async function runDeferredTextureLoads(room, token) {
    const jobs = Array.isArray(room?.deferredTextureLoads) ? room.deferredTextureLoads : []
    if (jobs.length === 0) return
    const staggerMs = 90
    for (const job of jobs) {
      if (token !== deferredTextureLoadToken) return
      if (currentRoom !== room) return
      const url = typeof job?.url === 'string' ? job.url.trim() : ''
      if (!url) continue
      await new Promise((r) => window.requestAnimationFrame(r))
      if (token !== deferredTextureLoadToken || currentRoom !== room) return
      try {
        const tex = await loadTextureAsync(url)
        if (token !== deferredTextureLoadToken || currentRoom !== room) {
          if (tex && typeof tex.dispose === 'function') tex.dispose()
          return
        }
        if (job && typeof job.onLoad === 'function') job.onLoad(tex)
        else if (tex && typeof tex.dispose === 'function') tex.dispose()
      } catch (err) {
        if (token !== deferredTextureLoadToken || currentRoom !== room) return
        if (job && typeof job.onError === 'function') job.onError(err)
      }
      if (staggerMs > 0) {
        await new Promise((r) => window.setTimeout(r, staggerMs))
      }
    }
  }

  let yaw = 0
  let pitch = 0
  const velocity = new THREE.Vector3(0, 0, 0)
  const gravity = -18
  const jumpSpeed = 6.2
  const moveSpeed = 4.2
  const sprintMultiplier = 1.75
  let grounded = false

  function disposeMany(items) {
    for (const d of items) {
      if (d && typeof d.dispose === 'function') d.dispose()
    }
  }

  // Initialize mobile controls if applicable
  if (mobileEnabled) {
    try {
      initMobileControls(canvas)
    } catch (e) {
      // ignore
    }
  }

  function yawForFacingWall(wall) {
    if (wall === 'south') return 0
    if (wall === 'north') return Math.PI
    if (wall === 'west') return Math.PI / 2
    if (wall === 'east') return -Math.PI / 2
    return 0
  }

  function applySpawn(spawn) {
    if (!spawn) return
    if (spawn.type === 'center') {
      camera.position.set(0, eyeHeight, 0)
      yaw = typeof spawn.yaw === 'number' ? spawn.yaw : 0
      pitch = typeof spawn.pitch === 'number' ? spawn.pitch : 0
      camera.rotation.y = yaw
      camera.rotation.x = pitch
      velocity.set(0, 0, 0)
      grounded = true
      return
    }
    if (spawn.type === 'fromWall') {
      const wall = spawn.wall
      const margin = 1.5
      let x = 0
      let z = 0
      if (wall === 'west') x = -halfW + margin
      else if (wall === 'east') x = halfW - margin
      else if (wall === 'north') z = -halfL + margin
      else if (wall === 'south') z = halfL - margin
      camera.position.set(x, eyeHeight, z)
      yaw = yawForFacingWall(wall)
      pitch = 0
      camera.rotation.y = yaw
      camera.rotation.x = pitch
      velocity.set(0, 0, 0)
      grounded = true
    }
  }

  function loadRoom({ mode, spawn, dayName }) {
    const wallThickness = 0.2
    let roomWidth = 21
    let roomLength = 18
    const roomHeight = 4

    if (mode === 'lobby') {
      const days = currentLobbyDays
      const doorsPerSide = Math.max(1, Math.ceil(days.length / 2))
      const doorW = 1.25
      const gapU = 1.1
      const extraEachSide = 2.0
      const spanNeeded = doorsPerSide * doorW + Math.max(0, doorsPerSide - 1) * gapU
      roomLength = roundTo(spanNeeded + extraEachSide * 3, 0.25)
    } else if (mode === 'day') {
      roomWidth = 20
      roomLength = 16
    }

    const nextRoom = buildRoom({
      width: roomWidth,
      length: roomLength,
      height: roomHeight,
      wallThickness,
      mode,
      eventsData: currentEventsData,
      lobby: { days: currentLobbyDays },
      day: { name: dayName },
    })

    if (currentRoom) {
      scene.remove(currentRoom.group)
      disposeMany(currentRoom.disposables)
    }

    currentRoom = nextRoom
    scene.add(currentRoom.group)

    deferredTextureLoadToken += 1
    void runDeferredTextureLoads(currentRoom, deferredTextureLoadToken)

    halfW = currentRoom.bounds?.halfW ?? halfW
    halfL = currentRoom.bounds?.halfL ?? halfL

    const doors = Array.isArray(currentRoom.doors) ? currentRoom.doors : []
    doorById = new Map(doors.map((d) => [d.id, d]))
    doorHitMeshes = Array.isArray(currentRoom.doorHitMeshes) ? currentRoom.doorHitMeshes : []
    doorHitById = new Map(
      doorHitMeshes
        .map((m) => {
          const id = m?.userData?.doorId
          return typeof id === 'string' && id ? [id, m] : null
        })
        .filter(Boolean)
    )
    roomObstacles = Array.isArray(currentRoom.obstacles) ? currentRoom.obstacles : []
    pickableMeshes = Array.isArray(currentRoom.pickableMeshes) ? currentRoom.pickableMeshes : []

    applySpawn(spawn)
  }

  loadRoom({ mode: roomMode, spawn: roomSpawn, dayName: null })

  const raycaster = new THREE.Raycaster()
  const rayNdc = new THREE.Vector2(0, 0)

  function computeIsAimingAtClickable() {
    if (!isPointerLocked() && !mobileEnabled) return false
    if (isModalOpen()) return false
    const candidates = []
    if (doorHitMeshes.length) candidates.push(...doorHitMeshes)
    if (pickableMeshes.length) candidates.push(...pickableMeshes)
    if (candidates.length === 0) return false
    raycaster.setFromCamera(rayNdc, camera)
    const hits = raycaster.intersectObjects(candidates, true)
    if (hits.length === 0) return false
    const hitPoint = hits[0]?.point
    const interactMaxDistance = 3.5
    if (hitPoint && typeof hitPoint.distanceTo === 'function') {
      const d = hitPoint.distanceTo(camera.position)
      if (d > interactMaxDistance) return false
    }
    return true
  }

  const keysDown = new Set()
  let jumpRequested = false

  function onKeyDown(e) {
    keysDown.add(e.code)
    if (e.code === 'Space') jumpRequested = true
  }

  function onKeyUp(e) {
    keysDown.delete(e.code)
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  const mouseSensitivity = 0.0022

  function isPointerLocked() {
    return document.pointerLockElement === canvas
  }

  function onMouseMove(e) {
    if (!isPointerLocked()) return
    if (isModalOpen()) return
    yaw -= e.movementX * mouseSensitivity
    pitch -= e.movementY * mouseSensitivity
    const limit = Math.PI / 2 - 0.01
    pitch = Math.max(-limit, Math.min(limit, pitch))
    camera.rotation.y = yaw
    camera.rotation.x = pitch
  }

  window.addEventListener('mousemove', onMouseMove)

  function handlePointerLockChange() {
    if (typeof onPointerLockChange === 'function') {
      onPointerLockChange(isPointerLocked())
    }
    if (!isPointerLocked() && isModalOpen()) {
      // keep modal open when pointer unlocked by Escape for modal
    }
  }

  document.addEventListener('pointerlockchange', handlePointerLockChange)
  handlePointerLockChange()

  function findDoorId(obj) {
    let cur = obj
    while (cur) {
      if (cur.userData && typeof cur.userData.doorId === 'string') return cur.userData.doorId
      cur = cur.parent
    }
    return null
  }

  function onMouseDown(e) {
    if (e.button !== 0) return
    if (!isPointerLocked()) return
    if (isModalOpen()) return

    raycaster.setFromCamera(rayNdc, camera)
    const candidates = []
    if (doorHitMeshes.length) candidates.push(...doorHitMeshes)
    if (pickableMeshes.length) candidates.push(...pickableMeshes)
    if (candidates.length === 0) return

    const hits = raycaster.intersectObjects(candidates, true)
    if (hits.length === 0) return

    const hitObj = hits[0]?.object
    const hitPoint = hits[0]?.point

    const interactMaxDistance = 3.5
    if (hitPoint && typeof hitPoint.distanceTo === 'function') {
      const d = hitPoint.distanceTo(camera.position)
      if (d > interactMaxDistance) return
    }

    // Check for onClick handler first (activity panels)
    {
      let cur = hitObj
      while (cur) {
        const onClick = cur?.userData?.onClick
        if (typeof onClick === 'function') {
          try {
            onClick({ object: cur, hitObject: hitObj, hitPoint, camera })
          } catch (err) {
            console.warn('[UCRVirtualWalk] onClick failed', err)
          }
          return
        }

        const action = cur?.userData?.action
        if (action === 'go-lobby') {
          if (typeof onDoorTrigger === 'function') {
            onDoorTrigger({ target: 'lobby' })
          }
          return
        }

        cur = cur.parent
      }
    }

    // Check for door triggers
    const doorId = findDoorId(hits[0].object)
    if (!doorId) return
    const door = doorById.get(doorId) ?? { id: doorId }
    if (typeof onDoorTrigger === 'function') {
      onDoorTrigger(door)
    }
  }

  window.addEventListener('mousedown', onMouseDown)

  // Mobile touch tap to trigger centered interaction (ignore if tapping on controls)
  function onTouchTap(e) {
    if (!mobileEnabled) return
    if (isModalOpen()) return
    try {
      const changed = e.changedTouches && e.changedTouches[0]
      if (!changed) return
      const tx = changed.clientX
      const ty = changed.clientY
      const el = document.elementFromPoint(tx, ty)
      if (el && (el.closest && (el.closest('#mobile-joystick-base') || el.closest('#mobile-touch-area')))) {
        return
      }
    } catch (err) {
      // ignore
    }

    raycaster.setFromCamera(rayNdc, camera)
    const candidates = []
    if (doorHitMeshes.length) candidates.push(...doorHitMeshes)
    if (pickableMeshes.length) candidates.push(...pickableMeshes)
    if (candidates.length === 0) return
    const hits = raycaster.intersectObjects(candidates, true)
    if (hits.length === 0) return

    const hitObj = hits[0]?.object
    const hitPoint = hits[0]?.point

    const interactMaxDistance = 3.5
    if (hitPoint && typeof hitPoint.distanceTo === 'function') {
      const d = hitPoint.distanceTo(camera.position)
      if (d > interactMaxDistance) return
    }

    // Check for onClick handler first (activity panels)
    {
      let cur = hitObj
      while (cur) {
        const onClick = cur?.userData?.onClick
        if (typeof onClick === 'function') {
          try {
            onClick({ object: cur, hitObject: hitObj, hitPoint, camera })
          } catch (err) {}
          return
        }

        const action = cur?.userData?.action
        if (action === 'go-lobby') {
          if (typeof onDoorTrigger === 'function') {
            onDoorTrigger({ target: 'lobby' })
          }
          return
        }

        cur = cur.parent
      }
    }

    // Check for door triggers
    function findDoorIdLocal(obj) {
      let cur = obj
      while (cur) {
        if (cur.userData && typeof cur.userData.doorId === 'string') return cur.userData.doorId
        cur = cur.parent
      }
      return null
    }

    const doorId = findDoorIdLocal(hits[0].object)
    if (!doorId) return
    const door = doorById.get(doorId) ?? { id: doorId }
    if (typeof onDoorTrigger === 'function') {
      onDoorTrigger(door)
    }
  }

  window.addEventListener('touchend', onTouchTap)

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v))
  }

  function updatePlayer(dt) {
    if (!isPointerLocked() && !mobileEnabled) {
      jumpRequested = false
      return
    }
    if (isModalOpen()) {
      jumpRequested = false
      return
    }

    // Apply mobile look deltas (if any)
    if (mobileEnabled && mobileInput) {
      const lx = typeof mobileInput.lookDeltaX === 'number' ? mobileInput.lookDeltaX : 0
      const ly = typeof mobileInput.lookDeltaY === 'number' ? mobileInput.lookDeltaY : 0
      if (lx !== 0 || ly !== 0) {
        yaw -= lx * mouseSensitivity
        pitch -= ly * mouseSensitivity
        const limit = Math.PI / 2 - 0.01
        pitch = Math.max(-limit, Math.min(limit, pitch))
        camera.rotation.y = yaw
        camera.rotation.x = pitch
        mobileInput.lookDeltaX = 0
        mobileInput.lookDeltaY = 0
      }
    }

    let inputX = 0
    let inputZ = 0
    if (mobileEnabled && mobileInput) {
      inputX = typeof mobileInput.moveX === 'number' ? mobileInput.moveX : 0
      inputZ = typeof mobileInput.moveZ === 'number' ? mobileInput.moveZ : 0
    } else {
      inputX = (keysDown.has('KeyD') || keysDown.has('ArrowRight') ? 1 : 0) - (keysDown.has('KeyA') || keysDown.has('ArrowLeft') ? 1 : 0)
      inputZ = (keysDown.has('KeyW') || keysDown.has('ArrowUp') ? 1 : 0) - (keysDown.has('KeyS') || keysDown.has('ArrowDown') ? 1 : 0)
    }

    let moveX = 0
    let moveZ = 0

    if (inputX !== 0 || inputZ !== 0) {
      const len = Math.hypot(inputX, inputZ)
      const nx = inputX / len
      const nz = inputZ / len
      const isSprinting = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight')
      const speed = moveSpeed * (isSprinting ? sprintMultiplier : 1)
      const sin = Math.sin(yaw)
      const cos = Math.cos(yaw)
      moveX = (cos * nx + -sin * nz) * speed
      moveZ = (-sin * nx + -cos * nz) * speed
    }

    camera.position.x += moveX * dt
    camera.position.z += moveZ * dt

    let floorY = 0
    const px = camera.position.x
    const pz = camera.position.z
    const playerRadius = 0.35
    const maxStepHeight = 0.5

    for (const o of roomObstacles) {
      if (!o || (o.type !== 'box' && o.type !== 'floor')) continue
      const ox = typeof o.x === 'number' ? o.x : 0
      const oy = typeof o.y === 'number' ? o.y : 0
      const oz = typeof o.z === 'number' ? o.z : 0
      const w = typeof o.w === 'number' ? o.w : 0
      const d = typeof o.d === 'number' ? o.d : 0
      if (!(w > 0 && d > 0)) continue

      const hx = w / 2
      const hz = d / 2
      const dx = Math.abs(px - ox)
      const dz = Math.abs(pz - oz)

      const boundsBuffer = o.type === 'floor' ? playerRadius * 0.2 : -playerRadius * 0.3
      if (dx < hx + boundsBuffer && dz < hz + boundsBuffer) {
        const currentEyeLevel = camera.position.y
        const obstacleTopY = oy + eyeHeight
        if (obstacleTopY <= currentEyeLevel + maxStepHeight && oy > floorY) {
          floorY = oy
        }
      }
    }

    const targetFloorY = floorY + eyeHeight
    if (targetFloorY > camera.position.y && targetFloorY <= camera.position.y + maxStepHeight) {
      camera.position.y = targetFloorY
      velocity.y = 0
      grounded = true
    } else {
      velocity.y += gravity * dt
      if (jumpRequested && grounded) {
        velocity.y = jumpSpeed
        grounded = false
      }
      jumpRequested = false
      camera.position.y += velocity.y * dt
      if (camera.position.y <= targetFloorY) {
        camera.position.y = targetFloorY
        velocity.y = 0
        grounded = true
      }
    }

    {
      const px2 = camera.position.x
      const pz2 = camera.position.z
      let x = px2
      let z = pz2

      for (const o of roomObstacles) {
        if (!o || o.type !== 'cylinder') continue
        const ox = typeof o.x === 'number' ? o.x : 0
        const oz = typeof o.z === 'number' ? o.z : 0
        const r = typeof o.radius === 'number' ? o.radius : 0
        const minDist = playerRadius + r + 0.05
        const dx = x - ox
        const dz = z - oz
        const dist = Math.hypot(dx, dz)
        if (dist > 0 && dist < minDist) {
          const push = minDist - dist
          x += (dx / dist) * push
          z += (dz / dist) * push
        } else if (dist === 0 && minDist > 0) {
          x += minDist
        }
      }

      for (const o of roomObstacles) {
        if (!o || o.type !== 'box') continue
        const ox = typeof o.x === 'number' ? o.x : 0
        const oz = typeof o.z === 'number' ? o.z : 0
        const w = typeof o.w === 'number' ? o.w : 0
        const d = typeof o.d === 'number' ? o.d : 0
        if (!(w > 0 && d > 0)) continue
        const buffer = playerRadius + 0.05
        const hx = w / 2 + buffer
        const hz = d / 2 + buffer
        const dx = x - ox
        const dz = z - oz
        if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
          const pushX = hx - Math.abs(dx)
          const pushZ = hz - Math.abs(dz)
          if (pushX < pushZ) {
            x += (dx === 0 ? 1 : Math.sign(dx)) * pushX
          } else {
            z += (dz === 0 ? 1 : Math.sign(dz)) * pushZ
          }
        }
      }

      camera.position.x = x
      camera.position.z = z
    }

    const margin = 0.35
    camera.position.x = clamp(camera.position.x, -(halfW - margin), halfW - margin)
    camera.position.z = clamp(camera.position.z, -(halfL - margin), halfL - margin)
  }

  function resize() {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width <= 0 || height <= 0) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const clock = new THREE.Clock()
  let rafId = 0

  function frame() {
    const dt = clock.getDelta()
    updatePlayer(dt)
    setBodyClickableCursor(computeIsAimingAtClickable())
    resize()
    renderer.render(scene, camera)
    rafId = window.requestAnimationFrame(frame)
  }

  window.addEventListener('resize', resize)
  resize()
  rafId = window.requestAnimationFrame(frame)

  return {
    setRoom({ roomMode: nextMode, dayName: nextDayName, spawn } = {}) {
      currentRoomMode = typeof nextMode === 'string' ? nextMode : currentRoomMode
      currentDayName = typeof nextDayName === 'string' ? nextDayName : currentDayName
      loadRoom({ mode: currentRoomMode, spawn, dayName: currentDayName })
    },
    stop() {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('touchend', onTouchTap)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
      if (currentRoom) {
        scene.remove(currentRoom.group)
        disposeMany(currentRoom.disposables)
        currentRoom = null
      }
      disposeMany(staticDisposables)
      if (mobileEnabled) {
        try { destroyMobileControls() } catch (e) {}
      }
      renderer.dispose()
    },
  }
}
