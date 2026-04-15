import * as THREE from 'three'
import { clamp, configureGalleryTexture } from '../../misc/helper.js'
import { showActivityModal } from '../../ui/uiOverlay.js'

/**
 * buildDayRoom – creates a room with activity panels for a given day.
 */
export function buildDayRoom(ctx, { name: dayName, eventsData }) {
  const {
    group,
    markers,
    disposables,
    doors,
    doorHitMeshes,
    pickableMeshes,
    obstacles,
    palette,
    width,
    length,
    height,
    halfW,
    halfL,
    wallThickness,
    addDoor,
  } = ctx

  // Get activities for this day
  const activities = getActivitiesForDay(eventsData, dayName)

  // --- Back-to-lobby door (south wall) ---
  const entryDoorW = 1.25
  const entryDoorH = 2.25 * 1.1
  addDoor({
    id: 'back-door',
    wall: 'south',
    w: entryDoorW,
    h: entryDoorH,
    u: 0,
    color: 0xff4455,
    meta: { target: 'lobby', label: 'Volver al lobby' },
  })

  // --- Day label on north wall ---
  {
    const labelW = Math.min(width * 0.7, 6.0)
    const labelH = 0.6
    const labelY = height * 0.85
    const innerNorthZ = -halfL + wallThickness / 2 + 0.02

    const canv = document.createElement('canvas')
    canv.width = 2048
    canv.height = 256
    const c = canv.getContext('2d')
    if (c) {
      c.clearRect(0, 0, canv.width, canv.height)
      c.fillStyle = 'rgba(0,0,0,0.45)'
      c.fillRect(0, 0, canv.width, canv.height)
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillStyle = 'rgba(255,255,255,0.96)'
      c.font = '900 140px system-ui, -apple-system, Segoe UI, Roboto, Arial'
      c.fillText(String(dayName || ''), canv.width / 2, canv.height / 2)
    }

    const tex = new THREE.CanvasTexture(canv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true

    const geo = new THREE.PlaneGeometry(labelW, labelH)
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(0, labelY, innerNorthZ + 0.04)
    group.add(mesh)
    disposables.push(geo, mat, tex)
  }

  // --- Go-back button near south wall ---
  {
    const innerSouthZ = halfL - wallThickness / 2
    const mountZ = innerSouthZ - 0.06
    const mountX = -(entryDoorW / 2 + 0.55)
    const btnH = 0.5
    const btnW = 0.62
    const btnY = entryDoorH - btnH / 2 - 0.36

    const buttonGroup = new THREE.Group()
    buttonGroup.name = 'go-lobby-button'
    buttonGroup.position.set(mountX, 0, mountZ)
    buttonGroup.rotation.y = Math.PI
    group.add(buttonGroup)

    const backPlateGeo = new THREE.BoxGeometry(btnW, btnH, 0.03)
    const backPlateMat = new THREE.MeshStandardMaterial({ color: 0x2f6f4e, roughness: 0.9, metalness: 0.0 })
    const backPlate = new THREE.Mesh(backPlateGeo, backPlateMat)
    backPlate.position.set(0, btnY, 0)
    buttonGroup.add(backPlate)
    disposables.push(backPlateGeo, backPlateMat)

    const canv2 = document.createElement('canvas')
    canv2.width = 512
    canv2.height = 256
    const c2 = canv2.getContext('2d')
    if (c2) {
      c2.clearRect(0, 0, canv2.width, canv2.height)
      c2.textAlign = 'center'
      c2.textBaseline = 'middle'
      c2.fillStyle = 'rgba(255,255,255,0.92)'
      c2.font = '800 80px system-ui, -apple-system, Segoe UI, Roboto, Arial'
      c2.fillText('← Lobby', canv2.width / 2, canv2.height / 2)
    }
    const lTex = new THREE.CanvasTexture(canv2)
    lTex.colorSpace = THREE.SRGBColorSpace
    lTex.needsUpdate = true
    const lGeo = new THREE.PlaneGeometry(btnW * 0.9, btnH * 0.7)
    const lMat = new THREE.MeshBasicMaterial({ map: lTex, transparent: true })
    const lMesh = new THREE.Mesh(lGeo, lMat)
    lMesh.position.set(0, btnY, 0.018)
    buttonGroup.add(lMesh)
    disposables.push(lTex, lGeo, lMat)

    const hitGeo = new THREE.PlaneGeometry(btnW, btnH)
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false })
    const hit = new THREE.Mesh(hitGeo, hitMat)
    hit.position.set(0, btnY, 0.02)
    hit.userData.action = 'go-lobby'
    buttonGroup.add(hit)
    pickableMeshes.push(hit)
    disposables.push(hitGeo, hitMat)
  }

  // --- Activity panels ---
  if (activities.length > 0) {
    buildActivityPanels({ ctx, activities, dayName, disposables, group, pickableMeshes, obstacles, halfW, halfL, height, wallThickness, width, length })
  } else {
    // No activities label
    const canv = document.createElement('canvas')
    canv.width = 1024
    canv.height = 256
    const c = canv.getContext('2d')
    if (c) {
      c.clearRect(0, 0, canv.width, canv.height)
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillStyle = 'rgba(255,255,255,0.7)'
      c.font = '700 80px system-ui, -apple-system, Segoe UI, Roboto, Arial'
      c.fillText('Sin actividades registradas', canv.width / 2, canv.height / 2)
    }
    const tex = new THREE.CanvasTexture(canv)
    tex.colorSpace = THREE.SRGBColorSpace
    const geo = new THREE.PlaneGeometry(4.0, 0.5)
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(0, height * 0.5, 0)
    group.add(mesh)
    disposables.push(geo, mat, tex)
  }

  group.add(markers)

  return {
    group,
    disposables,
    slots: ctx.slots,
    doors,
    doorHitMeshes,
    pickableMeshes,
    obstacles,
    bounds: { halfW, halfL, height },
  }
}

