const STATE_LABELS = {
  idle: 'waiting',
  read: 'global read',
  compute: 'executing',
  write: 'global write',
  complete: 'complete',
}

export function WarpView({ frame, selectedThreadId, onThreadSelect }) {
  return (
    <div className="warp-view lesson-view-enter" aria-label="Warp 0 lane execution view">
      <header className="warp-issue-card">
        <div>
          <span className="eyebrow">Warp scheduler issues one instruction</span>
          <strong>{frame.title}</strong>
          <p>{frame.description}</p>
        </div>
        <dl>
          <div><dt>Active mask</dt><dd>{frame.warp.activeLaneMask}</dd></div>
          <div><dt>Allocated</dt><dd>16 / 32 lanes</dd></div>
          <div><dt>Warp state</dt><dd>{STATE_LABELS[frame.threads[0].threadState]}</dd></div>
        </dl>
      </header>

      <div className="warp-lane-board">
        <div className="warp-lane-board-heading">
          <span>Warp 00 · SIMT lane map</span>
          <span>Select a lane to preserve it at Thread scope</span>
        </div>
        <div className="warp-lane-grid">
          {Array.from({ length: 32 }, (_, laneId) => {
            const thread = frame.threads[laneId]
            const isAllocated = Boolean(thread)
            const isSelected = laneId === selectedThreadId

            return (
              <button
                type="button"
                key={laneId}
                className="warp-lane"
                data-allocated={isAllocated ? 'true' : 'false'}
                data-selected={isSelected ? 'true' : 'false'}
                data-state={thread?.threadState ?? 'inactive'}
                disabled={!isAllocated}
                onClick={() => onThreadSelect(laneId)}
                aria-pressed={isAllocated ? isSelected : undefined}
                aria-label={isAllocated
                  ? `Lane ${laneId}, thread ${thread.threadId}, ${STATE_LABELS[thread.threadState]}`
                  : `Lane ${laneId}, inactive because this block contains 16 threads`}
              >
                <span>L{String(laneId).padStart(2, '0')}</span>
                <strong>{isAllocated ? `T${String(laneId).padStart(2, '0')}` : '—'}</strong>
                <small>{isAllocated ? STATE_LABELS[thread.threadState] : 'inactive'}</small>
              </button>
            )
          })}
        </div>
      </div>

      <footer className="warp-principle">
        <span>SIMT</span>
        <p>Allocated lanes receive the same instruction. A predicate or branch can temporarily disable individual lanes.</p>
      </footer>
    </div>
  )
}
