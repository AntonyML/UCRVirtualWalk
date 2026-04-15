import * as THREE from 'three'
import { clamp, roundTo, configureGalleryTexture } from '../misc/helper.js'
import { buildLobbyRoom } from './room/lobby.js'
import { buildDayRoom } from './room/dayRoom.js'
import { addDoor as addDoorToRoom } from './room/doors.js'
import { addSlot as addSlotToRoom } from './room/slots.js'
import { getSharedRoomMaterialTextures } from './room/textures.js'

export function buildRoom({ width, length, height, wallThickness = 0.2, mode = 'lobby', eventsData, lobby = {}, day = {} }) {
  const group = new THREE.Group()
  group.name = 'room'

  const disposables = []
  const deferredTextureLoads = []

  let palette = {}

  if (mode === 'lobby') {
    palette = {
      floor: 0xfff1c8,
      ceiling: 0xe9fbff,
      wall: 0xcfeaff,
      keyLight: 0xfff0b0,
      keyLightIntensity: 1.55,
      ambientIntensity: 1.05,
      ceilingLightColor: 0xd7f1ff,
      ceilingLightIntensity: 1.35,
    }
  } else {
    palette = {
      floor: 0x2a2a2f,
      ceiling: 0xd9d9de,
      wall: 0x3a3a44,
      keyLight: 0xfff1d2,
      keyLightIntensity: 1.6,
      ambientIntensity: 0.95,
      ceilingLightColor: 0xffffff,
      ceilingLightIntensity: 1.1,
    }
  }

  const ambient = new THREE.AmbientLight(0xffffff, palette.ambientIntensity)
  group.add(ambient)

  const keyLight = new THREE.DirectionalLight(palette.keyLight, palette.keyLightIntensity)
  keyLight.position.set(4, height + 2.5, 3)
  group.add(keyLight)

  const ceilingLightColor = palette.ceilingLightColor
  const ceilingLightIntensity = palette.ceilingLightIntensity
  const ceilingLightDistance = Math.max(width, length) * 2.2
  const ceilingLightDecay = 1.6

  const {
    floorWoodMap,
    floorWoodBump,
    doorWoodMap,
    doorWoodBump,
    benchWoodMap,
    benchWoodBump,
    wallStuccoMap,
    wallStuccoBump,
    ceilingStuccoMap,
    ceilingStuccoBump,
    pillarMarbleMap,
    pillarMarbleBump,
  } = getSharedRoomMaterialTextures({ width, length })

  const halfW = width / 2
  const halfL = length / 2

  // ---- FLOOR ----
  const floorGeo = new THREE.PlaneGeometry(width, length)
  const floorMat = new THREE.MeshStandardMaterial({
    color: mode === 'lobby' ? palette.floor : 0xffffff,
    map: floorWoodMap,
    bumpMap: floorWoodBump,
    bumpScale: 0.05,
    roughness: 0.42,
    metalness: 0.0,
  })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0
  group.add(floor)
  disposables.push(floorGeo, floorMat)

  // ---- CEILING ----
  const ceilingGeo = new THREE.PlaneGeometry(width, length)
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: palette.ceiling,
    map: ceilingStuccoMap,
    bumpMap: ceilingStuccoBump,
    bumpScale: 0.14,
    roughness: 0.94,
    metalness: 0.0,
  })
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = height
  group.add(ceiling)
  disposables.push(ceilingGeo, ceilingMat)

  // Ceiling lights
  const y = height - 0.25
  const x = width * 0.35
  const z = length * 0.35
  const lightPositions = [[-x, y, -z], [x, y, -z], [-x, y, z], [x, y, z], [-x, y, 0], [x, y, 0]]
  for (const [lx, ly, lz] of lightPositions) {
    const lt = new THREE.PointLight(ceilingLightColor, ceilingLightIntensity, ceilingLightDistance, ceilingLightDecay)
    lt.position.set(lx, ly, lz)
    group.add(lt)
  }

  // ---- WALLS ----
  const wallMat = new THREE.MeshStandardMaterial({
    color: mode === 'lobby' ? palette.wall : 0xffffff,
    map: wallStuccoMap,
    bumpMap: wallStuccoBump,
    bumpScale: 0.09,
    roughness: 0.92,
    metalness: 0.0,
  })

  const wallNSGeo = new THREE.BoxGeometry(width, height, wallThickness)
  const wallEWGeo = new THREE.BoxGeometry(wallThickness, height, length)

  const northWall = new THREE.Mesh(wallNSGeo, wallMat)
  northWall.position.set(0, height / 2, -halfL)
  group.add(northWall)

  const southWall = new THREE.Mesh(wallNSGeo, wallMat)
  southWall.position.set(0, height / 2, halfL)
  group.add(southWall)

  const eastWall = new THREE.Mesh(wallEWGeo, wallMat)
  eastWall.position.set(halfW, height / 2, 0)
  group.add(eastWall)

  const westWall = new THREE.Mesh(wallEWGeo, wallMat)
  westWall.position.set(-halfW, height / 2, 0)
  group.add(westWall)

  disposables.push(wallNSGeo, wallEWGeo, wallMat)

  const surfaceOffset = wallThickness / 2 + 0.02

  const walls = {
    north: { center: new THREE.Vector3(0, height / 2, -halfL), normal: new THREE.Vector3(0, 0, 1), wallWidth: width, wallHeight: height },
    south: { center: new THREE.Vector3(0, height / 2, halfL), normal: new THREE.Vector3(0, 0, -1), wallWidth: width, wallHeight: height },
    east: { center: new THREE.Vector3(halfW, height / 2, 0), normal: new THREE.Vector3(-1, 0, 0), wallWidth: length, wallHeight: height },
    west: { center: new THREE.Vector3(-halfW, height / 2, 0), normal: new THREE.Vector3(1, 0, 0), wallWidth: length, wallHeight: height },
  }

  const slots = []
  const doors = []
  const doorHitMeshes = []
  const pickableMeshes = []
  const obstacles = []
  const markers = new THREE.Group()
  markers.name = 'display-slots'

  const roomCtx = {
    group,
    disposables,
    deferredTextureLoads,
    slots,
    doors,
    doorHitMeshes,
    pickableMeshes,
    obstacles,
    markers,
    palette,
    textures: { benchWoodMap, benchWoodBump },
    width,
    length,
    height,
    halfW,
    halfL,
    wallThickness,
    surfaceOffset,
    walls,
  }

  roomCtx.doorStyle = {
    frame: { color: 0x1a0f09, roughness: 0.58, metalness: 0.0 },
    door: {
      color: 0xc79a6c,
      roughness: 0.44,
      metalness: 0.0,
      map: doorWoodMap,
      bumpMap: doorWoodBump,
      bumpScale: 0.075,
    },
    fill: { color: 0x0d1015, roughness: 0.95, metalness: 0.0 },
  }

  function addSlot(args) { return addSlotToRoom(roomCtx, args) }
  function addDoor(args) { return addDoorToRoom(roomCtx, args) }

  roomCtx.addSlot = addSlot
  roomCtx.addDoor = addDoor

  if (mode === 'lobby') {
    const lobbyRoom = buildLobbyRoom(roomCtx, lobby)
    return { ...lobbyRoom, deferredTextureLoads }
  }

  if (mode === 'day') {
    const dayRoom = buildDayRoom(roomCtx, { name: day.name, eventsData })
    return { ...dayRoom, deferredTextureLoads }
  }

  group.add(markers)

  return {
    group,
    disposables,
    deferredTextureLoads,
    slots,
    doors,
    doorHitMeshes,
    pickableMeshes,
    obstacles,
    bounds: { halfW, halfL, height },
  }
}
