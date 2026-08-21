import { useEffect, useState } from 'react'
import { AppHeader } from './components/AppHeader.jsx'
import { DiagnosticsPanel } from './components/DiagnosticsPanel.jsx'
import { ExecutionControls } from './components/ExecutionControls.jsx'
import { GranularityControl } from './components/GranularityControl.jsx'
import { LessonCanvas } from './components/LessonCanvas.jsx'
import { SourceEditor } from './components/SourceEditor.jsx'
import { VectorAddExperience } from './components/VectorAddExperience.jsx'
import { analyzeCudaSource } from './lib/cudaAnalyzer.js'
import { DEFAULT_CUDA_SOURCE } from './lib/defaultCudaSource.js'
import { createMatmulSimulation } from './lib/matmulSimulation.js'
import { VISUALIZATION_LEVELS } from './lib/visualizationLevels.js'
import { createKernelLensRuntime } from './runtime/createKernelLensRuntime.js'
import {
  getBlockLocalFrameIndex,
  getVirtualGpuFrame,
  VIRTUAL_BLOCKS,
  WAVE_COUNT,
} from './lib/virtualGpuScheduler.js'

const PHASE_SIMULATION = createMatmulSimulation()
const BLOCK_FRAME_COUNT = PHASE_SIMULATION.frames.length
const TOTAL_FRAME_COUNT = BLOCK_FRAME_COUNT * WAVE_COUNT
const LAST_FRAME_INDEX = TOTAL_FRAME_COUNT - 1
const BLOCK_SIMULATIONS = new Map(
  VIRTUAL_BLOCKS.map((block) => [
    block.blockId,
    createMatmulSimulation({ block: { x: block.coordinates.x, y: block.coordinates.y } }),
  ]),
)
const LESSONS = createKernelLensRuntime().listLessons()

const LEVEL_COPY = {
  algorithm: {
    title: 'From matrices to independent tiles',
    description: 'Start with the mathematical job before introducing GPU machinery.',
  },
  gpu: {
    title: 'Blocks scheduled across three SMs',
    description: 'Watch the block queue become concurrent work—and see the final-wave tail effect.',
  },
  block: {
    title: 'One block owns one output tile',
    description: 'Sixteen threads cooperate spatially, with one thread responsible for each tile cell.',
  },
  warp: {
    title: 'Threads execute as warp lanes',
    description: 'The scheduler broadcasts one instruction to 32 lanes; this block allocates the first 16.',
  },
  thread: {
    title: 'One thread computes one result',
    description: 'Inspect index arithmetic, conceptual registers, operands, and exact global-memory addresses.',
  },
}

