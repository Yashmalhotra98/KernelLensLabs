const ZOOM_LEVELS = {
  algorithm: {
    title: 'Algorithm intent',
    description: 'Read the mathematical stage as inputs, an operation, and an output before introducing GPU machinery.',
    threadMode: 'hidden',
    memoryMode: 'hidden',
  },
  gpu: {
    title: 'GPU launch and memory spaces',
    description: 'See the logical launch shape and which device memory spaces participate in this event.',
    threadMode: 'hidden',
    memoryMode: 'summary',
  },
  block: {
    title: 'Block-level cooperation',
    description: 'See the complete working group, thread ownership, and data shared during this event.',
    threadMode: 'threads',
    memoryMode: 'cells',
  },
  warp: {
    title: 'Warp lane execution',
    description: 'Read the same work as SIMT lanes following the current instruction together.',
    threadMode: 'lanes',
    memoryMode: 'active',
  },
  thread: {
    title: 'Single-thread inspection',
    description: 'Select one logical lane to inspect its ownership, expression, result, and active data.',
    threadMode: 'single',
    memoryMode: 'active',
  },
}

export function createRuntimeZoomView({ level, frame, selectedThreadId = 0 }) {
  const configuration = ZOOM_LEVELS[level]

  if (!configuration) {
    throw new Error(`Unknown runtime zoom level: ${level}`)
  }

  const selectedThread = frame.threads.find((thread) => thread.threadId === selectedThreadId)
    ?? frame.threads[0]
  const activeMemorySpaces = frame.memorySpaces.filter((space) => space.active)
  const focusedMemorySpaces = activeMemorySpaces.length > 0 ? activeMemorySpaces : frame.memorySpaces

  let threads = frame.threads
  if (configuration.threadMode === 'hidden') threads = []
  if (configuration.threadMode === 'single') threads = selectedThread ? [selectedThread] : []

  let memorySpaces = frame.memorySpaces
  if (configuration.memoryMode === 'hidden') memorySpaces = []
  if (configuration.memoryMode === 'active') memorySpaces = focusedMemorySpaces

  return {
    ...configuration,
    level,
    threads,
    memorySpaces,
    selectedThread,
  }
}
