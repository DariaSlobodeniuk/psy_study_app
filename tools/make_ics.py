"""Створює calendar.ics з data/data.json: заняття й дедлайни з нагадуваннями.
Запуск: python3 tools/make_ics.py"""
import json, pathlib, datetime as dt

root = pathlib.Path(__file__).resolve().parent.parent
data = json.loads((root / "data" / "data.json").read_text(encoding="utf-8"))
subj = {s["id"]: s for s in data["subjects"]}
stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")

def esc(s):
    return s.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")

def fold(line):
    out, b = [], line.encode("utf-8")
    while len(b) > 73:
        cut = 73
        while (b[cut] & 0xC0) == 0x80:
            cut -= 1
        out.append(b[:cut].decode()); b = b[cut:]
    out.append(b.decode())
    return "\r\n ".join(out)

L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//psy_study_app//UK", "CALSCALE:GREGORIAN",
     "X-WR-CALNAME:Навчання", "X-WR-TIMEZONE:Europe/Kyiv"]
for e in data["events"]:
    s = subj[e["subject"]]
    d = e["date"].replace("-", "")
    title = f'{s["short"]}: {e["title"]}' if e["subject"] == "mil" else f'{s["short"]} ({e["type"]})'
    L += ["BEGIN:VEVENT", f'UID:ev-{d}-{e["start"].replace(":", "")}-{e["subject"]}@psy_study_app', f"DTSTAMP:{stamp}",
          f'DTSTART;TZID=Europe/Kyiv:{d}T{e["start"].replace(":", "")}00',
          f'DTEND;TZID=Europe/Kyiv:{d}T{e["end"].replace(":", "")}00',
          f"SUMMARY:{esc(title)}", f'DESCRIPTION:{esc(s["name"] + ". " + e["format"])}',
          "BEGIN:VALARM", "ACTION:DISPLAY", f"DESCRIPTION:{esc(title)}", "TRIGGER:-PT15M", "END:VALARM", "END:VEVENT"]
for t in data["tasks"]:
    if not t.get("deadline"):
        continue
    d = dt.date.fromisoformat(t["deadline"])
    title = f'Дедлайн: {subj[t["subject"]]["short"]}, {t["title"]}'
    L += ["BEGIN:VEVENT", f'UID:task-{t["id"]}@psy_study_app', f"DTSTAMP:{stamp}",
          f"DTSTART;VALUE=DATE:{d:%Y%m%d}", f"DTEND;VALUE=DATE:{d + dt.timedelta(days=1):%Y%m%d}",
          f"SUMMARY:{esc(title)}", f'DESCRIPTION:{esc(t.get("notes", ""))}',
          "BEGIN:VALARM", "ACTION:DISPLAY", f"DESCRIPTION:{esc(title)}", "TRIGGER:-P2DT15H", "END:VALARM",
          "BEGIN:VALARM", "ACTION:DISPLAY", f"DESCRIPTION:{esc(title)}", "TRIGGER:-PT15H", "END:VALARM", "END:VEVENT"]
for m in data.get("milestones", []):
    d = dt.date.fromisoformat(m["date"])
    L += ["BEGIN:VEVENT", f'UID:ms-{m["date"]}-{m["subject"]}@psy_study_app', f"DTSTAMP:{stamp}",
          f"DTSTART;VALUE=DATE:{d:%Y%m%d}", f"DTEND;VALUE=DATE:{d + dt.timedelta(days=1):%Y%m%d}",
          f'SUMMARY:{esc(m["title"])}', "END:VEVENT"]
L.append("END:VCALENDAR")
(root / "calendar.ics").write_text("\r\n".join(fold(l) for l in L) + "\r\n", encoding="utf-8")
print("calendar.ics:", sum(1 for l in L if l == "BEGIN:VEVENT"), "подій")
