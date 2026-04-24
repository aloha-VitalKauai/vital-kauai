'use client'

import { useEffect, useState } from 'react'

export type SectionIndexItem = {
  /** Display label (e.g. "Principle"). Rendered as the link text. */
  label: string
  /** Hash anchor on the same page (e.g. "#principle"). The leading "#" is required. */
  anchor: string
}

type Props = {
  sections: SectionIndexItem[]
  /**
   * Optional — anchor (with or without leading "#") of the section that should
   * render as active. When omitted, the component tracks scroll position and
   * highlights whichever section is currently in view.
   */
  activeSection?: string
  /**
   * Pixels of sticky-header height to offset clicks + the IntersectionObserver
   * by. Defaults to 130 to match the PortalNav (60) + week-tabs (~52) stack
   * used on the pre-ceremony page.
   */
  scrollOffset?: number
  /**
   * Optional — when set, the index becomes `position: sticky` at this top
   * offset (in pixels). Use when stacking under another sticky bar so the
   * index stays in view while members scroll through sections.
   */
  stickyTop?: number
}

const idOf = (anchor: string) => anchor.replace(/^#/, '')

export default function SectionIndex({
  sections,
  activeSection,
  scrollOffset = 130,
  stickyTop,
}: Props) {
  const [observed, setObserved] = useState<string | null>(null)
  const controlled = activeSection !== undefined

  // Auto-track active section via IntersectionObserver when the parent isn't
  // driving activeSection. Picks the visible section closest to the top of
  // the viewport (under the sticky header stack).
  useEffect(() => {
    if (controlled) return
    if (typeof window === 'undefined') return
    const ids = sections.map(s => idOf(s.anchor))
    const elements = ids
      .map(id => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el))
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length === 0) return
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        setObserved(visible[0].target.id)
      },
      { rootMargin: `-${scrollOffset}px 0px -55% 0px`, threshold: 0 },
    )
    elements.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [sections, controlled, scrollOffset])

  const active = controlled ? idOf(activeSection ?? '') : observed

  const handleClick = (e: React.MouseEvent, anchor: string) => {
    e.preventDefault()
    if (typeof window === 'undefined') return
    const el = document.getElementById(idOf(anchor))
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - scrollOffset
    window.scrollTo({ top, behavior: 'smooth' })
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', anchor)
    }
  }

  return (
    <>
      <style>{`
        .si-wrap { border-top: .5px solid rgba(28,43,30,.12); background: rgba(253,251,247,.97); }
        .si-inner { display: flex; gap: 0; overflow-x: auto; padding: 0 48px; scrollbar-width: none; }
        .si-inner::-webkit-scrollbar { display: none; }
        .si-link { font-family: inherit; font-size: 9.5px; font-weight: 400; letter-spacing: .26em; text-transform: uppercase; color: rgba(139,128,112,.7); text-decoration: none; padding: 16px 22px; border: none; background: none; cursor: pointer; white-space: nowrap; transition: color .2s; position: relative; }
        .si-link:hover { color: #1A1A18; }
        .si-link.active { color: #1C2B1E; font-weight: 500; }
        .si-link.active::after { content: ''; position: absolute; left: 22px; right: 22px; bottom: 8px; height: 1px; background: #C8A96E; }
        @media (max-width: 640px) {
          .si-inner { padding: 0 16px; }
          .si-link { padding: 12px 14px; font-size: 9px; letter-spacing: .2em; }
          .si-link.active::after { left: 14px; right: 14px; bottom: 6px; }
        }
      `}</style>
      <nav
        className="si-wrap"
        aria-label="Section index"
        style={stickyTop !== undefined ? { position: 'sticky', top: stickyTop, zIndex: 80 } : undefined}
      >
        <div className="si-inner">
          {sections.map(s => {
            const id = idOf(s.anchor)
            return (
              <a
                key={s.anchor}
                href={s.anchor}
                className={`si-link${active === id ? ' active' : ''}`}
                onClick={e => handleClick(e, s.anchor)}
              >
                {s.label}
              </a>
            )
          })}
        </div>
      </nav>
    </>
  )
}
