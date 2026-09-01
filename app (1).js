// ==========================================================
// แก้ค่านี้เป็น Database URL ของคุณ (ไม่ต้องมี https:// และไม่ต้องมี / ท้ายสุด)
// ค่านี้ใช้แค่ "อ่าน" ข้อมูล (rules ตั้งเป็น .read: true) เปิดเผยในเว็บได้ปลอดภัย
// ==========================================================
const FIREBASE_HOST = "motion-monitor-69532-default-rtdb.asia-southeast1.firebasedatabase.app";

const DAYS_TO_SHOW = 7;
const REFRESH_INTERVAL_MS = 30000; // รีเฟรชข้อมูลอัตโนมัติทุก 30 วิ

const el = {
  clock: document.getElementById("clock"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  totalCount: document.getElementById("totalCount"),
  todayCount: document.getElementById("todayCount"),
  lastSeen: document.getElementById("lastSeen"),
  chart: document.getElementById("chart"),
  logList: document.getElementById("logList"),
};

function updateClock() {
  const now = new Date();
  el.clock.textContent = now.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "medium",
  });
}
setInterval(updateClock, 1000);
updateClock();

function setStatus(online) {
  el.statusDot.className = "dot " + (online ? "online" : "offline");
  el.statusText.textContent = online ? "เชื่อมต่อฐานข้อมูลสำเร็จ" : "เชื่อมต่อฐานข้อมูลไม่สำเร็จ";
}

async function fetchEvents() {
  const cutoffEpoch = Math.floor(Date.now() / 1000) - DAYS_TO_SHOW * 24 * 60 * 60;
  const url =
    `https://${FIREBASE_HOST}/motion_events.json` +
    `?orderBy="timestamp"&startAt=${cutoffEpoch}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);

  const data = await res.json();
  if (!data) return [];

  return Object.values(data)
    .filter((e) => e && typeof e.timestamp === "number")
    .sort((a, b) => b.timestamp - a.timestamp);
}

function dayKey(epochSeconds) {
  const d = new Date(epochSeconds * 1000);
  return d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });
}

function dayShortLabel(date) {
  return date.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
  });
}

function renderStats(events) {
  const todayKey = dayKey(Math.floor(Date.now() / 1000));
  const todayCount = events.filter((e) => dayKey(e.timestamp) === todayKey).length;

  el.totalCount.textContent = events.length;
  el.todayCount.textContent = todayCount;

  if (events.length > 0) {
    const latest = events[0];
    el.lastSeen.textContent = latest.time_str || dayKey(latest.timestamp);
  } else {
    el.lastSeen.textContent = "-";
  }
}

function renderChart(events) {
  const counts = new Map(); // key: "YYYY-MM-DD" (local) -> count
  const days = [];

  for (let i = DAYS_TO_SHOW - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });
    counts.set(key, 0);
    days.push({ key, date: d });
  }

  events.forEach((e) => {
    const key = dayKey(e.timestamp);
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  });

  const maxCount = Math.max(1, ...Array.from(counts.values()));

  el.chart.innerHTML = "";
  days.forEach(({ key, date }) => {
    const count = counts.get(key) || 0;
    const heightPct = Math.max(4, (count / maxCount) * 100);

    const col = document.createElement("div");
    col.className = "chart-col";
    col.innerHTML = `
      <div class="chart-count">${count}</div>
      <div class="chart-bar" style="height:${heightPct}%"></div>
      <div class="chart-label">${dayShortLabel(date)}</div>
    `;
    el.chart.appendChild(col);
  });
}

function renderLog(events) {
  el.logList.innerHTML = "";

  if (events.length === 0) {
    el.logList.innerHTML = `<div class="empty-state">ไม่มีเหตุการณ์ในช่วง ${DAYS_TO_SHOW} วันที่ผ่านมา</div>`;
    return;
  }

  let currentDay = null;
  events.forEach((e) => {
    const key = dayKey(e.timestamp);
    if (key !== currentDay) {
      currentDay = key;
      const header = document.createElement("div");
      header.className = "log-day";
      header.textContent = key;
      el.logList.appendChild(header);
    }

    const row = document.createElement("div");
    row.className = "log-row";
    row.innerHTML = `
      <span class="icon"></span>
      <span class="time">${e.time_str || "-"}</span>
      <span class="label">ตรวจพบการเคลื่อนไหว</span>
    `;
    el.logList.appendChild(row);
  });
}

async function refresh() {
  try {
    const events = await fetchEvents();
    setStatus(true);
    renderStats(events);
    renderChart(events);
    renderLog(events);
  } catch (err) {
    setStatus(false);
    el.logList.innerHTML = `<div class="error-state">โหลดข้อมูลไม่สำเร็จ — ตรวจสอบ FIREBASE_HOST ใน app.js และ security rules<br>(${err.message})</div>`;
  }
}

refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);
