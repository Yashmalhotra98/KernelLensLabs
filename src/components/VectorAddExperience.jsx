import { useEffect, useState } from 'react'
import { AppHeader } from './AppHeader.jsx'
import { DiagnosticsPanel } from './DiagnosticsPanel.jsx'
import { ExecutionControls } from './ExecutionControls.jsx'
import { SourceEditor } from './SourceEditor.jsx'
import { VectorAddCanvas } from './VectorAddCanvas.jsx'
import { createKernelLensRuntime } from '../runtime/createKernelLensRuntime.js'
import { createWebGpuComputeAdapter } from '../runtime/adapters/webGpuComputeAdapter.js'

const RUNTIME = createKernelLensRuntime({
  webGpuAdapter: createWebGpuComputeAdapter(),
})
const SESSION = RUNTIME.openLesson('vector-add.basic')
const PREVIEW_RECORDING = SESSION.lesson.createRecording([])
const LAST_FRAME_INDEX = PREVIEW_RECORDING.frames.length - 1

export function VectorAddExperience({
  theme,
  onThemeChange,
  lessons,
  selectedLessonId,
  onLessonChange,
}) {
  const [source, setSource] = useState(SESSION.lesson.source)
  const [analysis, setAnalysis] = useState(null)
  const [result, setResult] = useState(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [preferWebGpu, setPreferWebGpu] = useState(true)

  const recording = result?.recording ?? PREVIEW_RECORDING
  const frame = recording.frames[frameIndex]
  const activeLine = frame.sourceKey && analysis?.canSimulate
    ? analysis.lineMap[frame.sourceKey]
    : null

  let executionStatus = 'source edited'
  if (analysis?.hasErrors) executionStatus = 'analysis error'
  else if (isExecuting) executionStatus = 'validating output'
  else if (isPlaying) executionStatus = 'running simulation'
  else if (result && frameIndex === LAST_FRAME_INDEX) executionStatus = 'complete'
  else if (result && frameIndex > 0) executionStatus = 'paused'
  else if (analysis?.canSimulate) executionStatus = 'ready'

  useEffect(() => {
    if (!isPlaying || frameIndex >= LAST_FRAME_INDEX) return undefined

    const timerId = window.setTimeout(() => {
      const nextFrameIndex = Math.min(frameIndex + 1, LAST_FRAME_INDEX)
      setFrameIndex(nextFrameIndex)
      if (nextFrameIndex === LAST_FRAME_INDEX) setIsPlaying(false)
    }, 620)

    return () => window.clearTimeout(timerId)
  }, [frameIndex, isPlaying])

  function handleSourceChange(nextSource) {
    setSource(nextSource)
    setAnalysis(null)
    setResult(null)
    setIsPlaying(false)
    setFrameIndex(0)
  }

  function handleAnalyze() {
    setIsPlaying(false)
    setFrameIndex(0)
    setAnalysis(SESSION.lesson.analyze(source))
  }

  async function executeCurrentSource() {
    const nextAnalysis = SESSION.lesson.analyze(source)
    setAnalysis(nextAnalysis)

    if (!nextAnalysis.canSimulate) {
      setIsPlaying(false)
      return null
    }

    setIsExecuting(true)
    try {
      const nextResult = await SESSION.run({ source, preferWebGpu })
      setResult(nextResult)
      return nextResult
    } finally {
      setIsExecuting(false)
    }
  }

  async function handleRun() {
    setIsPlaying(false)
    const nextResult = await executeCurrentSource()
    if (!nextResult) return

    setFrameIndex(0)
    setIsPlaying(true)
  }

  async function handleStep() {
    setIsPlaying(false)
    const nextResult = result ?? await executeCurrentSource()
    if (!nextResult) return

    setFrameIndex((currentIndex) => Math.min(currentIndex + 1, LAST_FRAME_INDEX))
  }

  function handleReset() {
    setIsPlaying(false)
    setFrameIndex(0)
  }

  function handleRestoreSample() {
    setSource(SESSION.lesson.source)
    setAnalysis(null)
    setResult(null)
    setIsPlaying(false)
    setFrameIndex(0)
  }

  const controls = (
    <ExecutionControls
      status={executionStatus}
      isPlaying={isPlaying}
      frameIndex={frameIndex}
      frameCount={recording.frames.length}
      onAnalyze={handleAnalyze}
      onRun={handleRun}
      onPause={() => setIsPlaying(false)}
      onStep={handleStep}
      onReset={handleReset}
    />
  )

  return (
    <div className="app-shell" data-theme={theme}>
      <AppHeader
        controls={controls}
        lessons={lessons}
        selectedLessonId={selectedLessonId}
        onLessonChange={onLessonChange}
        theme={theme}
        onThemeChange={onThemeChange}
      />

      <main className="workspace-grid">
        <div className="source-column">
          <SourceEditor
            source={source}
            activeLine={activeLine}
            onChange={handleSourceChange}
            onRestore={handleRestoreSample}
            filename={SESSION.lesson.filename}
            ariaLabel="Editable CUDA vector addition kernel"
          />
          <DiagnosticsPanel analysis={analysis} />
        </div>

        <section className="execution-panel gpu-grid" aria-labelledby="vector-heading">
          <div className="execution-heading">
            <div>
              <p className="eyebrow">Lesson runtime · Vector addition</p>
              <h2 id="vector-heading">One thread, one output element</h2>
              <p>Follow CUDA indexing from the source line to each logical thread and global-memory address.</p>
            </div>
            <div className="fidelity-badge">
              <span /> Deterministic trace · computed validation
            </div>
          </div>

          <VectorAddCanvas
            frame={frame}
            inputs={SESSION.lesson.inputs}
            result={result}
            preferWebGpu={preferWebGpu}
            onPreferWebGpuChange={setPreferWebGpu}
          />

          <footer className="execution-footnote">
            <span>Trace: {recording.engine}</span>
            <span>Grid 1 × 1 · Block 8 × 1 · 8 active lanes · Warp size 32</span>
          </footer>
        </section>
      </main>

      <footer className="app-footer">
        <span>Source stays in this browser and is not saved</span>
        <span>WebGPU validates output when available; CPU fallback is automatic</span>
      </footer>
    </div>
  )
}
