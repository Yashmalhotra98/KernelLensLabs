import { useEffect, useState } from 'react'
import { DiagnosticsPanel } from './components/DiagnosticsPanel.jsx'
import { ExecutionControls } from './components/ExecutionControls.jsx'
import { MemoryPanel } from './components/MemoryPanel.jsx'
import { SourceEditor } from './components/SourceEditor.jsx'
import { ThreadBlock } from './components/ThreadBlock.jsx'
import { analyzeCudaSource } from './lib/cudaAnalyzer.js'
import { DEFAULT_CUDA_SOURCE } from './lib/defaultCudaSource.js'
import { createMatmulSimulation } from './lib/matmulSimulation.js'

const SIMULATION = createMatmulSimulation()
const LAST_FRAME_INDEX = SIMULATION.frames.length - 1

const THREAD_STATES = [
  { label: 'Idle', state: 'idle' },
  { label: 'Global read', state: 'read' },
  { label: 'Compute', state: 'compute' },
  { label: 'Global write', state: 'write' },
  { label: 'Complete', state: 'complete' },
]

function App() {
  const [source, setSource] = useState(DEFAULT_CUDA_SOURCE)
  const [analysis, setAnalysis] = useState(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedThreadId, setSelectedThreadId] = useState(0)
  const [theme, setTheme] = useState('dark')

  const frame = SIMULATION.frames[frameIndex]
  const selectedThread = frame.threads.find((thread) => thread.threadId === selectedThreadId) ?? frame.threads[0]
  const activeLine = frame.sourceKey && analysis?.canSimulate
    ? analysis.lineMap[frame.sourceKey]
    : null

  let executionStatus = 'source edited'
  if (analysis?.hasErrors) executionStatus = 'analysis error'
  else if (analysis && !analysis.canSimulate) executionStatus = 'unsupported lesson'
  else if (isPlaying) executionStatus = 'running simulation'
  else if (frameIndex === LAST_FRAME_INDEX) executionStatus = 'complete'
  else if (frameIndex > 0) executionStatus = 'paused'
  else if (analysis?.canSimulate) executionStatus = 'ready'

  useEffect(() => {
    if (!isPlaying) return undefined

    if (frameIndex >= LAST_FRAME_INDEX) return undefined

    const timerId = window.setTimeout(() => {
      const nextFrameIndex = Math.min(frameIndex + 1, LAST_FRAME_INDEX)
      setFrameIndex(nextFrameIndex)
      if (nextFrameIndex === LAST_FRAME_INDEX) setIsPlaying(false)
    }, 700)

    return () => window.clearTimeout(timerId)
  }, [frameIndex, isPlaying])

  function analyzeCurrentSource() {
    const nextAnalysis = analyzeCudaSource(source)
    setAnalysis(nextAnalysis)
    return nextAnalysis
  }

  function handleSourceChange(nextSource) {
    setSource(nextSource)
    setAnalysis(null)
    setIsPlaying(false)
    setFrameIndex(0)
  }

  function handleAnalyze() {
    setIsPlaying(false)
    setFrameIndex(0)
    analyzeCurrentSource()
  }

  function handleRun() {
    const nextAnalysis = analyzeCurrentSource()
    if (!nextAnalysis.canSimulate) {
      setIsPlaying(false)
      return
    }

    if (frameIndex >= LAST_FRAME_INDEX) setFrameIndex(0)
    setIsPlaying(true)
  }

  function handleStep() {
    const nextAnalysis = analysis ?? analyzeCurrentSource()
    setIsPlaying(false)

    if (nextAnalysis.canSimulate) {
      setFrameIndex((currentIndex) => Math.min(currentIndex + 1, LAST_FRAME_INDEX))
    }
  }

  function handleReset() {
    setIsPlaying(false)
    setFrameIndex(0)
  }

  function handleRestoreSample() {
    setSource(DEFAULT_CUDA_SOURCE)
    setAnalysis(null)
    setIsPlaying(false)
    setFrameIndex(0)
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark">GPU</div>
          <div>
            <p>Parallel systems laboratory</p>
            <h1>Kernel / Scope</h1>
          </div>
        </div>

        <ExecutionControls
          status={executionStatus}
          isPlaying={isPlaying}
          frameIndex={frameIndex}
          frameCount={SIMULATION.frames.length}
          onAnalyze={handleAnalyze}
          onRun={handleRun}
          onPause={() => setIsPlaying(false)}
          onStep={handleStep}
          onReset={handleReset}
        />

        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          aria-pressed={theme === 'light'}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </header>

      <main className="workspace-grid">
        <div className="source-column">
          <SourceEditor
            source={source}
            activeLine={activeLine}
            onChange={handleSourceChange}
            onRestore={handleRestoreSample}
          />
          <DiagnosticsPanel analysis={analysis} />
        </div>

        <section className="execution-panel gpu-grid" aria-labelledby="grid-heading">
          <div className="execution-heading">
            <div>
              <p className="eyebrow">Deterministic lesson trace</p>
              <h2 id="grid-heading">{frame.title}</h2>
              <p>{frame.description}</p>
            </div>
            <div className="fidelity-badge">
              <span /> Simulated · not hardware measured
            </div>
          </div>

          <div className="thread-legend" aria-label="Thread state legend">
            {THREAD_STATES.map((item) => (
              <div key={item.state}>
                <span data-state={item.state} />
                {item.label}
              </div>
            ))}
          </div>

          <div className="thread-block-stage">
            <ThreadBlock
              blockId="0, 0, 0"
              threads={frame.threads}
              warp={frame.warp}
              selectedThreadId={selectedThreadId}
              onThreadSelect={setSelectedThreadId}
            />
          </div>

          <footer className="execution-footnote">
            <span>Engine: {SIMULATION.engine}</span>
            <span>Grid 1 × 1 × 1 · Block 4 × 4 × 1 · Warp size 32</span>
          </footer>
        </section>

        <MemoryPanel simulation={SIMULATION} frame={frame} selectedThread={selectedThread} />
      </main>

      <footer className="app-footer">
        <span>Browser-only lesson · source is never uploaded or saved</span>
        <span>Supported now: naïve 4 × 4 matrix multiplication</span>
      </footer>
    </div>
  )
}

export default App
