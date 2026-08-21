import test from 'node:test'
import assert from 'node:assert/strict'
import { createKernelLensRuntime } from '../src/runtime/createKernelLensRuntime.js'
import { createWebGpuComputeAdapter } from '../src/runtime/adapters/webGpuComputeAdapter.js'

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
