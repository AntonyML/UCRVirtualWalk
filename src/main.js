import './style.css'
import { startYourEngines } from './engine/engine.js'
import { loadEventsData, getDayNames } from './data/dataLoader.js'
import { initActivityModal } from './ui/uiOverlay.js'
import { isMobileDevice } from './ui/mobileControls.js'

const app = document.querySelector('#app')
app.innerHTML = `
  <div id="scene-container">
    <canvas id="scene" aria-label="3D scene"></canvas>
  </div>
  <div id="overlay" aria-label="Click to start">
    <div id="overlay-titlebar">
      <div id="overlay-titlebar-inner">
        <img id="overlay-logo" src="https://guapiles.ucr.ac.cr/wp-content/uploads/2024/02/UCR01.png" alt="UCR logo" />
        <p>Semana U 2026 – UCR Guápiles</p>
      </div>
    </div>
    <div id="overlay-inner">
      <div id="overlay-title">Click para entrar</div>
      <div id="overlay-sub">WASD/Flechas para moverse · Ratón para mirar · ESCAPE para salir</div>
    </div>
    <div id="overlay-footer">
      <p>UCR Recinto de Guápiles</p>
    </div>
  </div>
  <div id="hud">
    <div id="crosshair" aria-hidden="true"></div>
  </div>
`

const canvas = document.querySelector('#scene')
const overlayEl = document.querySelector('#overlay-inner')
const crosshairEl = document.querySelector('#crosshair')

function requestPlay() {
  if (isMobileDevice()) {
    overlayEl.hidden = true
    document.body.classList.add('locked')
    return
  }
  canvas.requestPointerLock()
}

overlayEl.addEventListener('click', requestPlay)
overlayEl.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' || e.code === 'Space') requestPlay()
})

initActivityModal({
  onClose() {
    // Re-lock pointer after closing modal
    setTimeout(() => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock()
      }
    }, 100)
  },
})

let engineApi = null

async function init() {
  let eventsData = null
  try {
    eventsData = await loadEventsData()
  } catch (err) {
    console.warn('[UCRVirtualWalk] Failed to load events.json', err)
    eventsData = { days: [] }
  }

  const dayNames = getDayNames(eventsData)

  engineApi = startYourEngines({
    canvas,
    eventsData,
    roomMode: 'lobby',
    roomSpawn: { type: 'fromWall', wall: 'south' },
    lobbyDays: dayNames,
    onPointerLockChange(locked) {
      overlayEl.hidden = locked
      document.body.classList.toggle('locked', locked)
    },
    onDoorTrigger(door) {
      if (door && typeof door.dayName === 'string' && door.dayName.length > 0) {
        if (engineApi && typeof engineApi.setRoom === 'function') {
          engineApi.setRoom({
            roomMode: 'day',
            dayName: door.dayName,
            spawn: { type: 'fromWall', wall: 'south' },
          })
        }
        return
      }

      if (door && door.target === 'lobby') {
        if (engineApi && typeof engineApi.setRoom === 'function') {
          engineApi.setRoom({
            roomMode: 'lobby',
            spawn: { type: 'fromWall', wall: 'south' },
          })
        }
        return
      }

      if (door && door.target === 'back') {
        if (engineApi && typeof engineApi.setRoom === 'function') {
          engineApi.setRoom({
            roomMode: 'lobby',
            spawn: { type: 'fromWall', wall: 'south' },
          })
        }
        return
      }
    },
  })
}

init()
