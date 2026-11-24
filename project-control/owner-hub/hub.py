import argparse
import datetime as dt
import json
import os
import re
import sqlite3
import subprocess
import sys
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen, Request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DATA = Path(os.environ["LOCALAPPDATA"]) / "GeroySkazok" / "OwnerHub"
DATA.mkdir(parents=True, exist_ok=True)
PORT = 8765
ADDR = f"127.0.0.1:{PORT}"
DB = DATA / "owner.sqlite"
REPO = "alexmel669-dotcom/geroy-skazki"
github = {}
SAMPLE = "Проверка локальной панели\n"
TASK = "Добавить контрольную строку и сверить Git diff"


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def git(repo, *args):
    return subprocess.check_output(["git", "-c", "core.quotepath=false", "-C", str(repo), *args],
                                   encoding="utf-8", stderr=subprocess.DEVNULL, timeout=10).strip()


def db():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c


with db() as c:
    c.execute("BEGIN IMMEDIATE")
    columns = [r["name"] for r in c.execute("PRAGMA table_info(events)")]
    legacy = columns == ["run", "action", "stamp"]
    if legacy:
        c.execute("ALTER TABLE events RENAME TO old_events")
    c.execute("""CREATE TABLE IF NOT EXISTS events (
        run TEXT NOT NULL, action TEXT NOT NULL CHECK(action IN ('start','progress','finish','error')),
        stamp TEXT NOT NULL, task TEXT NOT NULL, agent TEXT NOT NULL, branch TEXT NOT NULL,
        sha TEXT NOT NULL, description TEXT NOT NULL, source TEXT NOT NULL)""")
    if legacy:
        c.execute("""INSERT INTO events SELECT run,action,stamp,?,'Cycle.cmd','test',
                  'Без коммитов','Описание не записывалось','synthetic'
                  FROM old_events ORDER BY rowid""", (TASK,))
        c.execute("DROP TABLE old_events")
    c.execute("CREATE INDEX IF NOT EXISTS events_run ON events(run)")
    c.execute("CREATE TABLE IF NOT EXISTS notes (sha TEXT, body TEXT, stamp TEXT)")
    c.execute("""CREATE TABLE IF NOT EXISTS approvals (
        sha TEXT PRIMARY KEY, message TEXT NOT NULL, approved_at TEXT NOT NULL)""")
    if "description" not in {r["name"] for r in c.execute("PRAGMA table_info(approvals)")}:
        c.execute("ALTER TABLE approvals ADD COLUMN description TEXT")


def event(run, action, description, *, task=None, agent="Codex", source="cli"):
    if source == "synthetic":
        branch, sha = "test", "Без коммитов"
    else:
        branch = git(ROOT, "branch", "--show-current") or "DETACHED"
        sha = git(ROOT, "rev-parse", "HEAD")
    with db() as c:
        c.execute("BEGIN IMMEDIATE")
        if action == "start":
            if not task or not task.strip():
                raise ValueError("Для начала задачи укажите --task.")
            run = run or str(uuid.uuid4())
            if c.execute("SELECT 1 FROM events WHERE run=?", (run,)).fetchone():
                raise ValueError("Такой запуск уже существует.")
        else:
            if not run:
                active = c.execute("""SELECT s.run FROM events s WHERE action='start'
                    AND agent=? AND source=? AND NOT EXISTS
                    (SELECT 1 FROM events e WHERE e.run=s.run AND e.action IN ('finish','error'))""",
                    (agent, source)).fetchall()
                if len(active) != 1:
                    raise ValueError("Нужен один открытый запуск. Для выбора укажите --run и его ID.")
                run = active[0]["run"]
            last = c.execute("SELECT * FROM events WHERE run=? AND source=? AND agent=? ORDER BY rowid DESC LIMIT 1",
                             (run, source, agent)).fetchone()
            if not last or last["action"] in ("finish","error"):
                raise ValueError("Открытый запуск этого агента не найден.")
            task = last["task"]
        c.execute("""INSERT INTO events(run,action,stamp,task,agent,branch,sha,description,source)
                     VALUES(?,?,?,?,?,?,?,?,?)""", (run, action, now(), task, agent, branch, sha, description, source))
    return run


def log_cli():
    parser = argparse.ArgumentParser(prog="python hub.py log")
    parser.add_argument("action", choices=("start", "progress", "finish", "error"))
    parser.add_argument("--task")
    parser.add_argument("--run")
    parser.add_argument("--agent", default="Codex")
    parser.add_argument("--desc")
    args = parser.parse_args(sys.argv[2:])
    if args.task and args.action != "start":
        parser.error("--task задаётся при старте")
    descriptions = {"start": "Начал задачу", "finish": "Завершил задачу"}
    description = (args.desc or descriptions.get(args.action, "")).strip()
    if not description:
        parser.error("Укажите --desc с описанием действия")
    try:
        print(event(args.run, args.action, description, task=args.task, agent=args.agent))
    except ValueError as exc:
        parser.error(str(exc))


