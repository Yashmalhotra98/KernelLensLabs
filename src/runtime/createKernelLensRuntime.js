import { advancedLessons } from '../lessons/advancedLessons.js'
import { vectorAddLesson } from '../lessons/vectorAddLesson.js'
import { cpuReferenceAdapter } from './adapters/cpuReferenceAdapter.js'

const LESSONS = [
  {
    id: 'matmul.naive',
    title: 'Naïve Matrix Multiplication',
    shortTitle: 'Naïve MatMul',
    category: 'Matrix operations',
    description: 'Existing deterministic block, warp, thread, and memory simulation.',
    executionKind: 'legacy-deterministic',
  },
  vectorAddLesson,
  ...advancedLessons,
]

function outputsMatch(actual, expected, tolerance = 1e-5) {
  return actual.length === expected.length
    && actual.every((value, index) => Math.abs(value - expected[index]) <= tolerance)
}

export function createKernelLensRuntime({ webGpuAdapter = null } = {}) {
  function listLessons() {
    return LESSONS.map(({ id, title, shortTitle, description, category, executionKind }) => ({
      id,
      title,
      shortTitle,
      description,
      category,
      executionKind,
    }))
  }

  function openLesson(lessonId) {
    const lesson = LESSONS.find((item) => item.id === lessonId)

    if (!lesson) throw new Error(`Unknown lesson '${lessonId}'.`)
    if (lesson.executionKind !== 'lesson-runtime') {
      throw new Error(`Lesson '${lessonId}' still uses the legacy simulator.`)
    }

    return {
      lesson,

      async run({ source = lesson.source, preferWebGpu = true } = {}) {
        const analysis = lesson.analyze(source)
        if (!analysis.canSimulate) return { status: 'rejected', analysis }

        const request = lesson.computeRequest
        const reference = await cpuReferenceAdapter.execute(request)
        let computed = reference
        let fallbackReason = null
        const canUseWebGpu = preferWebGpu
          && lesson.capabilities.webGpuValidation
          && webGpuAdapter
          && await webGpuAdapter.isAvailable()

        if (canUseWebGpu) {
          try {
            computed = await webGpuAdapter.execute(request)
          } catch (error) {
            fallbackReason = error instanceof Error ? error.message : String(error)
          }
        }

        return {
          status: 'complete',
          analysis,
          output: computed.output,
          recording: lesson.createRecording(reference.output),
          validation: {
            backend: computed.backend,
            matchesReference: outputsMatch(computed.output, reference.output),
            referenceOutput: reference.output,
            fallbackReason,
          },
        }
      },
    }
  }

  return { listLessons, openLesson }
}
