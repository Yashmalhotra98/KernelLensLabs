export function LessonSelector({ lessons, value, onChange }) {
  const categories = lessons.reduce((groups, lesson) => {
    const categoryLessons = groups.get(lesson.category) ?? []
    categoryLessons.push(lesson)
    groups.set(lesson.category, categoryLessons)
    return groups
  }, new Map())

  return (
    <label className="lesson-selector">
      <span>Lesson</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {[...categories].map(([category, categoryLessons]) => (
          <optgroup key={category} label={category}>
            {categoryLessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>{lesson.shortTitle}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
