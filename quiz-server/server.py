"""Quiz Factory 数据版：零依赖后端（Python 标准库）+ SQLite + 静态前端。

不依赖任何第三方包——任何装了 Python 的电脑双击就能跑。
v1 的单文件测试不能采集数据（这是它的隐私卖点）；数据版是"愿意用数据换改进"的
托管形态：匿名记录开始/完成/选项，换来看板上的完成率、题目区分度、结果分布。

运行：  python server.py            → http://127.0.0.1:8800
种子数据：先跑一次 python prepare.py（从 v1 的 quiz_factory 加工）

接口一览（返回均为 JSON）：
  GET  /api/quizzes                      测试列表（含开始/完成人数）
  GET  /api/quizzes/{slug}               单个测试完整数据
  POST /api/quizzes/{slug}/start         建匿名会话 → {"session_id": n}
  POST /api/quizzes/{slug}/finish        提交 {session_id, answers, result_key, duration_s}
  GET  /api/quizzes/{slug}/stats         看板聚合（漏斗/结果分布/逐题分布）
"""
from __future__ import annotations

import datetime
import json
import re
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
DB = HERE / "db.sqlite3"
STATIC = (HERE / "static").resolve()

ROUTES_QUIZ_ACTION = re.compile(r"^/api/quizzes/([^/]+)/(start|finish)$")
ROUTES_QUIZ = re.compile(r"^/api/quizzes/([^/]+)$")
ROUTES_QUIZ_STATS = re.compile(r"^/api/quizzes/([^/]+)/stats$")

PAGES = {"/": "index.html", "/play": "play.html", "/stats": "stats.html"}
CTYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
          ".svg": "image/svg+xml"}


# ---------------- 数据层 ----------------

