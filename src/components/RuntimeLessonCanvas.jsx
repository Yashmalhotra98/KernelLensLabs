import { createRuntimeZoomView } from '../lib/runtimeSemanticZoom.js'

function MemorySpace({ space }) {
  return (
    <div className={space.active ? 'vector-row memory-space-active' : 'vector-row'}>
      <div className="vector-row-label">
        <div>
          <strong>{space.label}</strong>
          <small>{space.kind}</small>
        </div>
        <span>{space.operation}</span>
      </div>
      <div className="vector-cells">
        {space.values.map((value, index) => (
          <div key={`${space.id}-${index}`} className={space.active ? 'vector-cell vector-cell-active' : 'vector-cell'}>
            <span>{index}</span>
            <strong>{value ?? '—'}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function AlgorithmView({ frame }) {
  const memoryLabels = frame.memorySpaces.map((space) => space.label).join(' · ')

  return (
    <section className="runtime-zoom-stage" aria-labelledby="algorithm-view-heading">
      <div className="runtime-view-heading">
        <p className="eyebrow">Algorithm view</p>
        <h3 id="algorithm-view-heading">What changes in this step?</h3>
      </div>
      <div className="runtime-algorithm-flow">
        <article>
          <span>01 · Data</span>
          <strong>{memoryLabels}</strong>
          <small>The values involved in this lesson stage.</small>
        </article>
        <i aria-hidden="true">→</i>
        <article>
          <span>02 · Operation</span>
          <strong>{frame.title}</strong>
          <small>{frame.threads.length} independent logical elements participate.</small>
        </article>
        <i aria-hidden="true">→</i>
        <article>
          <span>03 · Effect</span>
          <strong>{frame.phase}</strong>
          <small>{frame.description}</small>
        </article>
      </div>
    </section>
  )
}

function GpuView({ lesson, memorySpaces }) {
  return (
    <section className="runtime-zoom-stage" aria-labelledby="gpu-view-heading">
      <div className="runtime-view-heading">
        <p className="eyebrow">GPU view</p>
        <h3 id="gpu-view-heading">Launch topology and device memory</h3>
      </div>
      <div className="runtime-gpu-overview">
        <article className="runtime-topology-card">
          <span>Logical teaching topology</span>
          <strong>{lesson.view.topology}</strong>
          <small>This describes the lesson model, not measured hardware scheduling.</small>
        </article>
        <ul className="runtime-memory-summary" aria-label="Memory spaces participating in this event">
          {memorySpaces.map((space) => (
            <li key={space.id} data-active={space.active ? 'true' : 'false'}>
              <span>{space.kind}</span>
              <strong>{space.label}</strong>
              <small>{space.active ? space.operation : 'present · idle this event'}</small>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function ThreadGrid({ threads, mode }) {
  const scopeLabel = mode === 'lanes' ? 'Warp lane' : 'Thread'

  return (
    <section className="vector-thread-stage" aria-label={mode === 'lanes' ? 'Logical warp lanes' : 'Logical block threads'}>
      {threads.map((thread) => (
        <article key={thread.threadId} className="vector-thread" data-state={thread.state}>
          <div>
            <span>{scopeLabel}</span>
            <strong>{thread.threadId}</strong>
          </div>
          <small>{thread.label}</small>
          <small>{thread.detail}</small>
          <code>{thread.result === null ? thread.expression : `${thread.expression} → ${thread.result}`}</code>
        </article>
      ))}
    </section>
  )
}

function ThreadView({ frame, selectedThread, onThreadSelect }) {
  return (
    <section className="runtime-zoom-stage" aria-labelledby="thread-view-heading">
      <div className="runtime-view-heading">
        <p className="eyebrow">Thread view</p>
        <h3 id="thread-view-heading">Choose one logical lane to inspect</h3>
      </div>
      <div className="runtime-thread-picker" aria-label="Select a logical lane">
        {frame.threads.map((thread) => (
          <button
            type="button"
            key={thread.threadId}
            data-state={thread.state}
            data-selected={thread.threadId === selectedThread.threadId ? 'true' : 'false'}
            aria-pressed={thread.threadId === selectedThread.threadId}
            onClick={() => onThreadSelect(thread.threadId)}
          >
            <span>Lane</span>
            <strong>{thread.threadId}</strong>
          </button>
        ))}
      </div>
      <article className="runtime-thread-inspector" data-state={selectedThread.state}>
        <div>
          <span>Selected lane</span>
          <strong>{selectedThread.threadId}</strong>
        </div>
        <dl>
          <div><dt>Ownership</dt><dd>{selectedThread.label}</dd></div>
          <div><dt>Index / address</dt><dd>{selectedThread.detail}</dd></div>
          <div><dt>Current expression</dt><dd><code>{selectedThread.expression}</code></dd></div>
          <div><dt>Result</dt><dd>{selectedThread.result ?? 'not written yet'}</dd></div>
        </dl>
      </article>
    </section>
  )
}

export function RuntimeLessonCanvas({
  lesson,
  frame,
  result,
  level,
  selectedThreadId,
  onThreadSelect,
  preferWebGpu,
  onPreferWebGpuChange,
}) {
  const validation = result?.validation
  const supportsWebGpu = lesson.capabilities.webGpuValidation
  const zoomView = createRuntimeZoomView({ level, frame, selectedThreadId })

  let zoomContent
  if (zoomView.level === 'algorithm') {
    zoomContent = <AlgorithmView frame={frame} />
  } else if (zoomView.level === 'gpu') {
    zoomContent = <GpuView lesson={lesson} memorySpaces={zoomView.memorySpaces} />
  } else if (zoomView.level === 'thread') {
    zoomContent = <ThreadView frame={frame} selectedThread={zoomView.selectedThread} onThreadSelect={onThreadSelect} />
  } else {
    zoomContent = (
      <section className="runtime-zoom-stage" aria-labelledby={`${zoomView.level}-view-heading`}>
        <div className="runtime-view-heading">
          <p className="eyebrow">{zoomView.level} view</p>
          <h3 id={`${zoomView.level}-view-heading`}>{zoomView.title}</h3>
          <p>{zoomView.description}</p>
        </div>
        <ThreadGrid threads={zoomView.threads} mode={zoomView.threadMode} />
      </section>
    )
  }

  return (
    <>
      <div className="vector-phase-card">
        <div>
          <p className="eyebrow">Current event · {frame.phase}</p>
          <h3>{frame.title}</h3>
          <p>{frame.description}</p>
          {frame.insight ? <aside className="lesson-insight">Architecture note · {frame.insight}</aside> : null}
        </div>
        <span className="phase-counter">{frame.threads.length} logical lanes</span>
      </div>

      {zoomContent}

      {zoomView.memoryMode === 'cells' || zoomView.memoryMode === 'active' ? (
        <section className="vector-memory" aria-labelledby="runtime-memory-heading">
          <div className="vector-memory-heading">
            <div>
              <p className="eyebrow">Memory hierarchy</p>
              <h3 id="runtime-memory-heading">{zoomView.memoryMode === 'active' ? 'Memory active for this instruction' : 'Data movement for this block'}</h3>
            </div>
            <span>{zoomView.memoryMode === 'active' ? 'Inactive spaces are hidden at this scope' : 'Highlighted rows are active now'}</span>
          </div>
          {zoomView.memorySpaces.map((space) => <MemorySpace key={space.id} space={space} />)}
        </section>
      ) : null}

      <section className="compute-validation" aria-labelledby="compute-validation-heading">
        <div>
          <p className="eyebrow">Compute validation</p>
          <h3 id="compute-validation-heading">
            {validation ? (validation.matchesReference ? 'Output matches reference' : 'Output mismatch') : 'Run to validate output'}
          </h3>
          <p>
            {validation
              ? `Checked with ${validation.backend === 'webgpu' ? 'WebGPU compute' : 'the CPU reference backend'}.`
              : 'The teaching trace is deterministic; a compute backend checks the final numbers independently.'}
          </p>
          {validation?.fallbackReason ? <small>WebGPU fallback: {validation.fallbackReason}</small> : null}
        </div>

        <label className={supportsWebGpu ? 'backend-toggle' : 'backend-toggle backend-toggle-disabled'}>
          <input
            type="checkbox"
            checked={supportsWebGpu && preferWebGpu}
            disabled={!supportsWebGpu}
            onChange={(event) => onPreferWebGpuChange(event.target.checked)}
          />
          <span>{supportsWebGpu ? 'Prefer WebGPU when available' : 'CPU validation for this lesson'}</span>
        </label>
      </section>
    </>
  )
}
