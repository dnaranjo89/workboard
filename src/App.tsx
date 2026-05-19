import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  CircleCheck,
  Clock3,
  KeyRound,
  Laptop,
  Lock,
  Pause,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";

type TaskStatus = Doc<"tasks">["status"];
type DevboxWithTasks = Doc<"devboxes"> & { tasks: Doc<"tasks">[] };

const statusOptions: Array<{
  value: TaskStatus;
  label: string;
  icon: typeof Clock3;
}> = [
  { value: "active", label: "Active", icon: Clock3 },
  { value: "blocked", label: "Blocked", icon: TriangleAlert },
  { value: "paused", label: "Paused", icon: Pause },
  { value: "done", label: "Done", icon: CircleCheck },
];

const colorOptions = ["#2563eb", "#16a34a", "#d97706", "#db2777", "#475569"];

function App() {
  const [accessKey, setAccessKey] = useStoredAccessKey();
  const [pendingKey, setPendingKey] = useState("");
  const hasKey = accessKey.length > 0;
  const board = useQuery(
    api.workboard.list,
    hasKey ? { accessKey } : "skip",
  ) as DevboxWithTasks[] | undefined;
  const seedDefaults = useMutation(api.workboard.seedDefaults);

  useEffect(() => {
    if (!hasKey || board === undefined || board.length > 0) {
      return;
    }
    void seedDefaults({ accessKey });
  }, [accessKey, board, hasKey, seedDefaults]);

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccessKey(pendingKey.trim());
  }

  if (!hasKey) {
    return (
      <main className="login-shell">
        <form className="login-panel" onSubmit={unlock}>
          <Lock size={26} />
          <div>
            <p className="eyebrow">Private workboard</p>
            <h1>Enter your access key</h1>
            <p>
              The key is checked by Convex and stays out of the deployed source.
            </p>
          </div>
          <label>
            Access key
            <input
              autoFocus
              type="password"
              value={pendingKey}
              onChange={(event) => setPendingKey(event.target.value)}
              placeholder="Stored in this browser only"
            />
          </label>
          <button className="primary-button" type="submit">
            <KeyRound size={18} />
            Unlock
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Realtime overview</p>
          <h1>Devbox Workboard</h1>
        </div>
        <button className="ghost-button" onClick={() => setAccessKey("")}>
          <Lock size={17} />
          Lock
        </button>
      </header>

      {board === undefined ? (
        <div className="loading-state">Loading current work...</div>
      ) : (
        <section className="board-grid">
          {board.map((devbox) => (
            <DevboxCard
              accessKey={accessKey}
              devbox={devbox}
              key={devbox._id}
            />
          ))}
        </section>
      )}
    </main>
  );
}

function DevboxCard({
  accessKey,
  devbox,
}: {
  accessKey: string;
  devbox: DevboxWithTasks;
}) {
  const updateDevbox = useMutation(api.workboard.updateDevbox);
  const [name, setName] = useState(devbox.name);
  const [location, setLocation] = useState(devbox.location ?? "");
  const [color, setColor] = useState(devbox.color);

  const taskBySlot = useMemo(() => {
    return new Map(devbox.tasks.map((task) => [task.slot, task]));
  }, [devbox.tasks]);

  async function saveDevbox() {
    await updateDevbox({
      accessKey,
      devboxId: devbox._id,
      name,
      location,
      color,
    });
  }

  return (
    <article
      className="devbox-card"
      style={{ "--accent": color } as CSSProperties}
    >
      <div className="devbox-header">
        <Laptop size={22} />
        <div className="devbox-fields">
          <input
            aria-label="Devbox name"
            className="devbox-name"
            value={name}
            onBlur={saveDevbox}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            aria-label="Devbox location"
            className="devbox-location"
            value={location}
            onBlur={saveDevbox}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Where this box runs"
          />
        </div>
      </div>

      <div className="swatches" aria-label="Devbox color">
        {colorOptions.map((option) => (
          <button
            aria-label={`Use color ${option}`}
            className={option === color ? "swatch selected" : "swatch"}
            key={option}
            onClick={() => {
              setColor(option);
              void updateDevbox({
                accessKey,
                devboxId: devbox._id,
                name,
                location,
                color: option,
              });
            }}
            style={{ backgroundColor: option }}
            type="button"
          />
        ))}
      </div>

      <div className="task-stack">
        {[0, 1].map((slot) => (
          <TaskSlot
            accessKey={accessKey}
            devboxId={devbox._id}
            key={`${slot}-${taskBySlot.get(slot)?._id ?? "empty"}-${taskBySlot.get(slot)?.updatedAt ?? 0}`}
            slot={slot}
            task={taskBySlot.get(slot)}
          />
        ))}
      </div>
    </article>
  );
}

function TaskSlot({
  accessKey,
  devboxId,
  slot,
  task,
}: {
  accessKey: string;
  devboxId: Id<"devboxes">;
  slot: number;
  task?: Doc<"tasks">;
}) {
  const upsertTask = useMutation(api.workboard.upsertTask);
  const clearTask = useMutation(api.workboard.clearTask);
  const [title, setTitle] = useState(task?.title ?? "");
  const [branch, setBranch] = useState(task?.branch ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "active");

  async function saveTask(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!title.trim()) {
      return;
    }

    await upsertTask({
      accessKey,
      devboxId,
      slot,
      title,
      status,
      notes,
      branch,
    });
  }

  return (
    <form className="task-card" onSubmit={saveTask}>
      <div className="task-topline">
        <span className={`status-pill ${status}`}>{status}</span>
        {task ? (
          <button
            aria-label="Clear task"
            className="icon-button"
            onClick={() => void clearTask({ accessKey, taskId: task._id })}
            type="button"
          >
            <Trash2 size={16} />
          </button>
        ) : null}
      </div>

      <input
        className="task-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={`Task ${slot + 1}`}
      />

      <input
        value={branch}
        onChange={(event) => setBranch(event.target.value)}
        placeholder="Branch, PR, ticket"
      />

      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Current context"
        rows={3}
      />

      <div className="task-actions">
        <div className="segmented-control">
          {statusOptions.map(({ value, label, icon: Icon }) => (
            <button
              aria-label={label}
              className={status === value ? "selected" : ""}
              key={value}
              onClick={() => setStatus(value)}
              title={label}
              type="button"
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
        <button className="save-button" type="submit">
          <Save size={16} />
          Save
        </button>
      </div>
    </form>
  );
}

function useStoredAccessKey() {
  const [accessKey, setAccessKeyState] = useState(() => {
    return window.localStorage.getItem("workboard.accessKey") ?? "";
  });

  function setAccessKey(value: string) {
    setAccessKeyState(value);
    if (value) {
      window.localStorage.setItem("workboard.accessKey", value);
    } else {
      window.localStorage.removeItem("workboard.accessKey");
    }
  }

  return [accessKey, setAccessKey] as const;
}

export default App;
