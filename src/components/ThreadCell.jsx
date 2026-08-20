const THREAD_STATE_LABELS = {
  idle: 'Idle',
  read: 'Reading global memory',
  compute: 'Computing',
  write: 'Writing global memory',
  complete: 'Complete',
}

export function ThreadCell({ thread, isSelected, onSelect }) {
  const stateLabel = THREAD_STATE_LABELS[thread.threadState]

  if (!stateLabel) {
    throw new Error(`Unsupported thread state: ${thread.threadState}`)
  }

  return (
    <button
      type="button"
      className="thread-cell"
      data-state={thread.threadState}
      data-selected={isSelected ? 'true' : 'false'}
      onClick={() => onSelect(thread.threadId)}
      aria-label={`Thread ${thread.threadId}: ${stateLabel}; lane ${thread.laneId}`}
      aria-pressed={isSelected}
      title={`threadIdx (${thread.coordinates.x}, ${thread.coordinates.y}, 0) · warp ${thread.warpId} · lane ${thread.laneId}`}
    >
      <span className="thread-state-dot" />
      <span className="thread-coordinate">({thread.coordinates.x},{thread.coordinates.y})</span>
      <strong>T{String(thread.threadId).padStart(2, '0')}</strong>
      <small>lane {String(thread.laneId).padStart(2, '0')}</small>
    </button>
  )
}
