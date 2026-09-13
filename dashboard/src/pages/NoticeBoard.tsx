import { useState, useMemo, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Phone,
  MessageSquare,
  Clock,
  Trash2,
  CheckCircle2,
  CalendarClock,
  User,
} from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';
import { Modal } from '../components/Modal';
import { idbGet, idbSet } from '../utils/indexedDbStore';
import './NoticeBoard.css';

export interface NoticeTask {
  id: string;
  title: string;
  contactName?: string;
  contactPhone?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  type: 'call' | 'whatsapp' | 'followup' | 'other';
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  completed: boolean;
  createdAt: string;
}

const STORAGE_KEY = 'leadweave_noticeboard_tasks';

export function NoticeBoard() {
  useDocumentTitle('Notice Board & Calendar - LeadWeave');
  const { success, actionToast } = useToast();

  // Tasks state with IndexedDB persistence
  const [tasks, setTasks] = useState<NoticeTask[]>([]);

  useEffect(() => {
    idbGet<NoticeTask[]>(STORAGE_KEY)
      .then(stored => {
        if (stored && Array.isArray(stored)) {
          const cleanTasks = stored.filter(t => t.id !== 'task_1' && t.id !== 'task_2');
          setTasks(cleanTasks);
          idbSet(STORAGE_KEY, cleanTasks).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    idbSet(STORAGE_KEY, tasks).catch(() => {});
  }, [tasks]);

  // Calendar Navigation State
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('all');

  // Modal State for New / Edit Task
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskContactName, setTaskContactName] = useState('');
  const [taskContactPhone, setTaskContactPhone] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [taskDueTime, setTaskDueTime] = useState('14:00');
  const [taskType, setTaskType] = useState<NoticeTask['type']>('call');
  const [taskPriority, setTaskPriority] = useState<NoticeTask['priority']>('medium');
  const [taskNotes, setTaskNotes] = useState('');

  // Calendar math
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const prevDate = new Date(currentYear, currentMonth - 1, daysInPrevMonth - i);
      days.push({
        dateStr: prevDate.toISOString().split('T')[0],
        dayNum: daysInPrevMonth - i,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const d = new Date(currentYear, currentMonth, i);
      days.push({
        dateStr: d.toISOString().split('T')[0],
        dayNum: i,
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill 35 or 42 grid slots
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextDate = new Date(currentYear, currentMonth + 1, i);
      days.push({
        dateStr: nextDate.toISOString().split('T')[0],
        dayNum: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => {
        if (filterType === 'today') return t.dueDate === todayStr;
        if (filterType === 'upcoming') return t.dueDate > todayStr && !t.completed;
        if (filterType === 'overdue') return t.dueDate < todayStr && !t.completed;
        if (filterType === 'completed') return t.completed;
        return true;
      })
      .sort((a, b) => (a.dueDate + (a.dueTime || '')).localeCompare(b.dueDate + (b.dueTime || '')));
  }, [tasks, filterType, todayStr]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, NoticeTask[]> = {};
    tasks.forEach(t => {
      if (!map[t.dueDate]) map[t.dueDate] = [];
      map[t.dueDate].push(t);
    });
    return map;
  }, [tasks]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleToggleComplete = (id: string) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const handleDeleteTask = (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    actionToast(
      'Reminder removed',
      {
        label: 'Undo',
        onClick: () => {
          setTasks(prev => [taskToDelete, ...prev]);
        },
      },
      taskToDelete.title,
      6000,
    );
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const newTask: NoticeTask = {
      id: `task_${Date.now()}`,
      title: taskTitle.trim(),
      contactName: taskContactName.trim() || undefined,
      contactPhone: taskContactPhone.trim() || undefined,
      dueDate: taskDueDate,
      dueTime: taskDueTime || undefined,
      type: taskType,
      priority: taskPriority,
      notes: taskNotes.trim() || undefined,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setTasks(prev => [newTask, ...prev]);
    setIsModalOpen(false);
    success('Reminder added to Notice Board');

    // Reset Form
    setTaskTitle('');
    setTaskContactName('');
    setTaskContactPhone('');
    setTaskNotes('');
  };

  const openNewTaskModal = (dateStr?: string) => {
    if (dateStr) setTaskDueDate(dateStr);
    setIsModalOpen(true);
  };

  return (
    <div className="noticeboard-container">
      {/* Header */}
      <div className="noticeboard-header-row">
        <div className="noticeboard-title-group">
          <h1>
            <CalendarClock size={28} style={{ color: 'var(--primary, #25d366)' }} />
            <span>Notice Board & Reminders</span>
          </h1>
          <p>
            Track scheduled customer callbacks, follow-ups, and sales agenda items with integrated WhatsApp outreach.
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={() => openNewTaskModal(selectedDate)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Plus size={18} />
          <span>New Reminder</span>
        </button>
      </div>

      {/* Main Grid: Calendar & Agenda List */}
      <div className="noticeboard-grid">
        {/* Calendar Card */}
        <div className="nb-card calendar-card-flat">
          <div className="nb-card-header">
            <h2 className="nb-card-title">
              <CalendarIcon size={18} style={{ color: 'var(--primary, #25d366)' }} />
              <span>
                {monthNames[currentMonth]} {currentYear}
              </span>
            </h2>

            <div className="calendar-controls-bar">
              <button
                className="cal-control-btn cal-nav-btn"
                onClick={handlePrevMonth}
                title="Previous Month"
                aria-label="Previous Month"
              >
                <ChevronLeft size={16} strokeWidth={2.2} />
              </button>
              <button
                className="cal-control-btn cal-nav-btn"
                onClick={handleNextMonth}
                title="Next Month"
                aria-label="Next Month"
              >
                <ChevronRight size={16} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div className="calendar-month-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="calendar-day-header">
                {d}
              </div>
            ))}

            {calendarDays.map((day, idx) => {
              const dayTasks = tasksByDate[day.dateStr] || [];
              const isToday = day.dateStr === todayStr;
              const isSelected = day.dateStr === selectedDate;

              return (
                <div
                  key={idx}
                  className={`calendar-day-cell ${!day.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    setSelectedDate(day.dateStr);
                  }}
                  onDoubleClick={() => openNewTaskModal(day.dateStr)}
                  title="Double click to add reminder"
                >
                  <div className="day-number-row">
                    <span className="day-number">{day.dayNum}</span>
                    {dayTasks.length > 0 && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary, #25d366)' }}>
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  <div className="cell-tasks-indicators">
                    {dayTasks.slice(0, 2).map(t => (
                      <div key={t.id} className={`cell-task-chip ${t.type}`} title={t.title}>
                        {t.dueTime ? `${t.dueTime} ` : ''}
                        {t.contactName || t.title}
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center' }}>
                        +{dayTasks.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actionable Agenda / Task List */}
        <div className="nb-card">
          <div className="nb-card-header">
            <h2 className="nb-card-title">
              <Clock size={18} style={{ color: 'var(--primary, #25d366)' }} />
              <span>Agenda & Follow-ups</span>
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
              {filteredTasks.length} Task{filteredTasks.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Filter Pills */}
          <div className="task-filter-pills">
            <button
              className={`task-filter-pill ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              All
            </button>
            <button
              className={`task-filter-pill ${filterType === 'today' ? 'active' : ''}`}
              onClick={() => setFilterType('today')}
            >
              Today ({tasks.filter(t => t.dueDate === todayStr).length})
            </button>
            <button
              className={`task-filter-pill ${filterType === 'upcoming' ? 'active' : ''}`}
              onClick={() => setFilterType('upcoming')}
            >
              Upcoming
            </button>
            <button
              className={`task-filter-pill ${filterType === 'overdue' ? 'active' : ''}`}
              onClick={() => setFilterType('overdue')}
            >
              Overdue
            </button>
            <button
              className={`task-filter-pill ${filterType === 'completed' ? 'active' : ''}`}
              onClick={() => setFilterType('completed')}
            >
              Completed
            </button>
          </div>

          {/* Tasks List */}
          <div className="task-items-list">
            {filteredTasks.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
                <CheckCircle2 size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '0.875rem' }}>No reminders in this view</p>
                <button
                  className="cal-today-btn"
                  style={{ marginTop: '0.75rem' }}
                  onClick={() => openNewTaskModal(selectedDate)}
                >
                  + Add Reminder
                </button>
              </div>
            ) : (
              filteredTasks.map(task => {
                const isOverdue = task.dueDate < todayStr && !task.completed;
                const isToday = task.dueDate === todayStr;

                return (
                  <div
                    key={task.id}
                    className={`task-card is-${task.priority} ${task.completed ? 'is-completed' : ''}`}
                  >
                    <div className="task-card-header">
                      <div className="task-card-title-box">
                        <input
                          type="checkbox"
                          className="task-checkbox"
                          aria-label={`Mark task ${task.title} as completed`}
                          checked={task.completed}
                          onChange={() => handleToggleComplete(task.id)}
                        />
                        <h4 className="task-title">{task.title}</h4>
                      </div>

                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          textTransform: 'uppercase',
                          background: isOverdue
                            ? 'rgba(239, 68, 68, 0.2)'
                            : isToday
                              ? 'rgba(37, 211, 102, 0.2)'
                              : 'rgba(255, 255, 255, 0.08)',
                          color: isOverdue ? '#ef4444' : isToday ? 'var(--primary, #25d366)' : '#94a3b8',
                        }}
                      >
                        {isOverdue ? 'Overdue' : isToday ? 'Today' : task.dueDate}
                      </span>
                    </div>

                    <div className="task-meta-row">
                      {task.contactName && (
                        <div className="task-meta-item">
                          <User size={13} />
                          <span>{task.contactName}</span>
                        </div>
                      )}
                      {task.contactPhone && (
                        <div className="task-meta-item">
                          <Phone size={13} />
                          <span>{task.contactPhone}</span>
                        </div>
                      )}
                      {task.dueTime && (
                        <div className="task-meta-item">
                          <Clock size={13} />
                          <span>{task.dueTime}</span>
                        </div>
                      )}
                    </div>

                    {task.notes && <div className="task-notes">{task.notes}</div>}

                    <div className="task-actions-row">
                      <div className="task-action-btn-group">
                        {task.contactPhone && (
                          <>
                            <a
                              href={`https://wa.me/${task.contactPhone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="task-btn whatsapp"
                            >
                              <MessageSquare size={13} />
                              <span>WhatsApp</span>
                            </a>
                            <a href={`tel:${task.contactPhone}`} className="task-btn call">
                              <Phone size={13} />
                              <span>Call</span>
                            </a>
                          </>
                        )}
                      </div>

                      <button
                        className="task-btn delete"
                        onClick={() => handleDeleteTask(task.id)}
                        title="Delete reminder"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* New Task / Reminder Modal */}
      {isModalOpen && (
        <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Schedule Callback & Task Reminder">
          <form
            onSubmit={handleCreateTask}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#f8fafc',
                  marginBottom: '0.35rem',
                }}
              >
                Task / Reminder Title *
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Call customer to close enterprise deal"
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                required
                autoFocus
                style={{ width: '100%', background: '#0f172a' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#f8fafc',
                    marginBottom: '0.35rem',
                  }}
                >
                  Contact Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Sarah Jenkins"
                  value={taskContactName}
                  onChange={e => setTaskContactName(e.target.value)}
                  style={{ width: '100%', background: '#0f172a' }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#f8fafc',
                    marginBottom: '0.35rem',
                  }}
                >
                  Phone / WhatsApp Number
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. +1 (555) 234-5678"
                  value={taskContactPhone}
                  onChange={e => setTaskContactPhone(e.target.value)}
                  style={{ width: '100%', background: '#0f172a' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#f8fafc',
                    marginBottom: '0.35rem',
                  }}
                >
                  Due Date *
                </label>
                <input
                  type="date"
                  className="form-control"
                  aria-label="Due Date"
                  value={taskDueDate}
                  onChange={e => setTaskDueDate(e.target.value)}
                  required
                  style={{ width: '100%', background: '#0f172a' }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#f8fafc',
                    marginBottom: '0.35rem',
                  }}
                >
                  Time
                </label>
                <input
                  type="time"
                  className="form-control"
                  aria-label="Due Time"
                  value={taskDueTime}
                  onChange={e => setTaskDueTime(e.target.value)}
                  style={{ width: '100%', background: '#0f172a' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#f8fafc',
                    marginBottom: '0.35rem',
                  }}
                >
                  Type
                </label>
                <select
                  className="form-control"
                  aria-label="Task Type"
                  value={taskType}
                  onChange={e => setTaskType(e.target.value as 'call' | 'whatsapp' | 'quote' | 'general')}
                  style={{ width: '100%', background: '#0f172a' }}
                >
                  <option value="call">📞 Callback Request</option>
                  <option value="whatsapp">💬 WhatsApp Message</option>
                  <option value="quote">📄 Send Quotation</option>
                  <option value="general">📌 General Task</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#f8fafc',
                    marginBottom: '0.35rem',
                  }}
                >
                  Priority
                </label>
                <select
                  className="form-control"
                  aria-label="Task Priority"
                  value={taskPriority}
                  onChange={e => setTaskPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')}
                  style={{ width: '100%', background: '#0f172a' }}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">🔥 Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#f8fafc',
                  marginBottom: '0.35rem',
                }}
              >
                Notes / Conversation Context
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Details of the customer request or callback instructions..."
                value={taskNotes}
                onChange={e => setTaskNotes(e.target.value)}
                style={{ width: '100%', background: '#0f172a' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn-tool" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '0.55rem 1.25rem', borderRadius: '6px', fontWeight: 700 }}
              >
                Save Reminder
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
