import test from 'node:test'
import assert from 'node:assert/strict'
import { createKernelLensRuntime } from '../src/runtime/createKernelLensRuntime.js'
import { createWebGpuComputeAdapter } from '../src/runtime/adapters/webGpuComputeAdapter.js'

test('lists the complete beginner CUDA curriculum', () => {
  const runtime = createKernelLensRuntime()

  assert.deepEqual(
    runtime.listLessons().map((lesson) => lesson.id),
    [
      'matmul.naive',
      'vector-add.basic',
      'vector-add.unified',
      'memory.coalescing',
      'matmul.tiled',
      'cublas.axpy',
      'cublas.gemm',
      'reduction.sum',
      'sorting.bitonic',
      'convolution-1d.naive',
      'convolution-1d.constant',
      'convolution-1d.tiled',
      'convolution-1d.cache',
      'convolution-2d.naive',
    ],
  )
})

test('runs every plugin lesson through the shared runtime contract', async () => {
  const runtime = createKernelLensRuntime({ webGpuAdapter: null })
  const pluginLessons = runtime.listLessons().filter((lesson) => lesson.executionKind === 'lesson-runtime')

  for (const lesson of pluginLessons) {
    const result = await runtime.openLesson(lesson.id).run({ preferWebGpu: false })

    assert.equal(result.status, 'complete', lesson.id)
    assert.equal(result.validation.backend, 'cpu-reference', lesson.id)
    assert.equal(result.validation.matchesReference, true, lesson.id)
    assert.ok(result.recording.frames.length >= 4, lesson.id)
  }
})

test('computes known matrix, reduction, and convolution reference outputs', async () => {
  const runtime = createKernelLensRuntime({ webGpuAdapter: null })
  const tiledMatmul = await runtime.openLesson('matmul.tiled').run({ preferWebGpu: false })
  const reduction = await runtime.openLesson('reduction.sum').run({ preferWebGpu: false })
  const convolution = await runtime.openLesson('convolution-1d.naive').run({ preferWebGpu: false })

  assert.deepEqual(tiledMatmul.output, [6, 3, 2, 5, 4, 9, 3, 5, 3, 3, 5, 4, 3, 5, 4, 2])
  assert.deepEqual(reduction.output, [36])
  assert.deepEqual(convolution.output, [-2, -3, -5, -2, 4, 4, 2, 2])
})

test('runs parallel bitonic sort as staged compare-exchange work', async () => {
  const runtime = createKernelLensRuntime({ webGpuAdapter: null })
  const result = await runtime.openLesson('sorting.bitonic').run({ preferWebGpu: false })

  assert.equal(result.status, 'complete')
  assert.deepEqual(result.output, [1, 2, 3, 4, 5, 6, 7, 8])
  assert.equal(result.recording.frames.filter((frame) => frame.phase === 'compare-exchange').length, 6)
  assert.equal(result.recording.frames.length, 10)
  assert.equal(result.recording.frames.at(-1).phase, 'complete')
})

test('rejects empty source for every plugin lesson', async () => {
  const runtime = createKernelLensRuntime({ webGpuAdapter: null })
  const pluginLessons = runtime.listLessons().filter((lesson) => lesson.executionKind === 'lesson-runtime')

  for (const lesson of pluginLessons) {
    const result = await runtime.openLesson(lesson.id).run({ source: '  ', preferWebGpu: false })

    assert.equal(result.status, 'rejected', lesson.id)
    assert.equal(result.analysis.hasErrors, true, lesson.id)
  }
})

test('runs the vector-add lesson with a deterministic CPU reference', async () => {
  const runtime = createKernelLensRuntime({ webGpuAdapter: null })
  const lessons = runtime.listLessons()

  assert.ok(lessons.some((lesson) => lesson.id === 'vector-add.basic'))

  const session = runtime.openLesson('vector-add.basic')
  const result = await session.run({ preferWebGpu: false })

  assert.equal(result.status, 'complete')
  assert.equal(result.validation.backend, 'cpu-reference')
  assert.equal(result.validation.matchesReference, true)
  assert.deepEqual(result.output, [9, 9, 9, 9, 9, 9, 9, 9])
  assert.equal(result.recording.frames.at(-1).phase, 'complete')
})

test('uses an available WebGPU adapter and compares it with the CPU reference', async () => {
  const webGpuAdapter = {
    async isAvailable() {
      return true
    },
    async execute() {
      return { backend: 'webgpu', output: [9, 9, 9, 9, 9, 9, 9, 9] }
    },
  }
  const runtime = createKernelLensRuntime({ webGpuAdapter })

  const result = await runtime.openLesson('vector-add.basic').run()

  assert.equal(result.validation.backend, 'webgpu')
  assert.equal(result.validation.matchesReference, true)
  assert.equal(result.validation.fallbackReason, null)
})

test('reports WebGPU as unavailable when the browser exposes no GPU interface', async () => {
  const adapter = createWebGpuComputeAdapter({ gpu: null })

  assert.equal(await adapter.isAvailable(), false)
})

test('falls back visibly when the preferred WebGPU execution fails', async () => {
  const runtime = createKernelLensRuntime({
    webGpuAdapter: {
      async isAvailable() {
        return true
      },
      async execute() {
        throw new Error('Device was lost during dispatch.')
      },
    },
  })

  const result = await runtime.openLesson('vector-add.basic').run()

  assert.equal(result.validation.backend, 'cpu-reference')
  assert.match(result.validation.fallbackReason, /Device was lost/)
  assert.equal(result.validation.matchesReference, true)
})
