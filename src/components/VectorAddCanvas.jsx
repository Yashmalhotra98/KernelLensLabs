function VectorRow({ label, values, active, operation }) {
  return (
    <div className="vector-row">
      <div className="vector-row-label">
        <strong>{label}</strong>
        <span>{operation}</span>
      </div>
      <div className="vector-cells">
        {values.map((value, index) => (
          <div key={`${label}-${index}`} className={active ? 'vector-cell vector-cell-active' : 'vector-cell'}>
            <span>{index}</span>
            <strong>{value ?? '—'}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export function VectorAddCanvas({
  frame,
  inputs,
  result,
  preferWebGpu,
  onPreferWebGpuChange,
}) {
  const output = result?.output ?? Array.from({ length: inputs.a.length }, () => null)
  const validation = result?.validation

  return (
    <>
      <div className="vector-phase-card">
        <div>
          <p className="eyebrow">Current instruction · {frame.phase}</p>
          <h3>{frame.title}</h3>
          <p>{frame.description}</p>
        </div>
        <span className="phase-counter">{frame.threads.length} logical threads</span>
      </div>

      <section className="vector-thread-stage" aria-label="Vector addition logical threads">
        {frame.threads.map((thread) => (
          <article key={thread.threadId} className="vector-thread" data-state={thread.state}>
            <div>
              <span>Thread</span>
              <strong>{thread.threadId}</strong>
            </div>
            <small>index = {thread.index}</small>
            <code>
              {thread.result === null
                ? `${thread.a} + ${thread.b}`
                : `${thread.a} + ${thread.b} = ${thread.result}`}
            </code>
          </article>
        ))}
      </section>

      <section className="vector-memory" aria-labelledby="vector-memory-heading">
        <div className="vector-memory-heading">
          <div>
            <p className="eyebrow">Global memory</p>
            <h3 id="vector-memory-heading">Adjacent threads, adjacent addresses</h3>
          </div>
          <span>Coalesced 1-D access pattern</span>
        </div>
        <VectorRow label="A" values={inputs.a} active={frame.phase === 'read'} operation="read" />
        <VectorRow label="B" values={inputs.b} active={frame.phase === 'read'} operation="read" />
        <VectorRow label="C" values={output} active={frame.phase === 'write' || frame.phase === 'complete'} operation="write" />
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

        <label className="backend-toggle">
          <input
            type="checkbox"
            checked={preferWebGpu}
            onChange={(event) => onPreferWebGpuChange(event.target.checked)}
          />
          <span>Prefer WebGPU when available</span>
        </label>
      </section>
    </>
  )
}
