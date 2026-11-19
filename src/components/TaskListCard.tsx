import React, { useState } from 'react';
import { CheckSquare, Plus, Trash2, X } from 'lucide-react';
import { TaskCategory, TaskItem } from '../types/wellness';

interface TaskListCardProps {
  tasks: TaskItem[];
  onAddTask: (task: Omit<TaskItem, 'id' | 'completed' | 'createdAt'>) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

const CATEGORIES: TaskCategory[] = ['Fitness', 'Wellness', 'Study', 'Diet'];

export const TaskListCard: React.FC<TaskListCardProps> = ({
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('Fitness');
  const [dueTime, setDueTime] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');
  const [formError, setFormError] = useState<string | null>(null);

  const completedCount = tasks.filter((t) => t.completed).length;
  const completionPct =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const visibleTasks = tasks.filter((task) => {
    if (filter === 'active') return !task.completed;
    if (filter === 'done') return task.completed;
    return true;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = title.trim();
    if (!cleaned) {
      setFormError('Enter a task description before saving.');
      return;
    }
    onAddTask({
      title: cleaned,
      category,
      dueTime: dueTime.trim() || undefined,
    });
    setTitle('');
    setDueTime('');
    setFormError(null);
  };

  return (
    <section
      aria-labelledby="home-tasks-heading"
      className="editorial-card flex flex-col justify-between rounded-2xl p-5"
    >
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E8E0D1] pb-3.5">
          <div>
            <p className="text-xs font-medium text-[#5C5046] tabular-metrics">
              Daily Checklist · {completedCount} / {tasks.length} completed ({completionPct}%)
            </p>
            <h2
              id="home-tasks-heading"
              className="mt-0.5 font-serif text-lg font-bold text-[#1F1916]"
            >
              Today&apos;s Task List
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowCreateForm((prev) => !prev);
              setFormError(null);
            }}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#C85A28] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#B04A1D] whitespace-nowrap"
          >
            {showCreateForm ? (
              <>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Close
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Create Task
              </>
            )}
          </button>
        </div>

        {/* Completion bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#EFE8D8]">
          <div
            className="h-full rounded-full bg-[#2D6A4F] transition-all duration-300"
            style={{ width: `${completionPct}%` }}
          />
        </div>

        {/* Inline Create Task Form (Add as many tasks as needed) */}
        {showCreateForm && (
          <form
            onSubmit={handleSubmit}
            className="mt-3.5 space-y-2.5 rounded-xl border border-[#DDD4C3] bg-[#F9F6EE] p-3.5"
            noValidate
          >
            <div>
              <label htmlFor="new-task-title" className="block text-xs font-medium text-[#5C5046]">
                Task Description
              </label>
              <input
                id="new-task-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., 20-min evening mobility walk or 2L water before 6pm"
                className="mt-1 w-full rounded-lg border border-[#DDD4C3] bg-[#FDFBF7] px-3 py-2 text-xs text-[#1F1916] placeholder:text-[#8E8174] focus:border-[#C85A28] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="new-task-category"
                  className="block text-xs font-medium text-[#5C5046]"
                >
                  Category
                </label>
                <select
                  id="new-task-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TaskCategory)}
                  className="mt-1 w-full rounded-lg border border-[#DDD4C3] bg-[#FDFBF7] px-2.5 py-2 text-xs text-[#1F1916] focus:border-[#C85A28] focus:outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="new-task-time" className="block text-xs font-medium text-[#5C5046]">
                  Time (optional)
                </label>
                <input
                  id="new-task-time"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#DDD4C3] bg-[#FDFBF7] px-2.5 py-2 text-xs tabular-metrics text-[#1F1916] focus:border-[#C85A28] focus:outline-none"
                />
              </div>
            </div>

            {formError && (
              <p role="alert" className="text-xs font-medium text-[#B91C1C]">
                {formError}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2D6A4F] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#23543E]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Save Task
              </button>
            </div>
          </form>
        )}

        {/* Filter Tabs */}
        {tasks.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5">
            {(['all', 'active', 'done'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ${
                  filter === tab
                    ? 'bg-[#EFE8D8] text-[#1F1916]'
                    : 'text-[#5C5046] hover:text-[#1F1916]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Interactive Checkbox List */}
        {visibleTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-7 text-center">
            <CheckSquare className="h-7 w-7 text-[#B5A998]" aria-hidden="true" />
            <p className="mt-2 text-xs font-semibold text-[#1F1916]">
              {tasks.length === 0 ? 'No tasks scheduled yet' : `No ${filter} tasks`}
            </p>
            <p className="mt-0.5 text-[11px] text-[#5C5046]">
              Click &ldquo;Create Task&rdquo; above to add workout, study, or wellness checkboxes.
            </p>
          </div>
        ) : (
          <ul
            className="no-scrollbar mt-2 max-h-60 divide-y divide-[#EFE8D8] overflow-y-auto pr-1"
            data-testid="home-task-list"
          >
            {visibleTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-2.5 py-2.5">
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => onToggleTask(task.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-[#2D6A4F]"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-xs font-medium leading-snug ${
                        task.completed ? 'text-[#8E8174] line-through' : 'text-[#1F1916]'
                      }`}
                    >
                      {task.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[#5C5046] tabular-metrics">
                      {task.category}
                      {task.dueTime ? ` · ${task.dueTime}` : ''}
                    </span>
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => onDeleteTask(task.id)}
                  aria-label={`Delete task ${task.title}`}
                  className="flex min-h-[34px] min-w-[34px] shrink-0 items-center justify-center rounded-lg text-[#5C5046] transition-colors hover:bg-[#B91C1C]/10 hover:text-[#B91C1C]"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