def cycle():
    run = str(uuid.uuid4())
    repo = DATA / "synthetic" / run
    repo.mkdir(parents=True)
    git(repo, "init", "-b", "test")
    def record(action, description):
        event(run, action, description, task=TASK, agent="Cycle.cmd", source="synthetic")
    record("start", "Создан отдельный тестовый репозиторий")
    try:
        (repo / "sample.txt").write_text(SAMPLE, encoding="utf-8")
        git(repo, "add", "--", "sample.txt")
        record("progress", "Добавлен sample.txt")
        assert "+" + SAMPLE.strip() in sample_diff(repo)
        record("finish", "Проверен diff")
    except Exception:
        record("error", "Ошибка тестового цикла")
        raise


def sample_diff(repo):
    # Only expose the known synthetic fixture.
    if git(repo, "show", ":sample.txt") != SAMPLE.strip():
        raise ValueError()
    return git(repo, "diff", "--cached", "--no-ext-diff", "--no-textconv", "--", "sample.txt")


def changes_directory():
    try:
        config = json.loads((HERE / "config.json").read_text(encoding="utf-8-sig"))
        path = Path(config["app_path"])
        if path.is_absolute() and path.is_dir():
            return path.resolve(), "Приложение"
    except (KeyError, ValueError, TypeError, OSError):
        pass
    return ROOT, "Панель · путь приложения не настроен или недоступен"


def working_diff(repo):
    options = ["--no-color", "--no-ext-diff", "--no-textconv"]
    exclusions = [":(exclude,glob,icase)**/" + pattern for pattern in
                  (".env*", "*.pem", "*.key", "*.pfx", "*.bundle", "*.sqlite*", "*credentials*", "*secrets*")]
    patches = [git(repo, "diff", *options, "HEAD", "--", ".", *exclusions)]
    if repo != ROOT:
        return patches[0]
    # These panel sources are still untracked. Never open arbitrary untracked files.
    sources = [str((HERE / name).relative_to(ROOT).as_posix()) for name in
               ("hub.py", "hub.js", "index.html", "Start.cmd", "Cycle.cmd", "Запуск.md")]
    untracked = git(ROOT, "ls-files", "--others", "--exclude-standard", "--", *sources)
    for path in untracked.splitlines():
        if path not in sources or (ROOT / path).is_symlink():
            continue
        result = subprocess.run(["git", "-c", "core.quotepath=false", "diff", "--no-index",
                                 *options, "--", "/dev/null", path], cwd=ROOT,
                                capture_output=True, encoding="utf-8", errors="replace", timeout=10)
        if result.returncode not in (0, 1):
            raise OSError("git diff")
        patches.append(result.stdout.rstrip("\n"))
    return "\n".join(filter(None, patches))


def sync():
    while True:
        for kind, endpoint in [("PR", "pulls?state=all"), ("Issues", "issues?state=all"), ("Actions", "actions/runs")]:
            rows = []
            status = "NOT_CONNECTED"
            try:
                req = Request(f"https://api.github.com/repos/{REPO}/{endpoint}&per_page=10" if "?" in endpoint else
                              f"https://api.github.com/repos/{REPO}/{endpoint}?per_page=10", headers={"User-Agent":"OwnerHub-local"})
                with urlopen(req, timeout=5) as res:
                    data = json.load(res)
                for item in (data["workflow_runs"] if kind == "Actions" else data):
                    if kind == "Issues" and "pull_request" in item:
                        continue
                    rows.append(dict(id=item.get("number", item.get("id")), status=item.get("state") or item.get("conclusion") or item.get("status"),
                                     sha=item.get("head_sha") or item.get("head", {}).get("sha"), url=item["html_url"]))
                status = "CONNECTED"
            except (OSError, ValueError, KeyError):
                pass
            github[kind] = dict(status=status, rows=rows, time=now())
        threading.Event().wait(300)


def read_passport(root):
    for name in ("PROJECT_PASSPORT.md", "AGENTS.md"):
        path = root / name
        try:
            if path.is_symlink() or path.resolve().parent != root:
                raise ValueError()
            return dict(source=name, status="OK", text=path.read_text(encoding="utf-8-sig"))
        except FileNotFoundError:
            continue
        except (ValueError, OSError, RuntimeError):
            return dict(source=name, status="NOT_VERIFIED", text="")
    return dict(source="PROJECT_PASSPORT.md / AGENTS.md", status="NOT_FOUND", text="")


def read_infrastructure(root):
    path = root / "infrastructure.json"
    try:
        if path.is_symlink() or path.resolve().parent != root:
            raise ValueError()
        items = json.loads(path.read_text(encoding="utf-8-sig"))
        if not isinstance(items, dict) or not all(isinstance(v, str) for v in items.values()):
            raise ValueError()
        return dict(status="OK", items=items)
    except FileNotFoundError:
        return dict(status="NOT_CONNECTED")
    except (ValueError, OSError, RuntimeError):
        return dict(status="NOT_VERIFIED")


