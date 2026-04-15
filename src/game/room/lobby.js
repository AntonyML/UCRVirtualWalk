import * as THREE from 'three'
import { clamp, roundTo } from '../../misc/helper.js'
import lobbyPhotoUrl from '../../assets/lobbyphoto.png'

export function buildLobbyRoom(ctx, lobby) {
  const {
    group,
    markers,
    disposables,
    slots,
    doors,
    doorHitMeshes,
    pickableMeshes,
    obstacles,
    palette,
    textures,
    width,
    length,
    height,
    halfW,
    halfL,
    wallThickness,
    addDoor,
  } = ctx

  const days =
    Array.isArray(lobby?.days) && lobby.days.length > 0
      ? lobby.days
      : ['Día 1', 'Día 2', 'Día 3']

  const perWall = Math.ceil(days.length / 2)
  const eastDays = days.slice(0, perWall).map((d) => String(d))
  const westDays = days.slice(perWall).map((d) => String(d))

  const boardW = roundTo(clamp(width * 0.72, 2.4, 6.2), 0.05)
  const boardH = roundTo(clamp(height * 0.58, 1.2, 2.0), 0.05)
  const boardY = height * 0.62

  // --- Whiteboard ---
  function addLobbyWhiteboard({ leftItems, rightItems }) {
    const innerNorthZ = -halfL + wallThickness / 2
    const bottomY = -boardH / 2
    const legTopY = bottomY + 0.08
    const baseLegH = Math.max(0.35, boardY + legTopY - 0.02)
    const legH = Math.max(0.25, baseLegH * 0.5)
    const boardCenterY = 0.02 - legTopY + legH
    const boardCenter = new THREE.Vector3(0, boardCenterY, innerNorthZ + 1.4)

    const canvas2 = document.createElement('canvas')
    canvas2.width = 2048
    canvas2.height = 1024
    const ctx2 = canvas2.getContext('2d')

    const tex = new THREE.CanvasTexture(canvas2)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true

    if (ctx2) {
      const padX = 90
      const headerFont = '800 76px system-ui, -apple-system, Segoe UI, Roboto, Arial'
      const itemFont = '700 56px system-ui, -apple-system, Segoe UI, Roboto, Arial'

      function drawIconWatermark(img) {
        if (!img || !img.naturalWidth || !img.naturalHeight) return
        const cx = canvas2.width / 2
        const cy = canvas2.height / 2
        const maxSize = Math.min(canvas2.width * 0.28, canvas2.height) * 0.76
        const scale = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight)
        const w = img.naturalWidth * scale
        const h = img.naturalHeight * scale
        ctx2.save()
        ctx2.globalAlpha = 0.18
        ctx2.drawImage(img, cx - w / 2, cy - h / 2, w, h)
        ctx2.restore()
      }

      let arrowLeftImg = null
      let arrowRightImg = null

      function drawList(x0, title, items, { align = 'left' } = {}) {
        ctx2.textAlign = align
        ctx2.textBaseline = 'alphabetic'
        const safeItems = Array.isArray(items) ? items.map((s) => String(s || '').trim()).filter(Boolean) : []
        const lineH = 66
        const headerLineH = 118
        const headerGap = 68
        const yMargin = Math.max(70, 86)
        const contentMaxH = Math.max(240, canvas2.height - yMargin * 2)
        let maxItemLines = Math.max(1, Math.floor((contentMaxH - headerLineH - headerGap) / lineH))
        let shown = safeItems.slice(0, maxItemLines)
        let hasMore = safeItems.length > shown.length
        if (hasMore && shown.length > 1) {
          shown = safeItems.slice(0, Math.max(1, maxItemLines - 1))
          hasMore = safeItems.length > shown.length
        }
        const moreLineCount = hasMore ? 1 : 0
        const totalH = headerLineH + headerGap + (shown.length + moreLineCount) * lineH
        const yTop = (canvas2.height - totalH) / 2
        let y = yTop + headerLineH
        ctx2.font = headerFont
        ctx2.fillStyle = 'rgba(0,0,0,0.92)'

        // Draw icon for arrow-based titles, otherwise draw text
        if (typeof title === 'string' && title.includes('←') && arrowLeftImg && arrowLeftImg.naturalWidth) {
          const iconSize = 48
          const iconX = align === 'left' ? x0 - iconSize - 12 : x0 + 12
          const iconY = y - headerLineH / 2 - iconSize / 2 + 8
          try { ctx2.drawImage(arrowLeftImg, iconX, iconY, iconSize, iconSize) } catch (e) {}
        } else if (typeof title === 'string' && title.includes('→') && arrowRightImg && arrowRightImg.naturalWidth) {
          const iconSize = 48
          const iconX = align === 'left' ? x0 - iconSize - 12 : x0 + 12
          const iconY = y - headerLineH / 2 - iconSize / 2 + 8
          try { ctx2.drawImage(arrowRightImg, iconX, iconY, iconSize, iconSize) } catch (e) {}
        } else {
          ctx2.fillText(String(title), x0, y)
        }

        y += headerGap
        ctx2.font = itemFont
        ctx2.fillStyle = 'rgba(0,0,0,0.92)'
        for (let i = 0; i < shown.length; i++) {
          const label = `• ${shown[i]}`
          ctx2.fillText(label, x0, y + i * lineH)
        }
        if (hasMore) {
          const more = safeItems.length - shown.length
          ctx2.fillStyle = 'rgba(0,0,0,0.62)'
          ctx2.fillText(`… +${more} más`, x0, y + shown.length * lineH)
        }
      }

      function drawCenter() {
        ctx2.textAlign = 'center'
        ctx2.textBaseline = 'middle'
        const cx = canvas2.width / 2
        const cy = canvas2.height / 2
        ctx2.font = '900 72px system-ui, -apple-system, Segoe UI, Roboto, Arial'
        ctx2.fillStyle = 'rgba(0,0,0,0.80)'
        ctx2.fillText('Semana U 2026', cx, cy - 30)
        ctx2.font = '700 46px system-ui, -apple-system, Segoe UI, Roboto, Arial'
        ctx2.fillStyle = 'rgba(0,0,0,0.60)'
        ctx2.fillText('UCR Recinto de Guápiles', cx, cy + 36)
      }

      function renderBoard({ watermarkImg } = {}) {
        ctx2.clearRect(0, 0, canvas2.width, canvas2.height)
        ctx2.fillStyle = '#ffffff'
        ctx2.fillRect(0, 0, canvas2.width, canvas2.height)
        ctx2.strokeStyle = 'rgba(0,0,0,0.22)'
        ctx2.lineWidth = 14
        ctx2.strokeRect(18, 18, canvas2.width - 36, canvas2.height - 36)
        drawList(padX, '←←←←', leftItems, { align: 'left' })
        drawList(canvas2.width - padX, '→→→→', rightItems, { align: 'right' })
        if (watermarkImg) drawIconWatermark(watermarkImg)
        drawCenter()
      }

      renderBoard()

      const baseUrl = import.meta.env.BASE_URL || '/'
      const fallbackIconUrl = baseUrl.endsWith('/') ? `${baseUrl}icon.png` : `${baseUrl}/icon.png`
      const iconUrl = document.querySelector('link[rel~="icon"]')?.href || fallbackIconUrl

      const watermarkImg = new Image()
      watermarkImg.decoding = 'async'
      watermarkImg.onload = () => {
        renderBoard({ watermarkImg })
        tex.needsUpdate = true
      }
      watermarkImg.src = iconUrl
      // Preload arrow icons for header decorations
      const baseForIcons = import.meta.env.BASE_URL || '/'
      arrowLeftImg = new Image()
      arrowLeftImg.decoding = 'async'
      arrowLeftImg.onload = () => { renderBoard({ watermarkImg }); tex.needsUpdate = true }
      arrowLeftImg.src = `${baseForIcons}icons/arrow-left.svg`

      arrowRightImg = new Image()
      arrowRightImg.decoding = 'async'
      arrowRightImg.onload = () => { renderBoard({ watermarkImg }); tex.needsUpdate = true }
      arrowRightImg.src = `${baseForIcons}icons/arrow-right.svg`
    }

    const boardDepth = 0.08
    const boardGroup = new THREE.Group()
    boardGroup.name = 'lobby-whiteboard'
    boardGroup.position.copy(boardCenter)

    const backGeo = new THREE.BoxGeometry(boardW, boardH, boardDepth)
    const backMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.0 })
    const back = new THREE.Mesh(backGeo, backMat)
    back.position.set(0, 0, 0)
    boardGroup.add(back)
    disposables.push(backGeo, backMat)

    const faceGeo = new THREE.PlaneGeometry(boardW * 0.98, boardH * 0.98)
    const faceMat = new THREE.MeshBasicMaterial({ map: tex })
    const face = new THREE.Mesh(faceGeo, faceMat)
    face.position.set(0, 0, boardDepth / 2 + 0.002)
    boardGroup.add(face)
    disposables.push(tex, faceGeo, faceMat)

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x0d1015, roughness: 0.7, metalness: 0.05 })
    disposables.push(metalMat)
    const legGeo = new THREE.CylinderGeometry(0.05, 0.05, legH, 12, 1)
    disposables.push(legGeo)

    const legXs = [-boardW * 0.32, 0, boardW * 0.32]
    for (const lx of legXs) {
      const leg = new THREE.Mesh(legGeo, metalMat)
      leg.position.set(lx, legTopY - legH / 2, -boardDepth * 0.18)
      boardGroup.add(leg)
    }

    boardGroup.rotation.x = -0.06
    group.add(boardGroup)

    obstacles.push({
      type: 'box',
      x: boardCenter.x,
      z: boardCenter.z + 0.05,
      w: boardW * 0.95,
      d: 0.9,
    })
  }

  addLobbyWhiteboard({ leftItems: westDays, rightItems: eastDays })

  // --- Doors (one per day) ---
  const doorW = 1.25
  const doorH = 2.25 * 1.1

  const gapU = 1.1
  const endMarginTotal = 4.0
  const totalSpan = perWall * doorW + (perWall - 1) * gapU
  const span = Math.max(perWall * doorW, Math.min(totalSpan, length - endMarginTotal))
  const actualGap = perWall > 1 ? (span - perWall * doorW) / (perWall - 1) : 0
  const uStart = -span / 2 + doorW / 2

  for (let i = 0; i < perWall; i++) {
    const u = uStart + i * (doorW + actualGap)

    const eastDay = days[i]
    if (eastDay) {
      addDoor({
        id: `entry-east-${i}`,
        wall: 'east',
        w: doorW,
        h: doorH,
        y: -0.1,
        u,
        meta: { dayName: eastDay, label: eastDay },
      })
    }

    const westDay = days[i + perWall]
    if (westDay) {
      addDoor({
        id: `entry-west-${i}`,
        wall: 'west',
        w: doorW,
        h: doorH,
        y: -0.1,
        u,
        meta: { dayName: westDay, label: westDay },
      })
    }
  }

  // --- South wall decoration ---
  {
    const innerSouthZ = halfL - wallThickness / 2
    const benchZ = innerSouthZ - 0.42
    const plantZ = innerSouthZ - 0.38

    const decoSouth = new THREE.Group()
    decoSouth.name = 'deco-south-lobby'
    group.add(decoSouth)

    const benchWoodMap = textures?.benchWoodMap
    const benchWoodBump = textures?.benchWoodBump
    const hasBenchTex = Boolean(benchWoodMap && benchWoodBump)

    const woodMat = new THREE.MeshStandardMaterial(
      hasBenchTex
        ? { color: 0xffffff, map: benchWoodMap, bumpMap: benchWoodBump, bumpScale: 0.045, roughness: 0.58, metalness: 0.0 }
        : { color: palette.wall, roughness: 0.78, metalness: 0.0 }
    )
    const metalMat2 = new THREE.MeshStandardMaterial({ color: 0x0d1015, roughness: 0.7, metalness: 0.05 })
    const potMat = new THREE.MeshStandardMaterial({ color: 0x0d1015, roughness: 0.95, metalness: 0.0 })
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4b2a, roughness: 0.92, metalness: 0.0 })
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6f4e, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide })
    disposables.push(woodMat, metalMat2, potMat, trunkMat, leafMat)

    const seatW = 2.6
    const seatD = 0.55
    const seatH = 0.12
    const seatY = 0.46
    const backW = seatW
    const backH = 0.55
    const backD = 0.08
    const seatGeo = new THREE.BoxGeometry(seatW, seatH, seatD)
    const backGeo2 = new THREE.BoxGeometry(backW, backH, backD)
    const legW = 0.08
    const legD2 = 0.08
    const legH2 = seatY - seatH / 2
    const legGeo2 = new THREE.BoxGeometry(legW, legH2, legD2)
    disposables.push(seatGeo, backGeo2, legGeo2)
    const legX2 = seatW / 2 - 0.18
    const legZ2 = seatD / 2 - 0.18

    function addBenchAt(x) {
      const b = new THREE.Group()
      b.name = 'bench-south-lobby'
      b.position.set(x, 0, benchZ)
      b.rotation.y = Math.PI
      decoSouth.add(b)
      const s = new THREE.Mesh(seatGeo, woodMat)
      s.position.set(0, seatY, 0)
      b.add(s)
      const bk = new THREE.Mesh(backGeo2, woodMat)
      bk.position.set(0, seatY + backH / 2 - 0.02, -(seatD / 2 - backD / 2))
      b.add(bk)
      for (const lx of [-legX2, legX2]) {
        for (const lz of [-legZ2, legZ2]) {
          const leg = new THREE.Mesh(legGeo2, metalMat2)
          leg.position.set(lx, legH2 / 2, lz)
          b.add(leg)
        }
      }
      obstacles.push({ type: 'box', x, z: benchZ, w: seatW * 0.95, d: seatD * 1.15 })
    }

    const potR = 0.28
    const potH = 0.42
    const trunkH = 0.78
    const potGeo = new THREE.CylinderGeometry(potR, potR * 1.12, potH, 18, 1)
    const soilGeo = new THREE.CylinderGeometry(potR * 0.95, potR * 1.08, 0.06, 18, 1)
    const trunkGeo = new THREE.CylinderGeometry(0.055, 0.075, trunkH, 12, 1)
    const frondW = 0.12
    const frondL = 0.86
    const frondGeo = new THREE.PlaneGeometry(frondL, frondW, 7, 1)
    {
      const pos = frondGeo.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const t = (x + frondL / 2) / frondL
        pos.setZ(i, Math.sin(t * Math.PI) * 0.13)
      }
      pos.needsUpdate = true
      frondGeo.computeVertexNormals()
    }
    frondGeo.translate(frondL / 2, 0, 0)
    disposables.push(potGeo, soilGeo, trunkGeo, frondGeo)

    function addPlantAt(x) {
      const plant = new THREE.Group()
      plant.name = 'plant-south-lobby'
      plant.position.set(x, 0, plantZ)
      decoSouth.add(plant)
      const pot = new THREE.Mesh(potGeo, potMat)
      pot.position.set(0, potH / 2, 0)
      plant.add(pot)
      const soil = new THREE.Mesh(soilGeo, potMat)
      soil.position.set(0, potH - 0.02, 0)
      plant.add(soil)
      const trunk = new THREE.Mesh(trunkGeo, trunkMat)
      trunk.position.set(0, potH + trunkH / 2 - 0.02, 0)
      plant.add(trunk)
      const fronds = new THREE.Group()
      fronds.position.set(0, potH + trunkH - 0.02, 0)
      plant.add(fronds)
      for (let i = 0; i < 10; i++) {
        const f = new THREE.Mesh(frondGeo, leafMat)
        const a = (i / 10) * Math.PI * 2
        f.rotation.y = a
        f.rotation.x = -0.55 - Math.random() * 0.25
        f.rotation.z = (Math.random() - 0.5) * 0.22
        f.position.set(0, 0.05, 0)
        fronds.add(f)
      }
      obstacles.push({ type: 'cylinder', x, z: plantZ, radius: 0.38 })
    }

    const margin = 1.0
    const usable = Math.max(6.0, width - margin * 2)
    const plantSpan = 0.9
    const benchSpan = seatW
    const baseSpan2 = 3 * plantSpan + 2 * benchSpan
    const gap2 = Math.max(0.2, (usable - baseSpan2) / 4)
    const totalSpan2 = baseSpan2 + gap2 * 4
    let cursor = -totalSpan2 / 2

    const xPlant1 = cursor + plantSpan / 2; cursor += plantSpan + gap2
    const xBench1 = cursor + benchSpan / 2 + 2.0; cursor += benchSpan + gap2
    const xPlant2 = cursor + plantSpan / 2; cursor += plantSpan + gap2
    const xBench2 = cursor + benchSpan / 2 - 2.0; cursor += benchSpan + gap2
    const xPlant3 = cursor + plantSpan / 2

    addPlantAt(xPlant1)
    addBenchAt(xBench1)
    addPlantAt(xPlant2)
    addBenchAt(xBench2)
    addPlantAt(xPlant3)

    // Photo frame on south wall
    const frameW2 = boardW
    const frameH2 = boardH
    const frameDepth2 = 0.08
    const frameThickness2 = 0.12
    const frameY2 = height * 0.7

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.3, metalness: 0.1 })
    const matteMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.9, metalness: 0.0 })
    disposables.push(frameMat, matteMat)

    const frameGroup = new THREE.Group()
    frameGroup.name = 'photo-frame-south'
    frameGroup.position.set(0, frameY2, innerSouthZ)
    frameGroup.rotation.y = Math.PI
    decoSouth.add(frameGroup)

    const backPanelGeo = new THREE.BoxGeometry(frameW2 + frameThickness2 * 2, frameH2 + frameThickness2 * 2, frameDepth2)
    const backPanelMat = new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.8, metalness: 0.0 })
    const backPanel = new THREE.Mesh(backPanelGeo, backPanelMat)
    backPanel.position.set(0, 0, 0)
    frameGroup.add(backPanel)
    disposables.push(backPanelGeo, backPanelMat)

    for (const [geo, pos] of [
      [new THREE.BoxGeometry(frameW2 + frameThickness2 * 2, frameThickness2, frameDepth2), [0, frameH2 / 2 + frameThickness2 / 2, frameDepth2 / 2 + 0.001]],
      [new THREE.BoxGeometry(frameW2 + frameThickness2 * 2, frameThickness2, frameDepth2), [0, -(frameH2 / 2 + frameThickness2 / 2), frameDepth2 / 2 + 0.001]],
      [new THREE.BoxGeometry(frameThickness2, frameH2, frameDepth2), [-(frameW2 / 2 + frameThickness2 / 2), 0, frameDepth2 / 2 + 0.001]],
      [new THREE.BoxGeometry(frameThickness2, frameH2, frameDepth2), [frameW2 / 2 + frameThickness2 / 2, 0, frameDepth2 / 2 + 0.001]],
    ]) {
      const m = new THREE.Mesh(geo, frameMat)
      m.position.set(...pos)
      frameGroup.add(m)
      disposables.push(geo)
    }

    const matteGeo = new THREE.PlaneGeometry(frameW2 * 0.92, frameH2 * 0.92)
    const matte = new THREE.Mesh(matteGeo, matteMat)
    matte.position.set(0, 0, frameDepth2 / 2 + 0.002)
    matte.rotation.y = Math.PI
    frameGroup.add(matte)
    disposables.push(matteGeo)

    const photoTexture = new THREE.TextureLoader().load(lobbyPhotoUrl)
    photoTexture.colorSpace = THREE.SRGBColorSpace
    const photoGeo = new THREE.PlaneGeometry(frameW2 + frameThickness2 * 2, frameH2 + frameThickness2 * 2)
    const photoMat = new THREE.MeshBasicMaterial({ map: photoTexture, side: THREE.DoubleSide })
    const photo = new THREE.Mesh(photoGeo, photoMat)
    photo.position.set(0, 0, frameDepth2 / 2 + 0.01)
    photo.rotation.y = Math.PI
    frameGroup.add(photo)
    disposables.push(photoGeo, photoMat, photoTexture)
  }

  group.add(markers)

  return {
    group,
    disposables,
    slots,
    doors,
    doorHitMeshes,
    pickableMeshes,
    obstacles,
    bounds: { halfW, halfL, height },
  }
}
