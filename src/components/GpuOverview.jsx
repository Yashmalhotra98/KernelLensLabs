function BlockIdentity({ block }) {
  return (
    <>
      <strong>B{block.blockId}</strong>
      <span>blockIdx ({block.coordinates.x}, {block.coordinates.y})</span>
    </>
  )
}

export function GpuOverview({ gpuFrame, selectedBlockId, onBlockSelect }) {
  return (
    <div className="gpu-overview lesson-view-enter" aria-label="Virtual GPU scheduling overview">
      <div className="scheduler-strip">
        <div>
          <span className="eyebrow">Grid scheduler</span>
          <strong>Wave {gpuFrame.waveIndex + 1} / {gpuFrame.waveCount}</strong>
        </div>
        <div className="block-queue" aria-label="Pending block queue">
          <span>Pending</span>
          {gpuFrame.queuedBlocks.length > 0
            ? gpuFrame.queuedBlocks.map((block) => <b key={block.blockId}>B{block.blockId}</b>)
            : <small>queue empty</small>}
        </div>
      </div>

      <div className="sm-bank">
        {gpuFrame.sms.map((sm) => {
          const block = sm.activeBlock
          const isSelected = block?.blockId === selectedBlockId

          return (
            <button
              type="button"
              key={sm.smId}
              className="sm-card"
              data-status={sm.status}
              data-selected={isSelected ? 'true' : 'false'}
              disabled={!block}
              onClick={() => block && onBlockSelect(block.blockId)}
              aria-pressed={block ? isSelected : undefined}
              aria-label={block
                ? `SM ${sm.smId}, running block ${block.blockId}, ${block.status}`
                : `SM ${sm.smId}, idle during the tail wave`}
            >
              <header>
                <span>Streaming multiprocessor</span>
                <strong>SM {String(sm.smId).padStart(2, '0')}</strong>
              </header>
              <div className="sm-resident-block">
                {block
                  ? <BlockIdentity block={block} />
                  : <><strong>Idle</strong><span>No resident block</span></>}
              </div>
              <footer>
                <span>{block ? '1 resident block' : 'resources available'}</span>
                <span>{block ? '1 warp · 16 threads' : '0 active warps'}</span>
              </footer>
            </button>
          )
        })}
      </div>

      <div className="memory-fabric">
        <div className="memory-bus-lines" aria-hidden="true">
          <span /><span /><span />
        </div>
        <div className="memory-fabric-card">
          <div>
            <span className="eyebrow">Device-wide path</span>
            <strong>L2 cache + global memory</strong>
          </div>
          <p>SMs exchange matrix data through the memory hierarchy—not direct SM-to-SM links.</p>
        </div>
      </div>

      {gpuFrame.tailEffect ? (
        <aside className="tail-effect-note">
          <span>Performance concept</span>
          <strong>Tail effect: two SMs are idle while the final block finishes.</strong>
        </aside>
      ) : null}
    </div>
  )
}
