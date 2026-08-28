function findLine(lines, pattern) {
  const index = lines.findIndex((line) => pattern.test(line))
  return index === -1 ? null : index + 1
}

function createDiagnostic({ code, severity = 'error', message, suggestion, line = 1 }) {
  return { code, severity, message, suggestion, line, column: 1 }
}

export function createLessonAnalyzer({ lessonCode, requiredPatterns, linePatterns }) {
  return function analyzeLessonSource(source) {
    if (typeof source !== 'string' || source.trim().length === 0) {
      const diagnostics = [createDiagnostic({
        code: `${lessonCode}001`,
        message: 'The source editor is empty.',
        suggestion: 'Restore the lesson sample before analyzing it.',
      })]

      return {
        engine: 'lesson-pattern-analyzer',
        diagnostics,
        hasErrors: true,
        canSimulate: false,
        lineMap: {},
      }
    }

    const diagnostics = requiredPatterns.flatMap((requirement, index) => {
      if (requirement.pattern.test(source)) return []

      return [createDiagnostic({
        code: `${lessonCode}${String(index + 2).padStart(3, '0')}`,
        message: requirement.message,
        suggestion: requirement.suggestion,
      })]
    })
    const lines = source.split('\n')
    const lineMap = Object.fromEntries(
      Object.entries(linePatterns).map(([key, pattern]) => [key, findLine(lines, pattern)]),
    )
    const hasErrors = diagnostics.some((item) => item.severity === 'error')

    return {
      engine: 'lesson-pattern-analyzer',
      diagnostics,
      hasErrors,
      canSimulate: !hasErrors,
      lineMap,
    }
  }
}

function createThreads({ topology, stage, output }) {
  return Array.from({ length: topology.threadCount }, (_, index) => {
    const resultIndex = topology.resultIndex ? topology.resultIndex(index) : index
    const mayShowResult = topology.resultVisible ? topology.resultVisible(index) : true
    const result = stage.showResults && mayShowResult ? (output[resultIndex] ?? null) : null

    return {
      threadId: index,
      index,
      state: stage.threadState?.(index) ?? stage.state,
      label: topology.threadLabel?.(index) ?? `lane ${index}`,
      detail: topology.threadDetail?.(index) ?? `global index ${index}`,
      expression: stage.threadExpression?.(index) ?? stage.expression ?? 'waiting',
      result,
    }
  })
}

function createMemorySpaces(memorySpaces, stage, output) {
  return memorySpaces.map((space) => {
    const stageValues = stage.memoryValues?.[space.id]
    const valueSource = stageValues ?? space.values

    return {
      ...space,
      values: typeof valueSource === 'function' ? valueSource(output) : valueSource,
      active: stage.activeMemory?.includes(space.id) ?? false,
      operation: stage.memoryOperation?.[space.id] ?? 'idle',
    }
  })
}

export function createEducationalRecording({ id, topology, stages, memorySpaces }, output) {
  return {
    engine: `deterministic-${id}-v1`,
    frames: stages.map((stage) => ({
      phase: stage.phase,
      title: stage.title,
      description: stage.description,
      sourceKey: stage.sourceKey ?? null,
      insight: stage.insight ?? null,
      threads: createThreads({ topology, stage, output }),
      memorySpaces: createMemorySpaces(memorySpaces, stage, output),
    })),
  }
}

export function defineLesson(config) {
  const lesson = {
    ...config,
    executionKind: 'lesson-runtime',
    analyze: createLessonAnalyzer(config.analysis),
  }

  lesson.createRecording = (output) => createEducationalRecording(lesson, output)
  return lesson
}
