import { LessonSelector } from './LessonSelector.jsx'

export function AppHeader({
  controls,
  lessons,
  selectedLessonId,
  onLessonChange,
  theme,
  onThemeChange,
}) {
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <div className="brand-mark">GPU</div>
        <div>
          <p>Kuppannagari AI3 Lab</p>
          <h1>KernelLens</h1>
        </div>
      </div>

      {controls}

      <div className="header-tools">
        <LessonSelector
          lessons={lessons}
          value={selectedLessonId}
          onChange={onLessonChange}
        />
        <button
          type="button"
          className="theme-toggle"
          onClick={onThemeChange}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          aria-pressed={theme === 'light'}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  )
}