function MatmulExperience({
  theme,
  onThemeChange,
  selectedLessonId,
  onLessonChange,
}) {
  const [source, setSource] = useState(DEFAULT_CUDA_SOURCE)
  const [analysis, setAnalysis] = useState(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [level, setLevel] = useState('algorithm')
  const [selectedBlockId, setSelectedBlockId] = useState(0)
  const [selectedThreadId, setSelectedThreadId] = useState(0)

  const selectedBlock = VIRTUAL_BLOCKS.find((block) => block.blockId === selectedBlockId) ?? VIRTUAL_BLOCKS[0]
  const phaseFrame = PHASE_SIMULATION.frames[frameIndex % BLOCK_FRAME_COUNT]
  const gpuFrame = getVirtualGpuFrame({
    frameIndex,
    blockFrameCount: BLOCK_FRAME_COUNT,
    activePhase: phaseFrame.phase,
  })
  const selectedBlockFrameIndex = getBlockLocalFrameIndex(selectedBlock, gpuFrame, BLOCK_FRAME_COUNT)
  const simulation = BLOCK_SIMULATIONS.get(selectedBlock.blockId) ?? PHASE_SIMULATION
  const selectedBlockStatus = gpuFrame.blocks.find((block) => block.blockId === selectedBlock.blockId)?.status
  const selectedBlockFrame = simulation.frames[selectedBlockFrameIndex]
  const frame = selectedBlockStatus === 'queued'
    ? {
        ...selectedBlockFrame,
        phase: 'queued',
        title: 'Waiting in block queue',
        description: `Block (${selectedBlock.coordinates.x}, ${selectedBlock.coordinates.y}) is not resident on an SM yet.`,
        sourceKey: null,
      }
    : selectedBlockFrame
  const selectedThread = frame.threads.find((thread) => thread.threadId === selectedThreadId) ?? frame.threads[0]
  const currentLevel = VISUALIZATION_LEVELS.find((item) => item.id === level) ?? VISUALIZATION_LEVELS[0]
  const levelCopy = LEVEL_COPY[currentLevel.id]
  const sourceFrame = level === 'algorithm' || level === 'gpu' ? phaseFrame : frame
  const activeLine = sourceFrame.sourceKey && analysis?.canSimulate
    ? analysis.lineMap[sourceFrame.sourceKey]
    : null

  let executionStatus = 'source edited'
  if (analysis?.hasErrors) executionStatus = 'analysis error'
  else if (analysis && !analysis.canSimulate) executionStatus = 'unsupported lesson'
  else if (isPlaying) executionStatus = 'running simulation'
  else if (frameIndex === LAST_FRAME_INDEX) executionStatus = 'complete'
  else if (frameIndex > 0) executionStatus = 'paused'
  else if (analysis?.canSimulate) executionStatus = 'ready'

  useEffect(() => {
    if (!isPlaying || frameIndex >= LAST_FRAME_INDEX) return undefined

    const timerId = window.setTimeout(() => {
      const nextFrameIndex = Math.min(frameIndex + 1, LAST_FRAME_INDEX)
      setFrameIndex(nextFrameIndex)
      if (nextFrameIndex === LAST_FRAME_INDEX) setIsPlaying(false)
    }, 420)

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
      <AppHeader
        controls={<ExecutionControls
          status={executionStatus}
          isPlaying={isPlaying}
          frameIndex={frameIndex}
          frameCount={TOTAL_FRAME_COUNT}
          onAnalyze={handleAnalyze}
          onRun={handleRun}
          onPause={() => setIsPlaying(false)}
          onStep={handleStep}
          onReset={handleReset}
        />}
        lessons={LESSONS}
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
          />
          <DiagnosticsPanel analysis={analysis} />
        </div>

        <section className="execution-panel gpu-grid" aria-labelledby="grid-heading">
          <div className="execution-heading">
            <div>
              <p className="eyebrow">Semantic zoom · {currentLevel.label}</p>
              <h2 id="grid-heading">{levelCopy.title}</h2>
              <p>{levelCopy.description}</p>
            </div>
            <div className="fidelity-badge">
              <span /> Educational model · not hardware measured
            </div>
          </div>

          <GranularityControl value={level} onChange={setLevel} />

          <LessonCanvas
            level={level}
            gpuFrame={gpuFrame}
            simulation={simulation}
            frame={frame}
            selectedBlock={selectedBlock}
            selectedThread={selectedThread}
            selectedThreadId={selectedThreadId}
            onBlockSelect={setSelectedBlockId}
            onThreadSelect={setSelectedThreadId}
          />

          <footer className="execution-footnote">
            <span>Engine: {simulation.engine}</span>
            <span>Wave {gpuFrame.waveIndex + 1}/{gpuFrame.waveCount} · Grid 2 × 2 · 3 virtual SMs · Block 4 × 4 · Warp 32</span>
          </footer>
        </section>
      </main>

      <footer className="app-footer">
        <span>Browser-only lesson · source is never uploaded or saved</span>
        <span>Supported now: naïve 8 × 8 matrix multiplication · simulated scheduling</span>
      </footer>
    </div>
  )
}

function App() {
  const [selectedLessonId, setSelectedLessonId] = useState('matmul.naive')
  const [theme, setTheme] = useState('dark')
  const sharedProps = {
    theme,
    onThemeChange: () => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark'),
    lessons: LESSONS,
    selectedLessonId,
    onLessonChange: setSelectedLessonId,
  }

  if (selectedLessonId === 'vector-add.basic') {
    return <VectorAddExperience {...sharedProps} />
  }

  return <MatmulExperience {...sharedProps} />
}

export default App
