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

export function RuntimeLessonCanvas({
  lesson,
  frame,
  result,
  preferWebGpu,
  onPreferWebGpuChange,
}) {
  const validation = result?.validation
  const supportsWebGpu = lesson.capabilities.webGpuValidation

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

      <section className="vector-thread-stage" aria-label={`${lesson.title} logical threads`}>
        {frame.threads.map((thread) => (
          <article key={thread.threadId} className="vector-thread" data-state={thread.state}>
            <div>
              <span>Lane</span>
              <strong>{thread.threadId}</strong>
            </div>
            <small>{thread.label}</small>
            <small>{thread.detail}</small>
            <code>{thread.result === null ? thread.expression : `${thread.expression} → ${thread.result}`}</code>
          </article>
        ))}
      </section>

      <section className="vector-memory" aria-labelledby="runtime-memory-heading">
        <div className="vector-memory-heading">
          <div>
            <p className="eyebrow">Memory hierarchy</p>
            <h3 id="runtime-memory-heading">Data movement for this event</h3>
          </div>
          <span>Highlighted rows are active now</span>
        </div>
        {frame.memorySpaces.map((space) => <MemorySpace key={space.id} space={space} />)}
      </section>

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
