export const EMOJI_ICON_MAP = {
  '👑': 'crown.svg',
  '🔥': 'fire.svg',
  '⚔️': 'sword.svg',
  '🎮': 'gamepad.svg',
  '📍': 'location.svg',
  '🏆': 'trophy.svg',
  '📝': 'form.svg',
  '📅': 'calendar.svg',
  '🕗': 'clock.svg',
  '💰': 'money.svg',
  '🎯': 'target.svg',
  '🧠': 'brain.svg',
  '💻': 'code.svg',
  '🎭': 'music.svg',
  '⚡': 'flash.svg',
  '🎤': 'music.svg',
  '🏐': 'sports.svg',
  '⚽': 'sports.svg',
  '🎱': 'billiards.svg',
  '🏓': 'pingpong.svg',
  '📚': 'books.svg',
  '🍿': 'popcorn.svg',
  '🎥': 'movie.svg',
  '👆': 'pointer.svg',
}

export const ARROW_ICON = 'arrow-right.svg'
export const ARROW_LEFT_ICON = 'arrow-left.svg'

export function getIconUrl(fileName) {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}icons/${fileName}`
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function replaceEmojisAndArrowsToHtml(text) {
  if (!text) return ''
  let out = escapeHtml(text)
  // arrows
  out = out.replace(/👉|->|→|↗/g, `<img class="inline-icon arrow-icon" src="${getIconUrl(ARROW_ICON)}" alt=">"/>`)
  // emoji replacements
  const keys = Object.keys(EMOJI_ICON_MAP).sort((a, b) => b.length - a.length)
  for (const k of keys) {
    const fname = EMOJI_ICON_MAP[k]
    const url = getIconUrl(fname)
    out = out.replace(new RegExp(escapeRegExp(k), 'g'), `<img class="emoji-icon" src="${url}" alt="${k}" />`)
  }
  return out.replace(/\n/g, '<br>')
}

export function loadIconImage(fileName, onload) {
  const img = new Image()
  img.decoding = 'async'
  img.onload = onload
  img.src = getIconUrl(fileName)
  return img
}
