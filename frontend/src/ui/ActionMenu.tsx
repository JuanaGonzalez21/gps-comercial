import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { layoutViewport, placeMenu } from './menuPosition'
import { MoreVerticalIcon } from './panel-icons'
import './controls.css'

export interface ActionMenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  /** Destructive items are drawn in dark red and placed last by the caller. */
  tone?: 'default' | 'danger'
}

interface ActionMenuProps {
  /** Accessible name of the trigger, starting with the visible meaning: "Más acciones para Ana". */
  label: string
  items: readonly ActionMenuItem[]
}

const MENU_GAP = 4
/** Until it is measured the menu is already fixed (never in the card's flow) and invisible. */
const UNPLACED: CSSProperties = { position: 'fixed', top: 0, left: 0, visibility: 'hidden' }

/**
 * "⋮" menu button (WAI-ARIA menu button pattern): Enter/Space/ArrowDown open it on the first item,
 * arrows/Home/End move, Esc or Tab closes it and focus returns to the trigger. The menu is drawn
 * with fixed positioning so scrollable tables never clip it; it closes on scroll and resize.
 */
export function ActionMenu({ label, items }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<CSSProperties>(UNPLACED)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }, [])

  // Measure the menu, place it under the trigger (right-aligned, above when there is no room) and
  // only then move focus into it, without scrolling: a scroll would close it and move the trigger.
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!open || !buttonRef.current || !menu) return
    const { left, top } = placeMenu(
      buttonRef.current.getBoundingClientRect(),
      { width: menu.offsetWidth, height: menu.offsetHeight },
      layoutViewport(),
      MENU_GAP,
    )
    // Applied to the node right away so the focus below already sees the final position.
    menu.style.left = `${left}px`
    menu.style.top = `${top}px`
    menu.style.visibility = ''
    setStyle({ position: 'fixed', left, top })
    itemRefs.current[0]?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close(false)
    }
    const onViewportChange = () => close(false)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [open, close])

  const focusItem = (index: number) => {
    const count = items.length
    itemRefs.current[(index + count) % count]?.focus()
  }

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = itemRefs.current.findIndex((item) => item === document.activeElement)
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusItem(current + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusItem(current - 1)
        break
      case 'Home':
        event.preventDefault()
        focusItem(0)
        break
      case 'End':
        event.preventDefault()
        focusItem(items.length - 1)
        break
      case 'Escape':
        event.preventDefault()
        close(true)
        break
      case 'Tab':
        close(false)
        break
      default:
    }
  }

  return (
    <div className="action-menu">
      <button
        ref={buttonRef}
        type="button"
        className="icon-button action-menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <MoreVerticalIcon />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className="action-menu__list"
          style={style}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(node) => {
                itemRefs.current[index] = node
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={`action-menu__item${item.tone === 'danger' ? ' action-menu__item--danger' : ''}`}
              onClick={() => {
                // Focus goes back to the trigger first, so a dialog opened by the action
                // returns focus there when it closes.
                close(true)
                item.onSelect()
              }}
            >
              {item.icon && <span className="action-menu__icon">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
