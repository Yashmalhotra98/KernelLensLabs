export function LessonSelector({ lessons, value, onChange }) {
  return (
    <label className="lesson-selector">
      <span>Lesson</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {lessons.map((lesson) => (
          <option key={lesson.id} value={lesson.id}>{lesson.shortTitle}</option>
        ))}
      </select>
    </label>
  )
}
