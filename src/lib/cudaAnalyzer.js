const SUPPORTED_SIGNATURE = /(?:extern\s+"C"\s+)?__global__\s+void\s+matmul\s*\(/

const COMMON_IDENTIFIER_TYPOS = [
  { pattern: /\bthreadIDx\b/g, correct: 'threadIdx' },
  { pattern: /\bblockIDx\b/g, correct: 'blockIdx' },
  { pattern: /\bblockDIM\b/g, correct: 'blockDim' },
]

function getSourceLocation(source, index) {
  const beforeMatch = source.slice(0, index)
  const lines = beforeMatch.split('\n')

  return {
    line: lines.length,
    column: lines.at(-1).length + 1,
  }
}

function findLine(lines, pattern) {
  const index = lines.findIndex((line) => pattern.test(line))
  return index === -1 ? null : index + 1
}

function inspectDelimiters(source) {
  const openingFor = { ')': '(', ']': '[', '}': '{' }
  const closingFor = { '(': ')', '[': ']', '{': '}' }
  const stack = []
  let state = 'code'

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const nextCharacter = source[index + 1]

    if (state === 'line-comment') {
      if (character === '\n') state = 'code'
      continue
    }

    if (state === 'block-comment') {
      if (character === '*' && nextCharacter === '/') {
        state = 'code'
        index += 1
      }
      continue
    }

    if (state === 'string' || state === 'character') {
      if (character === '\\') {
        index += 1
        continue
      }

      if ((state === 'string' && character === '"') || (state === 'character' && character === "'")) {
        state = 'code'
      }
      continue
    }

    if (character === '/' && nextCharacter === '/') {
      state = 'line-comment'
      index += 1
      continue
    }

    if (character === '/' && nextCharacter === '*') {
      state = 'block-comment'
      index += 1
      continue
    }

    if (character === '"') {
      state = 'string'
      continue
    }

    if (character === "'") {
      state = 'character'
      continue
    }

    if (closingFor[character]) {
      stack.push({ character, index })
      continue
    }

    if (openingFor[character]) {
      const lastOpening = stack.pop()
      if (!lastOpening || lastOpening.character !== openingFor[character]) {
        return {
          message: `Unexpected '${character}'.`,
          ...getSourceLocation(source, index),
        }
      }
    }
  }

  const unmatchedOpening = stack.pop()
  if (unmatchedOpening) {
    return {
      message: `Missing '${closingFor[unmatchedOpening.character]}' for '${unmatchedOpening.character}'.`,
      ...getSourceLocation(source, unmatchedOpening.index),
    }
  }

  if (state === 'block-comment') {
    return {
      message: 'Unterminated block comment.',
      ...getSourceLocation(source, source.lastIndexOf('/*')),
    }
  }

  return null
}

function createDiagnostic({ code, severity, message, line = 1, column = 1, suggestion }) {
  return { code, severity, message, line, column, suggestion }
}

