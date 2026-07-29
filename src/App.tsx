import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  CircleCheck,
  Clock3,
  ExternalLink,
  Eye,
  EyeOff,
  GitPullRequest,
  Github,
  GripVertical,
  KeyRound,
  Laptop,
  Link as LinkIcon,
  Lock,
  MessageSquare,
  Pause,
  Plus,
  Ticket,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";

type TaskStatus = Doc<"tasks">["status"];
type DevboxWithTasks = Doc<"devboxes"> & { tasks: Doc<"tasks">[] };
type Workboard = {
  devboxes: DevboxWithTasks[];
  unassignedTasks: Doc<"tasks">[];
};

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

const palette = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899"];
const taskDragType = "application/x-workboard-task";
const fallbackTaskDragType = "text/plain";

function App() {
  const [accessKey, setAccessKey] = useStoredAccessKey();
  const [pendingKey, setPendingKey] = useState("");
  const [hideCompleted, setHideCompleted] = useState(true);
  const hasKey = accessKey.length > 0;
  const board = useQuery(
    api.workboard.list,
    hasKey ? { accessKey } : "skip",
  ) as Workboard | undefined;
  const seedDefaults = useMutation(api.workboard.seedDefaults);

  useEffect(() => {
    if (!hasKey || board === undefined || board.devboxes.length > 0) {
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
            <h1>Enter access key</h1>
            <p>
              The key is verified by Convex and never stored in the deployed
              source.
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
          <h1>Devbox Workboard</h1>
        </div>
        <div className="topbar-actions">
          <button
            aria-pressed={hideCompleted}
            className="ghost-button"
            onClick={() => setHideCompleted((value) => !value)}
            type="button"
          >
            {hideCompleted ? <EyeOff size={17} /> : <Eye size={17} />}
            {hideCompleted ? "Showing open tasks" : "Showing all tasks"}
          </button>
          <button className="ghost-button" onClick={() => setAccessKey("")}>
            <Lock size={17} />
            Lock
          </button>
        </div>
      </header>

      {board === undefined ? (
        <div className="loading-state">Loading current work...</div>
      ) : (
        <>
          <UnassignedTasks
            accessKey={accessKey}
            hideCompleted={hideCompleted}
            tasks={board.unassignedTasks}
          />
          <section className="board-grid">
            {board.devboxes.map((devbox, index) => (
              <DevboxCard
                accessKey={accessKey}
                devbox={devbox}
                hideCompleted={hideCompleted}
                index={index}
                key={devbox._id}
              />
            ))}
          </section>
        </>
      )}
    </main>
  );
}

function UnassignedTasks({
  accessKey,
  hideCompleted,
  tasks,
}: {
  accessKey: string;
  hideCompleted: boolean;
  tasks: Doc<"tasks">[];
}) {
  const addTask = useMutation(api.workboard.addTask);
  const moveTask = useMutation(api.workboard.moveTask);
  const visibleTasks = hideCompleted
    ? tasks.filter((task) => task.status !== "done")
    : tasks;

  return (
    <section
      className="unassigned-card"
      onDragOver={allowTaskDrop}
      onDrop={(event) => {
        const taskId = getDraggedTaskId(event);
        if (!taskId) {
          return;
        }

        void moveTask({ accessKey, taskId });
      }}
    >
      <div>
        <p className="eyebrow">No devbox</p>
        <h2>Unassigned tasks</h2>
      </div>
      <div className="task-stack">
        {visibleTasks.map((task) => (
          <TaskSlot accessKey={accessKey} key={task._id} task={task} />
        ))}
        <button
          className="add-task-button"
          onClick={() => void addTask({ accessKey })}
          type="button"
        >
          <Plus size={16} />
          Add task
        </button>
      </div>
    </section>
  );
}

function DevboxCard({
  accessKey,
  devbox,
  hideCompleted,
  index,
}: {
  accessKey: string;
  devbox: DevboxWithTasks;
  hideCompleted: boolean;
  index: number;
}) {
  const updateDevbox = useMutation(api.workboard.updateDevbox);
  const addTask = useMutation(api.workboard.addTask);
  const moveTask = useMutation(api.workboard.moveTask);
  const [name, setName] = useState(devbox.name);
  const [connectionUrl, setConnectionUrl] = useState(devbox.connectionUrl ?? "");
  const [dirty, setDirty] = useState(false);
  const latestDevbox = useRef({ name, connectionUrl });
  const accent = palette[index % palette.length];
  const visibleTasks = hideCompleted
    ? devbox.tasks.filter((task) => task.status !== "done")
    : devbox.tasks;

  useEffect(() => {
    latestDevbox.current = { name, connectionUrl };
  }, [connectionUrl, name]);

  const saveDevbox = useCallback(async () => {
    if (!dirty) {
      return;
    }
    const snapshot = latestDevbox.current;
    await updateDevbox({
      accessKey,
      devboxId: devbox._id,
      name: snapshot.name,
      connectionUrl: snapshot.connectionUrl,
    });
    setDirty(latestDevbox.current !== snapshot);
  }, [accessKey, devbox._id, dirty, updateDevbox]);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const timer = window.setTimeout(() => void saveDevbox(), 1000);
    return () => window.clearTimeout(timer);
  }, [dirty, saveDevbox]);

  function openConnectionUrl() {
    const trimmedUrl = connectionUrl.trim();
    if (!trimmedUrl) {
      return;
    }

    window.open(trimmedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <article
      className="devbox-card"
      onDragOver={allowTaskDrop}
      onDrop={(event) => {
        const taskId = getDraggedTaskId(event);
        if (!taskId) {
          return;
        }

        void moveTask({ accessKey, taskId, devboxId: devbox._id });
      }}
      style={{ "--accent": accent } as CSSProperties}
    >
      <div className="devbox-header">
        <Laptop size={22} />
        <div className="devbox-fields">
          <input
            aria-label="Devbox name"
            className="devbox-name"
            value={name}
            onBlur={() => void saveDevbox()}
            onChange={(event) => {
              setName(event.target.value);
              setDirty(true);
            }}
          />
          <input
            aria-label="Devbox connection URL"
            className="devbox-url"
            value={connectionUrl}
            onBlur={() => void saveDevbox()}
            onChange={(event) => {
              setConnectionUrl(event.target.value);
              setDirty(true);
            }}
            placeholder="Connection URL"
          />
        </div>
        <button
          aria-label={`Connect to ${name || "devbox"}`}
          className="icon-button connect-button"
          disabled={!connectionUrl.trim()}
          onClick={openConnectionUrl}
          title="Connect"
          type="button"
        >
          <ExternalLink size={16} />
        </button>
      </div>

      <div className="task-stack">
        {visibleTasks.map((task) => (
          <TaskSlot
            accessKey={accessKey}
            key={task._id}
            task={task}
          />
        ))}
        <button
          className="add-task-button"
          onClick={() => void addTask({ accessKey, devboxId: devbox._id })}
          type="button"
        >
          <Plus size={16} />
          Add task
        </button>
      </div>
    </article>
  );
}

function TaskSlot({
  accessKey,
  task,
}: {
  accessKey: string;
  task: Doc<"tasks">;
}) {
  const updateTask = useMutation(api.workboard.updateTask);
  const clearTask = useMutation(api.workboard.clearTask);
  const [title, setTitle] = useState(task.title);
  const [branch, setBranch] = useState(task.branch ?? "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const [links, setLinks] = useState(task.links ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [dirty, setDirty] = useState(false);
  const lastSaved = useRef(
    serializeTask(task.title, task.branch, task.notes, task.links, task.status),
  );
  const latestTask = useRef({ title, branch, notes, links, status });

  useEffect(() => {
    latestTask.current = { title, branch, notes, links, status };
  }, [branch, links, notes, status, title]);

  const saveTask = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const snapshot = serializeTask(
      latestTask.current.title,
      latestTask.current.branch,
      latestTask.current.notes,
      latestTask.current.links,
      latestTask.current.status,
    );
    if (snapshot === lastSaved.current) {
      setDirty(false);
      return;
    }

    await updateTask({
      accessKey,
      taskId: task._id,
      title: latestTask.current.title,
      status: latestTask.current.status,
      notes: latestTask.current.notes,
      links: latestTask.current.links,
      branch: latestTask.current.branch,
    });
    lastSaved.current = snapshot;
    setDirty(
      snapshot !==
        serializeTask(
          latestTask.current.title,
          latestTask.current.branch,
          latestTask.current.notes,
          latestTask.current.links,
          latestTask.current.status,
        ),
    );
  }, [accessKey, task._id, updateTask]);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const timer = window.setTimeout(() => void saveTask(), 1000);
    return () => window.clearTimeout(timer);
  }, [dirty, saveTask]);

  function markDirty() {
    setDirty(true);
  }

  const [dragArmed, setDragArmed] = useState(false);

  return (
    <form
      className="task-card"
      draggable={dragArmed}
      onBlur={() => void saveTask()}
      onDragStart={(event) => startTaskDrag(event, task._id)}
      onDragEnd={() => setDragArmed(false)}
      onSubmit={saveTask}
    >
      <div className="task-topline">
        <div className="task-meta">
          <span
            aria-label="Drag task"
            className="drag-handle"
            onMouseDown={() => setDragArmed(true)}
            onMouseUp={() => setDragArmed(false)}
            onMouseLeave={() => setDragArmed(false)}
            role="button"
            title="Drag task"
          >
            <GripVertical size={15} />
          </span>
          <span className={`status-pill ${status}`}>{status}</span>
        </div>
        <button
          aria-label="Clear task"
          className="icon-button"
          onClick={() => void clearTask({ accessKey, taskId: task._id })}
          type="button"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <input
        className="task-title"
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          markDirty();
        }}
        placeholder={`Task ${task.slot + 1}`}
      />

      <input
        value={branch}
        onChange={(event) => {
          setBranch(event.target.value);
          markDirty();
        }}
        placeholder="Branch, PR, ticket"
      />

      <textarea
        value={notes}
        onChange={(event) => {
          setNotes(event.target.value);
          markDirty();
        }}
        placeholder="Context, written progress…"
        rows={3}
      />

      <textarea
        className="task-links-input"
        value={links}
        onChange={(event) => {
          setLinks(event.target.value);
          markDirty();
        }}
        placeholder="Paste links here — one per line. Use [label](url) to rename a chip."
        rows={2}
      />

      <TaskLinks branch={branch} links={links} />

      <div className="task-actions">
        <div className="segmented-control">
          {statusOptions.map(({ value, label, icon: Icon }) => (
            <button
              aria-label={label}
              className={status === value ? "selected" : ""}
              key={value}
              onClick={() => {
                setStatus(value);
                markDirty();
              }}
              title={label}
              type="button"
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}

type ParsedLink = {
  url: string;
  label: string;
  kind: "teams" | "ado" | "github-pr" | "github" | "jira" | "generic";
  icon: typeof LinkIcon;
};

const urlPattern = /\bhttps?:\/\/[^\s<>()"']+/gi;
const labeledLinkPattern = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/gi;

function parseLink(rawUrl: string, customLabel?: string): ParsedLink | null {
  const cleaned = rawUrl.replace(/[.,;:!?)\]]+$/, "");
  let url: URL;
  try {
    url = new URL(cleaned);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  const auto = describeLink(cleaned, host, segments, url);
  const label = customLabel?.trim();
  return label ? { ...auto, label } : auto;
}

function describeLink(
  cleaned: string,
  host: string,
  segments: string[],
  url: URL,
): ParsedLink {
  if (host.includes("teams.microsoft.com") || host.includes("teams.live.com")) {
    return { url: cleaned, label: "Teams thread", kind: "teams", icon: MessageSquare };
  }

  if (host.endsWith("dev.azure.com") || host.endsWith("visualstudio.com")) {
    const prIdx = segments.indexOf("pullrequest");
    if (prIdx !== -1 && segments[prIdx + 1]) {
      return {
        url: cleaned,
        label: `ADO PR !${segments[prIdx + 1]}`,
        kind: "ado",
        icon: GitPullRequest,
      };
    }
    const workItemIdx = segments.indexOf("edit");
    if (workItemIdx !== -1 && segments[workItemIdx + 1]) {
      return {
        url: cleaned,
        label: `ADO #${segments[workItemIdx + 1]}`,
        kind: "ado",
        icon: Ticket,
      };
    }
    const idParam = url.searchParams.get("workitem") ?? url.searchParams.get("id");
    if (idParam) {
      return { url: cleaned, label: `ADO #${idParam}`, kind: "ado", icon: Ticket };
    }
    return { url: cleaned, label: "Azure DevOps", kind: "ado", icon: ExternalLink };
  }

  if (host === "github.com" || host.endsWith(".github.com")) {
    const pullIdx = segments.indexOf("pull");
    if (pullIdx !== -1 && segments[pullIdx + 1]) {
      const repo = segments[1] ? `${segments[0]}/${segments[1]}` : "";
      return {
        url: cleaned,
        label: repo ? `${repo} #${segments[pullIdx + 1]}` : `PR #${segments[pullIdx + 1]}`,
        kind: "github-pr",
        icon: GitPullRequest,
      };
    }
    const issueIdx = segments.indexOf("issues");
    if (issueIdx !== -1 && segments[issueIdx + 1]) {
      return {
        url: cleaned,
        label: `Issue #${segments[issueIdx + 1]}`,
        kind: "github",
        icon: Ticket,
      };
    }
    if (segments.length >= 2) {
      return {
        url: cleaned,
        label: `${segments[0]}/${segments[1]}`,
        kind: "github",
        icon: Github,
      };
    }
    return { url: cleaned, label: "GitHub", kind: "github", icon: Github };
  }

  if (host.includes("atlassian.net") || host.includes("jira")) {
    const browseIdx = segments.indexOf("browse");
    if (browseIdx !== -1 && segments[browseIdx + 1]) {
      return { url: cleaned, label: segments[browseIdx + 1], kind: "jira", icon: Ticket };
    }
    return { url: cleaned, label: "Jira", kind: "jira", icon: Ticket };
  }

  const shortHost = host.replace(/^www\./, "");
  return { url: cleaned, label: shortHost, kind: "generic", icon: LinkIcon };
}

function extractLinks(...sources: Array<string | undefined>): ParsedLink[] {
  const seen = new Set<string>();
  const links: ParsedLink[] = [];
  for (const source of sources) {
    if (!source) continue;

    const skipRanges: Array<[number, number]> = [];
    for (const match of source.matchAll(labeledLinkPattern)) {
      const [, label, rawUrl] = match;
      const parsed = parseLink(rawUrl, label);
      if (match.index !== undefined) {
        skipRanges.push([match.index, match.index + match[0].length]);
      }
      if (!parsed || seen.has(parsed.url)) continue;
      seen.add(parsed.url);
      links.push(parsed);
    }

    for (const match of source.matchAll(urlPattern)) {
      if (match.index === undefined) continue;
      const inLabeled = skipRanges.some(
        ([start, end]) => match.index! >= start && match.index! < end,
      );
      if (inLabeled) continue;
      const parsed = parseLink(match[0]);
      if (!parsed || seen.has(parsed.url)) continue;
      seen.add(parsed.url);
      links.push(parsed);
    }
  }
  return links;
}

function TaskLinks({ branch, links }: { branch: string; links: string }) {
  const parsed = extractLinks(branch, links);
  if (parsed.length === 0) {
    return null;
  }

  return (
    <div className="task-links">
      {parsed.map((link) => {
        const Icon = link.icon;
        return (
          <a
            className={`task-link-chip kind-${link.kind}`}
            href={link.url}
            key={link.url}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            rel="noopener noreferrer"
            target="_blank"
            title={link.url}
          >
            <Icon size={13} />
            <span>{link.label}</span>
          </a>
        );
      })}
    </div>
  );
}

function startTaskDrag(event: DragEvent<HTMLFormElement>, taskId: Id<"tasks">) {
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    target.closest("input, textarea, button")
  ) {
    event.preventDefault();
    return;
  }

  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(taskDragType, taskId);
  event.dataTransfer.setData(fallbackTaskDragType, taskId);
}

function allowTaskDrop(event: DragEvent<HTMLElement>) {
  const draggedTypes = Array.from(event.dataTransfer.types);
  if (
    !draggedTypes.includes(taskDragType) &&
    !draggedTypes.includes(fallbackTaskDragType)
  ) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function getDraggedTaskId(event: DragEvent<HTMLElement>) {
  const taskId =
    event.dataTransfer.getData(taskDragType) ||
    event.dataTransfer.getData(fallbackTaskDragType);
  if (!taskId) {
    return undefined;
  }

  event.preventDefault();
  return taskId as Id<"tasks">;
}

function serializeTask(
  title: string,
  branch: string | undefined,
  notes: string | undefined,
  links: string | undefined,
  status: TaskStatus,
) {
  return JSON.stringify({
    title: title.trim(),
    branch: branch?.trim() ?? "",
    notes: notes?.trim() ?? "",
    links: links?.trim() ?? "",
    status,
  });
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
