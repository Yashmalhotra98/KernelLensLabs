export function ExecutionControls({
  status,
  isPlaying,
  frameIndex,
  frameCount,
  onAnalyze,
  onRun,
  onPause,
  onStep,
  onReset,
}) {
  const progress = frameCount <= 1 ? 0 : Math.round((frameIndex / (frameCount - 1)) * 100)

  return (
    <section className="execution-controls" aria-label="CUDA lesson execution controls">
      <div className="control-actions">
        <button type="button" className="control-button" onClick={onAnalyze}>
          Analyze
        </button>
        <button type="button" className="control-button control-button-primary" onClick={onRun}>
          <span aria-hidden="true">▶</span>
          {isPlaying ? 'Restart' : 'Run'}
        </button>
        <button type="button" className="control-button" onClick={onPause} disabled={!isPlaying}>
          <span aria-hidden="true">Ⅱ</span>
          Pause
        </button>
        <button type="button" className="control-button" onClick={onStep}>
          <span aria-hidden="true">›|</span>
          Step
        </button>
        <button type="button" className="control-button" onClick={onReset} disabled={frameIndex === 0 && !isPlaying}>
          Reset
        </button>
      </div>

      <div className="control-status">
        <span className="status-dot" data-status={status} />
        <span>{status}</span>
        <span className="control-divider" />
        <span>Frame {frameIndex + 1}/{frameCount}</span>
        <div className="progress-track" aria-label={`Playback ${progress}% complete`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  )
}
