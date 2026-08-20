import { ThreadCell } from './ThreadCell.jsx'

export function ThreadBlock({ blockId, threads, selectedThreadId, onThreadSelect }) {
  const selectedThread = threads.find((thread) => thread.threadId === selectedThreadId) ?? threads[0]

  return (
    <article className="thread-block">
      <header className="thread-block-header">
        <div>
          <p className="eyebrow">CUDA thread block</p>
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

      <footer className="thread-inspector">
        <div>
          <span>Selected</span>
          <strong>T{String(selectedThread.threadId).padStart(2, '0')}</strong>
        </div>
        <dl>
          <div><dt>threadIdx</dt><dd>({selectedThread.coordinates.x}, {selectedThread.coordinates.y}, 0)</dd></div>
          <div><dt>global output</dt><dd>C[{selectedThread.registers.row}, {selectedThread.registers.column}]</dd></div>
          <div><dt>state</dt><dd>{selectedThread.threadState}</dd></div>
        </dl>
      </footer>
    </article>
  )
}