def release_checks(passport):
    if passport["source"] != "PROJECT_PASSPORT.md" or passport["status"] != "OK":
        return None
    checks = []
    fence = None
    for line in passport["text"].splitlines():
        line = line.strip()
        if line.startswith(("```", "~~~")):
            if fence is None:
                fence = line[:3]
            elif line.startswith(fence):
                fence = None
            continue
        if fence:
            continue
        marker = re.search(r"\[([xX ])\](?!\()", line)
        status = re.search(r"\b(PENDING|BLOCKED)\b", line)
        if not marker and not status:
            continue
        label = line.strip("|").split("|")[0].strip() if line.startswith("|") else line
        label = re.sub(r"^(?:[-*+]\s+)?\[[xX ]\]\s*", "", label)
        checks.append(dict(label=label, done=bool(marker and marker[1].lower() == "x" and not status),
                           blocked=bool(status and status[1] == "BLOCKED")))
    return checks


def snapshot():
    stamp = now()
    branch = sha = "NOT_VERIFIED"
    message = None
    files = []
    try:
        sha = git(ROOT, "rev-parse", "HEAD")
        message = git(ROOT, "log", "-1", "--pretty=%B", sha)
        branch = git(ROOT, "branch", "--show-current")

    except (OSError, subprocess.SubprocessError):
        pass
    with db() as c:
        events = [dict(r) for r in c.execute("SELECT * FROM events ORDER BY rowid DESC LIMIT 150")]
        notes = [dict(r) for r in c.execute("SELECT * FROM notes ORDER BY rowid DESC LIMIT 100")]
        approval = c.execute("SELECT approved_at, description FROM approvals WHERE sha=?", (sha,)).fetchone()
    repo, source = ROOT, "NOT_CONNECTED"
    diff = "NOT_CONNECTED"
    try:
        repo, source = changes_directory()
        files = git(repo, "status", "--short", "--untracked-files=all", "--", ".").splitlines()
        diff = working_diff(repo)
    except (ValueError, OSError, subprocess.SubprocessError):
        pass
    passport = read_passport(ROOT)
    return dict(time=stamp, branch=branch, sha=sha, files=files, events=events, notes=notes, diff=diff,
                changes_source=source, changes_path=str(repo), message=message, approved_at=approval["approved_at"] if approval else None,
                approval_description=approval["description"] if approval else None,
                passport=passport, release_checks=release_checks(passport), infrastructure=read_infrastructure(ROOT), github=github.copy())


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, data, mime):
        self.send_response(status)
        self.send_header("Content-Type", mime + "; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.headers.get("Host") != ADDR:
            return self.send_error(403)
        if self.path == "/state":
            return self.reply(200, json.dumps(snapshot()).encode(), "application/json")
        routes = {"/": ("index.html", "text/html"), "/hub.js": ("hub.js", "text/javascript")}
        if self.path not in routes:
            return self.send_error(404)
        name, mime = routes[self.path]
        self.reply(200, (HERE / name).read_bytes(), mime)

    def do_POST(self):
        if self.path not in ("/notes", "/approvals") or self.headers.get("Host") != ADDR or self.headers.get("Origin") != "http://" + ADDR:
            return self.send_error(403)
        try:
            size = int(self.headers["Content-Length"])
            if not 0 < size <= 16000:
                raise ValueError()
            data = json.loads(self.rfile.read(size))
            if self.path == "/approvals":
                sha = data["sha"]
                description = data["description"].strip()
                if not 0 < len(description) <= 2000:
                    raise ValueError()
                if sha != git(ROOT, "rev-parse", "HEAD"):
                    return self.send_error(409)
                message = git(ROOT, "log", "-1", "--pretty=%B", sha)
                stamp = dt.datetime.now().astimezone().isoformat(timespec="seconds")
                with db() as c:
                    c.execute("""INSERT INTO approvals(sha,message,approved_at,description) VALUES(?,?,?,?)
                                 ON CONFLICT(sha) DO UPDATE SET description=excluded.description
                                 WHERE approvals.description IS NULL""", (sha, message, stamp, description))
                return self.reply(200, b"{}", "application/json")
            sha, body = data["sha"], data["body"].strip()
            if not re.fullmatch("[0-9a-f]{40}", sha) or not 0 < len(body) <= 2000 or git(ROOT, "cat-file", "-t", sha) != "commit":
                raise ValueError()
            with db() as c:
                c.execute("INSERT INTO notes VALUES(?,?,?)", (sha, body, now()))
        except (ValueError, AttributeError, TypeError, KeyError, subprocess.SubprocessError):
            return self.send_error(400)
        self.reply(201, b"{}", "application/json")


if __name__ == "__main__":
    if sys.argv[1:] == ["cycle"]:
        cycle()
    elif sys.argv[1:2] == ["log"]:
        log_cli()
    elif sys.argv[1:]:
        sys.exit("Используйте log, cycle или запуск без аргументов")
    else:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
        threading.Thread(target=sync, daemon=True).start()
        print("http://" + ADDR, flush=True)
        server.serve_forever()