def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS sessions(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            duration_s REAL,
            result_key TEXT,
            answers TEXT)"""
    )
    return conn


def load_quiz(slug: str) -> dict | None:
    path = DATA / f"{slug}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def compute_stats(slug: str) -> dict | None:
    q = load_quiz(slug)
    if q is None:
        return None
    conn = db()
    try:
        starts, finishes = conn.execute(
            "SELECT COUNT(*), SUM(finished_at IS NOT NULL) FROM sessions WHERE slug=?",
            (slug,),
        ).fetchone()
        rows = conn.execute(
            "SELECT result_key, answers, duration_s FROM sessions "
            "WHERE slug=? AND finished_at IS NOT NULL",
            (slug,),
        ).fetchall()
    finally:
        conn.close()

    starts = starts or 0
    finishes = finishes or 0
    result_counts: dict[str, int] = {}
    option_counts = [[0] * len(qq["options"]) for qq in q["questions"]]
    durations = []
    for result_key, answers_json, duration in rows:
        result_counts[result_key] = result_counts.get(result_key, 0) + 1
        durations.append(duration or 0)
        for qi, oi in enumerate(json.loads(answers_json) if answers_json else []):
            if 0 <= qi < len(option_counts) and isinstance(oi, int) and 0 <= oi < len(option_counts[qi]):
                option_counts[qi][oi] += 1

    questions = []
    for qi, qq in enumerate(q["questions"]):
        total = sum(option_counts[qi]) or 1
        questions.append({
            "q": qq["q"],
            "answers": sum(option_counts[qi]),
            "options": [
                {"text": opt["text"], "pct": round(c / total * 100, 1)}
                for opt, c in zip(qq["options"], option_counts[qi])
            ],
        })
    return {
        "slug": slug, "title": q["title"],
        "starts": starts, "finishes": finishes,
        "completion_rate": round(finishes / starts * 100, 1) if starts else None,
        "avg_duration_s": round(sum(durations) / len(durations), 1) if durations else None,
        "results": ({k: round(result_counts.get(k, 0) / finishes * 100, 1) for k in q["results"]}
                    if finishes else {}),
        "questions": questions,
    }


# ---------------- HTTP 服务 ----------------

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # 安静一点：只留错误
        if args and ("404" in str(args[1]) or "500" in str(args[1])):
            super().log_message(fmt, *args)

    def _json(self, code: int, payload) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _file(self, path: Path, code: int = 200) -> None:
        try:
            body = path.read_bytes()
        except OSError:
            self._json(404, {"error": "not found"})
            return
        self.send_response(code)
        self.send_header("Content-Type", CTYPES.get(path.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _static(self, name: str) -> None:
        target = (STATIC / name).resolve()
        if STATIC not in target.parents or not target.exists():
            self._json(404, {"error": "not found"})
            return
        self._file(target)

    # ---- GET ----
    def do_GET(self) -> None:  # noqa: N802
        path = urlsplit(self.path).path
        if path in PAGES:
            self._file(STATIC / PAGES[path])
            return
        if path.startswith("/static/"):
            self._static(path[len("/static/"):])
            return
        m = ROUTES_QUIZ_STATS.match(path)
        if m:
            stats = compute_stats(m.group(1))
            self._json(404, {"error": "测试不存在"}) if stats is None else self._json(200, stats)
            return
        m = ROUTES_QUIZ.match(path)
        if m:
            q = load_quiz(m.group(1))
            self._json(404, {"error": "测试不存在"}) if q is None else self._json(200, q)
            return
        if path == "/api/quizzes":
            out = []
            conn = db()
            try:
                for p in sorted(DATA.glob("*.json")):
                    q = json.loads(p.read_text(encoding="utf-8"))
                    row = conn.execute(
                        "SELECT COUNT(*), SUM(finished_at IS NOT NULL) FROM sessions WHERE slug=?",
                        (q["slug"],),
                    ).fetchone()
                    out.append({
                        "slug": q["slug"], "title": q["title"], "emoji": q["emoji"],
                        "questions": len(q["questions"]), "results": len(q["results"]),
                        "starts": row[0] or 0, "finishes": row[1] or 0,
                    })
            finally:
                conn.close()
            self._json(200, {"quizzes": out})
            return
        self._json(404, {"error": "not found"})

    # ---- POST ----
    def do_POST(self) -> None:  # noqa: N802
        path = urlsplit(self.path).path
        m = ROUTES_QUIZ_ACTION.match(path)
        if not m:
            self._json(404, {"error": "not found"})
            return
        slug, action = m.group(1), m.group(2)
        if load_quiz(slug) is None:
            self._json(404, {"error": "测试不存在"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._json(400, {"error": "请求体不是合法 JSON"})
            return

        if action == "start":
            conn = db()
            try:
                cur = conn.execute(
                    "INSERT INTO sessions(slug, started_at) VALUES(?,?)",
                    (slug, datetime.datetime.now().isoformat(timespec="seconds")),
                )
                conn.commit()
                self._json(200, {"session_id": cur.lastrowid})
            finally:
                conn.close()
            return

        # finish
        answers = body.get("answers")
        q = load_quiz(slug)
        if (not isinstance(answers, list) or len(answers) != len(q["questions"])
                or not all(isinstance(x, int) and 0 <= x < 3 for x in answers)):
            self._json(400, {"error": f"answers 应为 {len(q['questions'])} 个 0-2 的选项下标"})
            return
        result_key = str(body.get("result_key") or "")
        if result_key not in q["results"]:
            self._json(400, {"error": "result_key 不在结果表里"})
            return
        try:
            duration = max(0.0, float(body.get("duration_s") or 0))
        except (TypeError, ValueError):
            duration = 0.0
        conn = db()
        try:
            cur = conn.execute(
                "UPDATE sessions SET finished_at=?, duration_s=?, result_key=?, answers=? "
                "WHERE id=? AND slug=? AND finished_at IS NULL",
                (datetime.datetime.now().isoformat(timespec="seconds"),
                 duration, result_key, json.dumps(answers),
                 int(body.get("session_id") or 0), slug),
            )
            conn.commit()
            if cur.rowcount == 0:
                self._json(404, {"error": "会话不存在或已完成"})
                return
        finally:
            conn.close()
        self._json(200, {"ok": True})


def main() -> None:
    DATA.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 8800), Handler)
    print("Quiz Factory 数据版已启动：http://127.0.0.1:8800/  （Ctrl+C 停止）")
    server.serve_forever()


if __name__ == "__main__":
    main()