function getActivitiesForDay(eventsData, dayName) {
  if (!eventsData || !Array.isArray(eventsData.days)) return []
  const day = eventsData.days.find((d) => d.name === dayName)
  return Array.isArray(day?.activities) ? day.activities : []
}

function makeActivityTexture({ title, size = 512 }) {
  const canv = document.createElement('canvas')
  canv.width = size
  canv.height = size
  const c = canv.getContext('2d')
  if (c) {
    c.clearRect(0, 0, size, size)
    // Background
    c.fillStyle = 'rgba(15, 20, 40, 0.92)'
    c.fillRect(0, 0, size, size)
    // Border
    c.strokeStyle = 'rgba(100,160,255,0.5)'
    c.lineWidth = 12
    c.strokeRect(14, 14, size - 28, size - 28)
    // Title
    const pad = 48
    const maxW = size - pad * 2
    const fontSize = 62
    c.font = `800 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
    c.fillStyle = 'rgba(255,255,255,0.97)'
    c.textAlign = 'center'
    c.textBaseline = 'top'

    // Word wrap title
    const words = String(title || '').trim().split(/\s+/)
    const lines = []
    let current = ''
    for (const word of words) {
      const test = current ? `${current} ${word}` : word
      if (c.measureText(test).width <= maxW) {
        current = test
      } else {
        if (current) lines.push(current)
        current = word
      }
    }
    if (current) lines.push(current)

    const lineH = fontSize * 1.25
    const totalH = lines.length * lineH
    let y = size / 2 - totalH / 2

    for (const line of lines) {
      c.fillText(line, size / 2, y)
      y += lineH
    }

    // "Click para ver" hint
    c.font = '600 36px system-ui, -apple-system, Segoe UI, Roboto, Arial'
    c.fillStyle = 'rgba(100,180,255,0.85)'
    c.textBaseline = 'bottom'
    c.fillText('👆 Click para ver', size / 2, size - 30)
  }

  const tex = new THREE.CanvasTexture(canv)
  tex.colorSpace = THREE.SRGBColorSpace
  configureGalleryTexture(tex)
  tex.needsUpdate = true
  return tex
}

function buildActivityPanels({ ctx, activities, dayName, disposables, group, pickableMeshes, obstacles, halfW, halfL, height, wallThickness, width, length }) {
  const panelW = 1.8
  const panelH = 1.8
  const panelDepth = 0.06
  const panelY = height * 0.5
  const wallSurfaceOffset = wallThickness / 2 + 0.04

  // Layout: distribute panels on east, north, west walls
  // East wall: along Z axis
  // North wall: along X axis
  // West wall: along Z axis

  const innerEastX = halfW - wallSurfaceOffset - panelDepth / 2
  const innerWestX = -(halfW - wallSurfaceOffset - panelDepth / 2)
  const innerNorthZ = -(halfL - wallSurfaceOffset - panelDepth / 2)

  // Calculate how many fit per wall
  const eastUsable = length - 2.5
  const westUsable = length - 2.5
  const northUsable = width - 2.5

  const gapPanel = 0.4
  const maxPerEast = Math.floor((eastUsable + gapPanel) / (panelW + gapPanel))
  const maxPerWest = Math.floor((westUsable + gapPanel) / (panelW + gapPanel))
  const maxPerNorth = Math.floor((northUsable + gapPanel) / (panelW + gapPanel))

  // Distribute activities across walls
  const wallSlots = []

  // East wall slots
  for (let i = 0; i < maxPerEast; i++) {
    wallSlots.push({ wall: 'east', index: i, total: maxPerEast })
  }
  // North wall slots
  for (let i = 0; i < maxPerNorth; i++) {
    wallSlots.push({ wall: 'north', index: i, total: maxPerNorth })
  }
  // West wall slots
  for (let i = 0; i < maxPerWest; i++) {
    wallSlots.push({ wall: 'west', index: i, total: maxPerWest })
  }

  const count = Math.min(activities.length, wallSlots.length)

  for (let i = 0; i < count; i++) {
    const activity = activities[i]
    const slot = wallSlots[i]

    let px, py, pz, rotY

    if (slot.wall === 'east') {
      const totalSpan = Math.min(slot.total, activities.length) * panelW + (Math.min(slot.total, activities.length) - 1) * gapPanel
      const actualTotal = Math.min(slot.total, activities.length - wallSlots.filter(s => s.wall === 'east').indexOf(slot))
      // count how many east slots are used
      const eastCount = Math.min(maxPerEast, activities.length)
      const span = eastCount * panelW + (eastCount - 1) * gapPanel
      const zStart = -span / 2 + panelW / 2
      const eastIdx = slot.index
      pz = zStart + eastIdx * (panelW + gapPanel)
      px = innerEastX
      py = panelY
      rotY = -Math.PI / 2
    } else if (slot.wall === 'west') {
      const westCount = Math.min(maxPerWest, activities.length - maxPerEast - maxPerNorth)
      if (westCount <= 0) continue
      const span = westCount * panelW + (westCount - 1) * gapPanel
      const zStart = -span / 2 + panelW / 2
      const westIdx = slot.index
      pz = zStart + westIdx * (panelW + gapPanel)
      px = innerWestX
      py = panelY
      rotY = Math.PI / 2
    } else {
      // north
      const northCount = Math.min(maxPerNorth, activities.length - maxPerEast)
      if (northCount <= 0) continue
      const span = northCount * panelW + (northCount - 1) * gapPanel
      const xStart = -span / 2 + panelW / 2
      const northIdx = slot.index
      px = xStart + northIdx * (panelW + gapPanel)
      pz = innerNorthZ
      py = panelY
      rotY = 0
    }

    addActivityPanel({
      group,
      disposables,
      pickableMeshes,
      activity,
      px, py, pz,
      panelW, panelH, panelDepth,
      rotY,
    })
  }

  // If there are overflow activities, show them stacked on north wall at a lower height
  if (activities.length > wallSlots.length) {
    const remaining = activities.slice(wallSlots.length)
    // Display as a text list on north wall
    makeOverflowList({ group, disposables, remaining, halfL, wallThickness, height, width })
  }
}

function addActivityPanel({ group, disposables, pickableMeshes, activity, px, py, pz, panelW, panelH, panelDepth, rotY }) {
  const panelGroup = new THREE.Group()
  panelGroup.name = `activity-panel-${activity.title}`
  panelGroup.position.set(px, py, pz)
  panelGroup.rotation.y = rotY
  group.add(panelGroup)

  // Background
  const backGeo = new THREE.BoxGeometry(panelW, panelH, panelDepth)
  const backMat = new THREE.MeshStandardMaterial({ color: 0x0f1428, roughness: 0.85, metalness: 0.02 })
  const back = new THREE.Mesh(backGeo, backMat)
  back.position.set(0, 0, 0)
  panelGroup.add(back)
  disposables.push(backGeo, backMat)

  // Face with title texture
  const tex = makeActivityTexture({ title: activity.title, size: 512 })
  const faceGeo = new THREE.PlaneGeometry(panelW * 0.96, panelH * 0.96)
  const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: false })
  const face = new THREE.Mesh(faceGeo, faceMat)
  face.position.set(0, 0, panelDepth / 2 + 0.003)
  panelGroup.add(face)
  disposables.push(tex, faceGeo, faceMat)

  // Invisible hit mesh for interaction
  const hitGeo = new THREE.PlaneGeometry(panelW, panelH)
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false })
  const hit = new THREE.Mesh(hitGeo, hitMat)
  hit.position.set(0, 0, panelDepth / 2 + 0.01)
  hit.userData = {
    onClick() {
      showActivityModal(activity)
      // Release pointer lock so user can interact with modal
      if (document.pointerLockElement) {
        document.exitPointerLock()
      }
    },
  }
  panelGroup.add(hit)
  pickableMeshes.push(hit)
  disposables.push(hitGeo, hitMat)
}

function makeActivityTexture({ title, size = 512 }) {
  const canv = document.createElement('canvas')
  canv.width = size
  canv.height = size
  const c = canv.getContext('2d')
  if (c) {
    c.clearRect(0, 0, size, size)
    c.fillStyle = 'rgba(15, 20, 40, 0.95)'
    c.fillRect(0, 0, size, size)
    c.strokeStyle = 'rgba(100,160,255,0.55)'
    c.lineWidth = 12
    c.strokeRect(14, 14, size - 28, size - 28)

    const pad = 44
    const maxW = size - pad * 2
    const fontSize = 58
    c.font = `800 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`
    c.fillStyle = 'rgba(255,255,255,0.97)'
    c.textAlign = 'center'
    c.textBaseline = 'top'

    const words = String(title || '').trim().split(/\s+/)
    const lines = []
    let current = ''
    for (const word of words) {
      const test = current ? `${current} ${word}` : word
      if (c.measureText(test).width <= maxW) { current = test } else {
        if (current) lines.push(current)
        current = word
      }
    }
    if (current) lines.push(current)

    const lineH = fontSize * 1.28
    const totalH = lines.length * lineH
    let y = size / 2 - totalH / 2

    for (const line of lines) {
      c.fillText(line, size / 2, y)
      y += lineH
    }

    c.font = '600 34px system-ui, -apple-system, Segoe UI, Roboto, Arial'
    c.fillStyle = 'rgba(120,200,255,0.85)'
    c.textBaseline = 'bottom'
    c.fillText('👆 Click para ver', size / 2, size - 28)
  }

  const tex = new THREE.CanvasTexture(canv)
  tex.colorSpace = THREE.SRGBColorSpace
  configureGalleryTexture(tex)
  tex.needsUpdate = true
  return tex
}

function makeOverflowList({ group, disposables, remaining, halfL, wallThickness, height, width }) {
  const innerNorthZ = -halfL + wallThickness / 2 + 0.04
  const canv = document.createElement('canvas')
  canv.width = 1024
  canv.height = 512
  const c = canv.getContext('2d')
  if (c) {
    c.clearRect(0, 0, canv.width, canv.height)
    c.fillStyle = 'rgba(15,20,40,0.85)'
    c.fillRect(0, 0, canv.width, canv.height)
    c.textAlign = 'left'
    c.textBaseline = 'top'
    c.fillStyle = 'rgba(255,255,255,0.9)'
    c.font = '700 38px system-ui'
    let y2 = 24
    for (const act of remaining) {
      c.fillText(`• ${act.title}`, 24, y2)
      y2 += 50
      if (y2 > canv.height - 24) break
    }
  }
  const tex = new THREE.CanvasTexture(canv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  const w = Math.min(width * 0.5, 4.0)
  const h = 1.4
  const geo = new THREE.PlaneGeometry(w, h)
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(0, 0.8, innerNorthZ + 0.06)
  group.add(mesh)
  disposables.push(geo, mat, tex)
}
