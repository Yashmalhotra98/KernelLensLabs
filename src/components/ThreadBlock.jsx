import { ThreadCell } from './ThreadCell.jsx'

export function ThreadBlock({ blockId, threads, warp, selectedThreadId, onThreadSelect }) {
  const selectedThread = threads.find((thread) => thread.threadId === selectedThreadId) ?? threads[0]

  return (
    <article className="thread-block">
      <header className="thread-block-header">
        <div>
          <p className="eyebrow">Streaming multiprocessor workgroup</p>
          <h3>blockIdx [{blockId}]</h3>
        </div>
        <div className="block-metadata">
          <span>dim 4 × 4 × 1</span>
          <span>{threads.length} threads</span>
        </div>
      </header>

      <div className="thread-grid" aria-label={`Threads in block ${blockId}`}>
        {threads.map((thread) => (
          <ThreadCell
            key={thread.threadId}
            thread={thread}
            isSelected={thread.threadId === selectedThread.threadId}
            onSelect={onThreadSelect}
          />
        ))}
      </div>

      <section className="warp-strip" aria-label="Warp 0 lane occupancy">
        <div className="warp-strip-heading">
          <span>Warp 00</span>
          <span>active mask {warp.activeLaneMask}</span>
        </div>
        <div className="warp-lanes">
          {Array.from({ length: 32 }, (_, lane) => (
            <span
              key={lane}
              data-active={lane < threads.length ? 'true' : 'false'}
              data-selected={lane === selectedThread.laneId ? 'true' : 'false'}
              title={`Lane ${lane}: ${lane < threads.length ? 'allocated' : 'inactive'}`}
            />
          ))}
        </div>
      </section>

      <footer className="thread-inspector">
        <div>
          <span>Selected</span>
          <strong>T{String(selectedThread.threadId).padStart(2, '0')}</strong>
        </div>
        <dl>
          <div><dt>threadIdx</dt><dd>({selectedThread.coordinates.x}, {selectedThread.coordinates.y}, 0)</dd></div>
          <div><dt>warp / lane</dt><dd>{selectedThread.warpId} / {selectedThread.laneId}</dd></div>
          <div><dt>state</dt><dd>{selectedThread.threadState}</dd></div>
        </dl>
      </footer>
    </article>
  )
}