export function analyzeCudaSource(source) {
  if (typeof source !== 'string' || source.trim().length === 0) {
    const diagnostics = [
      createDiagnostic({
        code: 'CUDA001',
        severity: 'error',
        message: 'The source editor is empty.',
        suggestion: 'Restore the sample kernel or write a __global__ matmul kernel.',
      }),
    ]

    return {
      engine: 'browser-static-analysis',
      diagnostics,
      hasErrors: true,
      canSimulate: false,
      lineMap: {},
    }
  }

  const diagnostics = []
  const lines = source.split('\n')
  const delimiterError = inspectDelimiters(source)

  if (delimiterError) {
    diagnostics.push(
      createDiagnostic({
        code: 'CUDA002',
        severity: 'error',
        message: delimiterError.message,
        line: delimiterError.line,
        column: delimiterError.column,
        suggestion: 'Match every opening delimiter with the corresponding closing delimiter.',
      }),
    )
  }

  const signatureMatch = source.match(SUPPORTED_SIGNATURE)
  if (!signatureMatch) {
    diagnostics.push(
      createDiagnostic({
        code: 'CUDA003',
        severity: 'error',
        message: "The supported lesson requires an '__global__ void matmul(...)' kernel.",
        suggestion: 'Keep the matmul entry point so the simulator knows which kernel to visualize.',
      }),
    )
  }

  const signatureParameters = source.match(/matmul\s*\(([\s\S]*?)\)\s*\{/i)?.[1] ?? ''
  const missingParameters = ['A', 'B', 'C', 'N'].filter(
    (parameter) => !new RegExp(`\\b${parameter}\\b`).test(signatureParameters),
  )

  if (signatureMatch && missingParameters.length > 0) {
    diagnostics.push(
      createDiagnostic({
        code: 'CUDA004',
        severity: 'error',
        message: `The lesson ABI is missing parameter${missingParameters.length === 1 ? '' : 's'}: ${missingParameters.join(', ')}.`,
        line: getSourceLocation(source, signatureMatch.index).line,
        suggestion: 'Use the controlled parameters A, B, C, and N from the sample kernel.',
      }),
    )
  }

  for (const typo of COMMON_IDENTIFIER_TYPOS) {
    for (const match of source.matchAll(typo.pattern)) {
      const location = getSourceLocation(source, match.index)
      diagnostics.push(
        createDiagnostic({
          code: 'CUDA005',
          severity: 'error',
          message: `'${match[0]}' is not a CUDA built-in identifier.`,
          line: location.line,
          column: location.column,
          suggestion: `Did you mean '${typo.correct}'? CUDA identifiers are case-sensitive.`,
        }),
      )
    }
  }

  lines.forEach((line, index) => {
    const statement = line.trim()
    const isDeclaration = /^(?:const\s+)?(?:int|float|double|size_t)\s+\w+\s*=/.test(statement)
    const isAssignment = /^(?:\w+|\w+\s*\[[^\]]+\])\s*(?:=|\+=|-=|\*=|\/=)/.test(statement)
    const hasValidEnding = statement.endsWith(';') || statement.endsWith('{') || statement.endsWith('}')

    if ((isDeclaration || isAssignment) && !hasValidEnding) {
      diagnostics.push(
        createDiagnostic({
          code: 'CUDA006',
          severity: 'error',
          message: 'This statement is missing a semicolon.',
          line: index + 1,
          column: Math.max(line.length, 1),
          suggestion: "Add ';' at the end of the statement.",
        }),
      )
    }
  })

  if (/^\s*#\s*include/m.test(source)) {
    diagnostics.push(
      createDiagnostic({
        code: 'CUDA101',
        severity: 'warning',
        message: 'Browser analysis does not resolve external CUDA or C++ headers.',
        line: findLine(lines, /^\s*#\s*include/) ?? 1,
        suggestion: 'Keep this lesson self-contained. A future NVRTC service will support an allowed header set.',
      }),
    )
  }

  if (!/\bif\s*\([^)]*row\s*<\s*N[^)]*col\s*<\s*N/.test(source)) {
    diagnostics.push(
      createDiagnostic({
        code: 'CUDA102',
        severity: 'warning',
        message: 'No row/column bounds guard was recognized.',
        suggestion: 'Guard row < N and col < N before accessing A, B, or C.',
      }),
    )
  }

  const lineMap = {
    index: findLine(lines, /\bint\s+row\b/),
    column: findLine(lines, /\bint\s+col\b/),
    bounds: findLine(lines, /\bif\s*\(/),
    read: findLine(lines, /\bsum\s*\+=.*A\s*\[.*B\s*\[/),
    compute: findLine(lines, /\bsum\s*\+=/),
    write: findLine(lines, /\bC\s*\[.*\]\s*=/),
  }

  const hasRecognizedTopology = /\bblockIdx\b/.test(source)
    && /\bblockDim\b/.test(source)
    && /\bthreadIdx\b/.test(source)
  const hasRecognizedMatmul = lineMap.read !== null && lineMap.write !== null
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === 'error')
  const canSimulate = !hasErrors && Boolean(signatureMatch) && hasRecognizedTopology && hasRecognizedMatmul

  if (!hasErrors && !canSimulate) {
    diagnostics.push(
      createDiagnostic({
        code: 'CUDA103',
        severity: 'warning',
        message: 'The source is outside the naïve matrix-multiplication visualization subset.',
        suggestion: 'Use blockIdx, blockDim, threadIdx, an A/B accumulation, and a C write.',
      }),
    )
  }

  return {
    engine: 'browser-static-analysis',
    diagnostics,
    hasErrors,
    canSimulate,
    lineMap,
  }
}
