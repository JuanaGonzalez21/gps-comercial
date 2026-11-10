import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom does not implement <dialog> modality yet; a minimal stand-in keeps Dialog testable.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
  }
}

// findBy*/waitFor default to 1 s; pages render after mocked fetch + TanStack Query, which can take
// longer when the machine is busy (seen when two suites ran in parallel). 5 s removes that flakiness.
configure({ asyncUtilTimeout: 5_000 })

afterEach(() => {
  cleanup()
})
