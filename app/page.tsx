"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const CATEGORIES = ["식비", "카페", "교통", "쇼핑", "구독", "기타"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_EMOJI: Record<Category, string> = {
  식비: "🍚",
  카페: "☕",
  교통: "🚇",
  쇼핑: "🛍️",
  구독: "📺",
  기타: "🧾",
};

type Expense = {
  id: number;
  amount: number;
  place: string;
  category: Category;
  date: string; // YYYY-MM-DD
  memo: string;
};

const won = (n: number) => n.toLocaleString("ko-KR") + "원";

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function dateLabel(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  const week = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 ${week}요일`;
}

export default function Home() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("expenses")
      .select("id, amount, place, category, spent_on, memo")
      .order("spent_on", { ascending: false })
      .order("id", { ascending: false })
      .then(({ data, error }) => {
        if (error) return setError(error.message);
        setExpenses(
          (data ?? []).map((r) => ({
            id: r.id,
            amount: r.amount,
            place: r.place,
            category: r.category as Category,
            date: r.spent_on,
            memo: r.memo,
          }))
        );
      });
  }, []);

  const [amount, setAmount] = useState("");
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState<Category>("식비");
  const [date, setDate] = useState("");
  const [memo, setMemo] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");

  const monthPrefix = todayStr().slice(0, 7);
  const monthTotal = expenses
    .filter((e) => e.date.startsWith(monthPrefix))
    .reduce((sum, e) => sum + e.amount, 0);

  const groups = Object.entries(
    expenses.reduce<Record<string, Expense[]>>((acc, e) => {
      (acc[e.date] ??= []).push(e);
      return acc;
    }, {})
  ).sort(([a], [b]) => (a < b ? 1 : -1));

  const amountNum = Number(amount.replace(/,/g, ""));
  const canSubmit = amountNum > 0 && place.trim() !== "" && date !== "";

  function openSheet() {
    setAmount("");
    setPlace("");
    setCategory("식비");
    setDate(todayStr());
    setMemo("");
    setScanMsg("");
    setOpen(true);
  }

  async function scanReceipt(file: File) {
    setScanning(true);
    setScanMsg("");
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];

      const res = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mimeType: "image/jpeg" }),
      });
      const r = await res.json();
      if (!res.ok) return setScanMsg(r.error);

      if (r.amount) setAmount(r.amount.toLocaleString("ko-KR"));
      if (r.place) setPlace(r.place);
      if (r.date) setDate(r.date);
      const missing = [!r.amount && "금액", !r.place && "사용처", !r.date && "날짜"].filter(Boolean);
      setScanMsg(
        missing.length
          ? `${missing.join(", ")}은(는) 읽지 못했어요. 직접 입력해주세요.`
          : "영수증에서 읽었어요. 내용을 확인하고 저장해주세요."
      );
    } catch {
      setScanMsg("이미지를 읽지 못했어요. 다른 사진으로 다시 시도해주세요.");
    } finally {
      setScanning(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const { data, error } = await supabase
      .from("expenses")
      .insert({ amount: amountNum, place: place.trim(), category, spent_on: date, memo: memo.trim() })
      .select("id")
      .single();
    if (error) return setError(error.message);
    setError("");
    setExpenses((prev) => [
      { id: data.id, amount: amountNum, place: place.trim(), category, date, memo: memo.trim() },
      ...prev,
    ]);
    setOpen(false);
  }

  return (
    <main className="app">
      <header className="header">
        <p className="brand">clair 가계부</p>
        <p className="label">이번 달에 쓴 돈</p>
        <p className="total">{won(monthTotal)}</p>
      </header>
      {error && <p className="msg err">{error}</p>}

      <section className="list">
        {groups.length === 0 ? (
          <div className="empty">
            <p>아직 입력한 지출이 없어요</p>
            <p className="sub">아래 버튼으로 첫 지출을 추가해보세요</p>
          </div>
        ) : (
          groups.map(([d, items]) => (
            <div className="card" key={d}>
              <div className="card-head">
                <span>{dateLabel(d)}</span>
                <span>{won(items.reduce((s, i) => s + i.amount, 0))}</span>
              </div>
              {items.map((i) => (
                <div className="row" key={i.id}>
                  <div className="icon">{CATEGORY_EMOJI[i.category]}</div>
                  <div className="info">
                    <p className="place">{i.place}</p>
                    <p className="meta">
                      {i.category}
                      {i.memo && ` · ${i.memo}`}
                    </p>
                  </div>
                  <p className="amt">-{won(i.amount)}</p>
                </div>
              ))}
            </div>
          ))
        )}
      </section>

      <div className="fab-wrap">
        <button className="primary" onClick={openSheet}>
          지출 추가하기
        </button>
      </div>

      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h2>지출 입력</h2>

            <label className="scan">
              {scanning ? "영수증 읽는 중…" : "📷 영수증으로 채우기"}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={scanning}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) scanReceipt(f);
                }}
              />
            </label>
            {scanMsg && <p className="msg">{scanMsg}</p>}

            <label>
              금액
              <input
                inputMode="numeric"
                placeholder="0"
                value={amount}
                autoFocus
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  setAmount(digits ? Number(digits).toLocaleString("ko-KR") : "");
                }}
              />
            </label>

            <label>
              사용처
              <input placeholder="어디에서 썼나요?" value={place} onChange={(e) => setPlace(e.target.value)} />
            </label>

            <div className="field">
              <span>카테고리</span>
              <div className="chips">
                {CATEGORIES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={c === category ? "chip on" : "chip"}
                    onClick={() => setCategory(c)}
                  >
                    {CATEGORY_EMOJI[c]} {c}
                  </button>
                ))}
              </div>
            </div>

            <label>
              날짜
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <label>
              메모
              <input placeholder="선택사항" value={memo} onChange={(e) => setMemo(e.target.value)} />
            </label>

            <button className="primary" type="submit" disabled={!canSubmit}>
              추가하기
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
