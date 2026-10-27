import { useEffect, type RefObject } from 'react'

const pressable = '.tile, .appbar-btn, .pivot-item, .wp-tilt, button:not(.event-dialog *), a'
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// The Windows Phone "tilt effect": a pressed control leans away from the
// finger, as if pushed on that spot, and springs back when let go.
export function useTilt(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    let pressed: HTMLElement | null = null

    const release = () => {
      if (!pressed) return
      pressed.style.transition = 'transform 0.3s cubic-bezier(0.1, 0.9, 0.2, 1)'
      pressed.style.transform = ''
      pressed = null
    }

    const down = (e: PointerEvent) => {
      if (reduced() || e.button !== 0) return
      const target = (e.target as Element).closest<HTMLElement>(pressable)
      // Leave alone anything that already moves itself, and very wide rows
      if (!target || !el.contains(target) || target.style.transform) return
      const r = target.getBoundingClientRect()
      if (r.width > 640) return
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      // Big tiles lean less than small buttons
      const max = Math.max(5, Math.min(14, 1400 / Math.max(r.width, r.height)))
      pressed = target
      target.style.transition = 'transform 0.08s ease-out'
      target.style.transform = `perspective(700px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) scale(0.97)`
    }

    el.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('dragstart', release)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('dragstart', release)
    }
  }, [root])
}
