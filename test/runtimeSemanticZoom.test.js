import test from 'node:test'
import assert from 'node:assert/strict'
import { createKernelLensRuntime } from '../src/runtime/createKernelLensRuntime.js'
import { createRuntimeZoomView } from '../src/lib/runtimeSemanticZoom.js'
import { VISUALIZATION_LEVELS } from '../src/lib/visualizationLevels.js'

test('uses algorithm-neutral labels for the shared granularity control', () => {
  assert.deepEqual(
    VISUALIZATION_LEVELS.map((level) => level.detail),
    ['Problem and stages', 'Launch and scheduling', 'Thread ownership', 'Lane execution', 'Values and addresses'],
  )
})

test('projects every runtime lesson through the same five semantic zoom levels', () => {
  const runtime = createKernelLensRuntime()
  const lessons = runtime.listLessons().filter((lesson) => lesson.executionKind === 'lesson-runtime')

  for (const lessonSummary of lessons) {
    const lesson = runtime.openLesson(lessonSummary.id).lesson
    const frame = lesson.createRecording([]).frames[0]

    assert.equal(createRuntimeZoomView({ level: 'algorithm', frame }).threadMode, 'hidden', lesson.id)
    assert.equal(createRuntimeZoomView({ level: 'gpu', frame }).memoryMode, 'summary', lesson.id)
    assert.equal(createRuntimeZoomView({ level: 'block', frame }).threads.length, frame.threads.length, lesson.id)
    assert.equal(createRuntimeZoomView({ level: 'warp', frame }).threadMode, 'lanes', lesson.id)
    assert.equal(
      createRuntimeZoomView({ level: 'thread', frame, selectedThreadId: frame.threads.at(-1).threadId }).threads[0].threadId,
      frame.threads.at(-1).threadId,
      lesson.id,
    )
  }
})
