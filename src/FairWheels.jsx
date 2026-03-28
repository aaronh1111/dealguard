import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hqykeuzclhhsybqwxwkv.supabase.co";
const SUPABASE_KEY = "sb_publishable_b6_KoZK9ljnzm-e_klD5Xw_pHzSRZbV";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FONT = "'DM Sans', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'DM Mono', 'Courier New', monospace";
const NAVY = "#0A2540";
const BLUE = "#1E6FD9";
const FREE_LIMIT = 2;
const STRIPE_LINK = "https://buy.stripe.com/28EbJ13Pfh1u5IW99Casg01";

const parse = (v) => parseFloat(v) || 0;
const fmt = (n) => "$" + Math.round(n).toLocaleString("en-US");
const fmtDec = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (a, b) => Math.round((a / b) * 100);

function calcDeal(price, fees, apr, term) {
  const loan = price + fees;
  const rate = apr / 100 / 12;
  const monthly = rate === 0 ? loan / term : loan * rate / (1 - Math.pow(1 + rate, -term));
  const total = monthly * term;
  const interest = total - loan;
  const iR = interest / price, fR = fees / price;
  const iS = iR <= 0.12 ? 100 : iR <= 0.25 ? 72 : iR <= 0.4 ? 45 : 20;
  const aS = apr <= 4 ? 100 : apr <= 6 ? 80 : apr <= 9 ? 55 : apr <= 14 ? 35 : 15;
  const fS = fR <= 0.01 ? 100 : fR <= 0.04 ? 75 : fR <= 0.08 ? 50 : 25;
  const tS = total / price <= 1.1 ? 100 : total / price <= 1.25 ? 72 : total / price <= 1.5 ? 45 : 20;
  const score = Math.round(0.30 * iS + 0.30 * aS + 0.20 * fS + 0.20 * tS);
  return {
    price, fees, apr, term, monthly, total, interest, score,
    breakdown: [
      { label: "Interest burden", value: iS, weight: "30%" },
      { label: "APR rate", value: aS, weight: "30%" },
      { label: "Fee ratio", value: fS, weight: "20%" },
      { label: "Total cost", value: tS, weight: "20%" },
    ],
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    id: Date.now(),
  };
}

function getVerdict(score) {
  if (score >= 80) return { label: "Strong deal", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", dark: "#166534" };
  if (score >= 60) return { label: "Fair deal", color: "#b45309", bg: "#fffbeb", border: "#fde68a", dark: "#92400e" };
  if (score >= 40) return { label: "Weak deal", color: "#c2410c", bg: "#fff7ed", border: "#fed7aa", dark: "#9a3412" };
  return { label: "Poor deal", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dark: "#991b1b" };
}

function buildScript(deal) {
  const targetApr = Math.max(deal.apr - 1.5, 2.5).toFixed(1);
  const savings = fmt(deal.interest * 0.15);
  const highFees = deal.fees > deal.price * 0.04;
  return [
    { step: "1. Get pre-approved first", content: `Before walking in, get pre-approved at your bank or credit union. It gives you a competing rate to use as leverage. Dealers will often match or beat it to keep your financing.` },
    { step: "2. Open with the rate", content: `"I've been pre-approved at ${targetApr}% elsewhere. Can you match that?" Don't mention your monthly payment target — focus only on the APR.` },
    ...(highFees ? [{ step: "3. Push back on fees", content: `Your fees are ${fmt(deal.fees)} (${pct(deal.fees, deal.price)}% of the price) — above the 2–3% benchmark. Say: "I'd like the doc fee and add-ons reduced. Other dealers don't charge this."` }] : []),
    { step: highFees ? "4. Anchor on total cost" : "3. Anchor on total cost", content: `"At your rate I'd pay ${fmt(deal.interest)} in interest. At ${targetApr}% that drops ~${savings}. That's what I need before I sign today."` },
    { step: highFees ? "5. Walk-away line" : "4. Walk-away line", content: `"If we can't reach ${targetApr}% I'll go with my outside financing. I'd rather keep it here — but that's your call."` },
  ];
}

function buildAmortization(price, fees, apr, term) {
  const loan = price + fees;
  const rate = apr / 100 / 12;
  const monthly = rate === 0 ? loan / term : loan * rate / (1 - Math.pow(1 + rate, -term));
  let balance = loan;
  return Array.from({ length: term }, (_, i) => {
    const intPmt = balance * rate;
    const prinPmt = monthly - intPmt;
    balance = Math.max(balance - prinPmt, 0);
    return { month: i + 1, principal: prinPmt, interest: intPmt, balance };
  });
}

// ─── Global portal-safe modal wrapper ────────────────────────────────────────
// Uses a full-viewport fixed overlay so it's never clipped by parent containers
function Modal({ children, onClose }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(10,37,64,0.75)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        backdropFilter: "blur(3px)",
      }}
    >
      <div style={{
        background: "#fff", borderRadius: "20px 20px 0 0",
        width: "100%", maxWidth: 480,
        maxHeight: "90vh", overflowY: "auto",
        padding: "20px 20px 36px", boxSizing: "border-box",
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function NavBar({ title, sub, onBack, backLabel, right, tabs, activeTab, onTab }) {
  return (
    <div style={{ background: NAVY, paddingTop: 16, flexShrink: 0 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px" }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#60a5fa", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: FONT, marginBottom: 10, display: "block" }}>
            ← {backLabel || "Back"}
          </button>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: tabs ? 0 : 18 }}>
          <div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, fontFamily: FONT, letterSpacing: "-0.02em" }}>{title}</div>
            {sub && <div style={{ color: "#93c5fd", fontSize: 11, marginTop: 2, fontFamily: FONT }}>{sub}</div>}
          </div>
          {right}
        </div>
        {tabs && (
          <div style={{ display: "flex", gap: 4, paddingTop: 12 }}>
            {tabs.map(([id, label]) => (
              <button key={id} onClick={() => onTab(id)} style={{
                padding: "8px 14px", background: "none", border: "none",
                borderBottom: `2px solid ${activeTab === id ? "#60a5fa" : "transparent"}`,
                color: activeTab === id ? "#fff" : "#93c5fd",
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
                transition: "all 0.15s",
              }}>{label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BottomNav({ active, onHome, onAbout, onHow }) {
  const NavIcon = ({ id }) => {
    const color = active === id ? BLUE : "#9ca3af";
    if (id === "home") return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    );
    if (id === "how") return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    );
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    );
  };
  const items = [
    { id: "home", label: "Analyze", fn: onHome },
    { id: "how", label: "How it works", fn: onHow },
    { id: "about", label: "About", fn: onAbout },
  ];
  return (
    <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", zIndex: 50 }}>
      {items.map(({ id, label, fn }) => (
        <button key={id} onClick={fn}
          style={{ flex: 1, padding: "10px 4px 12px", background: "none", border: "none", cursor: "pointer", fontFamily: FONT, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <NavIcon id={id} />
          <span style={{ fontSize: 10, fontWeight: 700, color: active === id ? BLUE : "#9ca3af" }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

function ProBadge() {
  return (
    <div style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", borderRadius: 99, padding: "4px 10px", fontSize: 10, fontWeight: 800, color: "#fff", fontFamily: FONT, letterSpacing: "0.05em" }}>★ PRO</div>
  );
}

function Pill({ label, color, bg, border }) {
  return <div style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 99, background: bg, border: `1px solid ${border}`, color, fontSize: 10, fontWeight: 700, fontFamily: FONT, whiteSpace: "nowrap" }}>{label}</div>;
}

function ScoreRing({ score, size = 108 }) {
  const v = getVerdict(score);
  const cx = size / 2, r = cx - 10, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f0f0f0" strokeWidth={10} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={v.color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ / 4} strokeLinecap="round" />
        <text x={cx} y={cx - 5} textAnchor="middle" fontFamily={MONO} fontSize={22} fontWeight="800" fill="#111827">{score}</text>
        <text x={cx} y={cx + 12} textAnchor="middle" fontFamily={FONT} fontSize={10} fill="#9ca3af">/100</text>
      </svg>
      <Pill label={v.label} color={v.color} bg={v.bg} border={v.border} />
    </div>
  );
}

function ScoreBar({ value }) {
  const color = value >= 75 ? "#16a34a" : value >= 50 ? "#d97706" : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
      <div style={{ flex: 1, height: 6, background: "#f0f0f0", borderRadius: 99 }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: "#6b7280", minWidth: 22, textAlign: "right", flexShrink: 0 }}>{value}</span>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", ...style }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, accent, green }) {
  const bg = accent ? NAVY : green ? "#f0fdf4" : "#f8fafc";
  const labelColor = accent ? "#93c5fd" : green ? "#16a34a" : "#6b7280";
  const valueColor = accent ? "#fff" : green ? "#166534" : "#111827";
  return (
    <div style={{ background: bg, borderRadius: 13, padding: "13px 14px", border: `1px solid ${accent ? "transparent" : green ? "#bbf7d0" : "#e5e7eb"}`, minWidth: 0, overflow: "hidden" }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: labelColor, fontFamily: FONT, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: valueColor, fontFamily: MONO, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: labelColor, marginTop: 3, fontFamily: FONT }}>{sub}</div>}
    </div>
  );
}

function Field({ label, prefix, suffix, id, value, onChange, placeholder, error, hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: FONT }}>{label}</label>
        {hint && hint.length > 0 && <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: FONT, whiteSpace: "nowrap" }}>{hint}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", border: `2px solid ${error ? "#fca5a5" : focused ? BLUE : "#e5e7eb"}`, borderRadius: 10, background: error ? "#fef2f2" : focused ? "#f0f7ff" : "#fff", transition: "all 0.15s" }}>
        {prefix && <span style={{ paddingLeft: 12, color: "#9ca3af", fontSize: 14, fontFamily: MONO, flexShrink: 0 }}>{prefix}</span>}
        <input id={id} type="number" value={value} onChange={onChange}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder={placeholder}
          style={{ flex: 1, border: "none", outline: "none", padding: "12px 10px", fontSize: 15, fontFamily: MONO, background: "transparent", color: "#111827", minWidth: 0 }} />
        {suffix && <span style={{ paddingRight: 12, color: "#9ca3af", fontSize: 12, fontFamily: FONT, flexShrink: 0 }}>{suffix}</span>}
      </div>
      {error && <div style={{ color: "#dc2626", fontSize: 11, marginTop: 4, fontFamily: FONT }}>⚠ {error}</div>}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: FONT, marginBottom: 10, marginTop: 18 }}>{children}</div>;
}

// ─── Upgrade Modal ────────────────────────────────────────────────────────────
function UpgradeModal({ onClose, onSuccess }) {
  const [purchased, setPurchased] = useState(false);

  if (purchased) return (
    <Modal onClose={onClose}>
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#f0fdf4", border: "2px solid #86efac", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 16px" }}>✓</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", fontFamily: FONT, marginBottom: 6 }}>You're on Pro</div>
        <div style={{ fontSize: 13, color: "#6b7280", fontFamily: FONT, lineHeight: 1.6, marginBottom: 20 }}>
          Your free trial started today. You won't be charged until <strong>{new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</strong>. Cancel any time — no questions asked.
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 16px", marginBottom: 22, textAlign: "left" }}>
          {["Unlimited deal analyses", "Negotiation scripts tailored to each deal", "Side-by-side deal comparison", "Full amortization table", "Unlimited deal history"].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 13, color: "#374151", fontFamily: FONT }}>
              <span style={{ color: "#16a34a", fontWeight: 700, fontSize: 14 }}>✓</span>{f}
            </div>
          ))}
        </div>
        <button onClick={onSuccess} style={{ width: "100%", padding: 14, background: NAVY, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>
          Start using Pro →
        </button>
      </div>
    </Modal>
  );

  return (
    <Modal onClose={onClose}>
      <div style={{ width: 40, height: 4, background: "#e5e7eb", borderRadius: 99, margin: "0 auto 20px" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", fontFamily: FONT }}>FairWheels Pro</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: NAVY, fontFamily: MONO }}>$5.99</span>
            <span style={{ fontSize: 13, color: "#9ca3af" }}>/ month after trial</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>✕</button>
      </div>

      <div style={{ background: "#f8fafc", borderRadius: 14, padding: "16px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: FONT, marginBottom: 12 }}>Everything in Pro</div>
        {[
          ["Unlimited analyses", "No cap — analyze every deal you see"],
          ["Negotiation scripts", "Word-for-word tactics based on your exact numbers"],
          ["Deal comparison", "Compare up to 5 deals in a side-by-side table"],
          ["Amortization table", "Every month's principal vs interest, clearly laid out"],
          ["Unlimited history", "Never lose a deal — your full record, always saved"],
        ].map(([t, d], i) => (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < 4 ? 12 : 0 }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#16a34a", fontWeight: 800, flexShrink: 0 }}>✓</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", fontFamily: FONT }}>{t}</div>
              <div style={{ fontSize: 11, color: "#6b7280", fontFamily: FONT, marginTop: 1 }}>{d}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", fontFamily: FONT, marginBottom: 14 }}>
        No charge for 7 days · Cancel anytime · Secure payment via Stripe
      </div>
      <button onClick={() => { window.open(STRIPE_LINK, "_blank"); setTimeout(() => setPurchased(true), 800); }}
        style={{ width: "100%", padding: 15, background: NAVY, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FONT, marginBottom: 10 }}>
        Start free 7-day trial →
      </button>
      <button onClick={onClose} style={{ width: "100%", padding: 12, background: "#f3f4f6", color: "#6b7280", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
        Not now
      </button>
    </Modal>
  );
}

// ─── Compare View ─────────────────────────────────────────────────────────────
function CompareView({ history, onBack }) {
  const [sel, setSel] = useState(history.slice(0, Math.min(2, history.length)).map(h => h.id));
  const deals = history.filter(h => sel.includes(h.id));
  const toggle = (id) => sel.includes(id) ? (sel.length > 1 && setSel(sel.filter(x => x !== id))) : (sel.length < 5 && setSel([...sel, id]));
  const metrics = [
    { label: "Price", fn: d => fmt(d.price), low: true },
    { label: "APR", fn: d => `${d.apr}%`, low: true },
    { label: "Term", fn: d => `${d.term}mo`, low: true },
    { label: "Monthly", fn: d => fmt(d.monthly), low: true },
    { label: "Interest", fn: d => fmt(d.interest), low: true },
    { label: "Total paid", fn: d => fmt(d.total), low: true },
    { label: "Score", fn: d => d.score, low: false },
  ];
  return (
    <div style={{ fontFamily: FONT, background: "#f8fafc", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <NavBar title="Compare deals" sub={`${sel.length} selected`} onBack={onBack} backLabel="History" right={<ProBadge />} />
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 14px", width: "100%", boxSizing: "border-box", flex: 1 }}>
        <SectionLabel>Select deals (up to 5)</SectionLabel>
        {history.map(h => {
          const v = getVerdict(h.score);
          const on = sel.includes(h.id);
          return (
            <div key={h.id} onClick={() => toggle(h.id)} style={{ background: on ? "#eff6ff" : "#fff", border: `2px solid ${on ? BLUE : "#e5e7eb"}`, borderRadius: 12, padding: "11px 13px", marginBottom: 7, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.1s" }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827", fontFamily: MONO }}>{fmt(h.price)}</span>
                <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>{h.apr}% · {h.term}mo · {h.date}</span>
              </div>
              <Pill label={`${h.score}`} color={v.color} bg={v.bg} border={v.border} />
            </div>
          );
        })}
        {deals.length >= 2 && (
          <Card style={{ marginTop: 8 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <td style={{ padding: "10px 12px", color: "#9ca3af", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: FONT }}>Metric</td>
                    {deals.map((d, i) => <td key={d.id} style={{ padding: "10px 12px", textAlign: "right", color: NAVY, fontSize: 11, fontWeight: 700, fontFamily: FONT }}>Deal {i + 1}</td>)}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map(({ label, fn, low }, ri) => {
                    const vals = deals.map(fn);
                    const nums = vals.map(v => parseFloat(String(v).replace(/[^0-9.]/g, "")));
                    const best = low ? Math.min(...nums) : Math.max(...nums);
                    return (
                      <tr key={label} style={{ borderTop: "1px solid #f3f4f6", background: ri % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "9px 12px", color: "#6b7280", fontFamily: FONT, fontSize: 12 }}>{label}</td>
                        {deals.map((d, di) => {
                          const val = fn(d);
                          const num = parseFloat(String(val).replace(/[^0-9.]/g, ""));
                          return <td key={d.id} style={{ padding: "9px 12px", textAlign: "right", fontWeight: num === best ? 800 : 500, color: num === best ? "#16a34a" : "#374151", fontFamily: MONO, fontSize: 12 }}>{val}</td>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "9px 12px", background: "#f8fafc", borderTop: "1px solid #f3f4f6" }}>
              <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: FONT }}>Green = best value for that metric</span>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── About View ───────────────────────────────────────────────────────────────
function AboutView({ onBack }) {
  return (
    <div style={{ fontFamily: FONT, background: "#f8fafc", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <NavBar title="About FairWheels" sub="Built for car buyers, not dealerships" />
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 14px", width: "100%", boxSizing: "border-box", flex: 1 }}>

        {/* Mission */}
        <Card style={{ padding: "20px 18px", marginBottom: 14 }}>
          <div style={{ fontSize: 22, marginBottom: 10 }}>🛡️</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Our mission</div>
          <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
            Car dealerships have teams of finance managers trained to maximize profit from every loan. Most buyers walk in alone, with no tools and no data.
          </p>
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
            FairWheels levels the playing field. We analyze your deal using the same financial formulas lenders use, score it against real benchmarks, and give you the exact words to negotiate a better rate.
          </p>
        </Card>

        {/* Who we are */}
        <Card style={{ padding: "20px 18px", marginBottom: 14 }}>
          <div style={{ fontSize: 22, marginBottom: 10 }}>👋</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Who we are</div>
          <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
            FairWheels was built by a small team frustrated by overpaying on car loans. We're not affiliated with any dealership, lender, or auto group. We have no financial incentive to favor any deal — our only job is to give you an honest analysis.
          </p>
        </Card>

        {/* Transparency */}
        <Card style={{ padding: "20px 18px", marginBottom: 14 }}>
          <div style={{ fontSize: 22, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 8 }}>What we don't do</div>
          {["We don't sell your data", "We don't earn referral fees from lenders", "We don't work with dealerships", "We don't recommend specific lenders", "We're not a licensed financial advisor"].map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 13, color: "#374151", borderBottom: i < 4 ? "1px solid #f3f4f6" : "none" }}>
              <span style={{ color: "#16a34a", fontWeight: 700 }}>✓</span>{t}
            </div>
          ))}
        </Card>

        <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", lineHeight: 1.6, padding: "4px 0 20px" }}>
          FairWheels provides educational financial analysis only. It is not a substitute for licensed financial or legal advice. Always verify rates and terms with your lender before signing.
        </div>
      </div>
    </div>
  );
}

// ─── How It Works View ────────────────────────────────────────────────────────
function HowItWorksView({ onBack }) {
  const [open, setOpen] = useState(null);
  const items = [
    {
      q: "How is the monthly payment calculated?",
      a: "We use the standard amortizing loan formula used by every bank and lender:\n\nMonthly Payment = Loan × (r / (1 − (1 + r)^−n))\n\nWhere r = APR ÷ 12 ÷ 100 (monthly interest rate) and n = loan term in months.\n\nExample: $35,000 car + $1,000 fees = $36,000 loan at 7% APR for 60 months → $712.85/month.",
    },
    {
      q: "What is the deal score and how is it calculated?",
      a: "The score (0–100) is a weighted average of four factors:\n\n• Interest burden (30%) — total interest paid ÷ vehicle price. Under 12% = excellent, over 40% = poor.\n\n• APR rate (30%) — compared to market benchmarks. Under 4% = excellent, over 14% = poor.\n\n• Fee ratio (20%) — dealer fees ÷ vehicle price. Under 1% = excellent, over 8% = poor.\n\n• Total cost multiplier (20%) — total paid ÷ vehicle price. Under 1.1× = excellent.\n\nA score of 80+ is a strong deal. 60–79 is fair. 40–59 is weak. Below 40 is poor.",
    },
    {
      q: "What counts as a good APR?",
      a: "APR benchmarks change with the market, but as a general guide:\n\n• Excellent: below 4%\n• Good: 4–6%\n• Fair: 6–9%\n• High: 9–14%\n• Very high: above 14%\n\nNew cars typically get lower rates than used. Credit score is the biggest factor. Always get pre-approved at your bank or credit union before visiting a dealer — you'll often get a lower rate.",
    },
    {
      q: "What are dealer fees and are they negotiable?",
      a: "Dealer fees include doc fees, dealer prep, destination charges, and add-ons like paint protection or gap insurance.\n\nBenchmark: fees should be 1–3% of the vehicle price. Above 4% is high and often negotiable.\n\nDoc fees are sometimes fixed by state law, but add-ons (paint protection, extended warranties purchased at signing) are almost always negotiable or removable.",
    },
    {
      q: "How does loan term affect the total cost?",
      a: "Longer terms mean lower monthly payments but significantly more total interest.\n\nExample on a $35,000 loan at 7% APR:\n• 36 months: $1,081/mo · $3,912 total interest\n• 48 months: $837/mo · $6,188 total interest\n• 60 months: $693/mo · $5,580 total interest (common)\n• 72 months: $594/mo · $7,768 total interest\n• 84 months: $520/mo · $9,680 total interest\n\nWe recommend 60 months or less. 72+ month loans often result in being 'underwater' — owing more than the car is worth.",
    },
    {
      q: "What is the amortization table?",
      a: "The amortization table (Pro feature) shows every single month of your loan, broken down into how much of each payment goes to principal (reducing what you owe) versus interest (money the lender keeps).\n\nIn early months, most of your payment is interest. In later months, more goes to principal. This is called front-loaded amortization and is standard for all auto loans.",
    },
  ];

  return (
    <div style={{ fontFamily: FONT, background: "#f8fafc", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <NavBar title="How it works" sub="The math behind your deal score" />
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 14px", width: "100%", boxSizing: "border-box", flex: 1 }}>

        <Card style={{ padding: "16px 18px", marginBottom: 16, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 6 }}>Transparent by design</div>
          <p style={{ margin: 0, fontSize: 12, color: "#1d4ed8", lineHeight: 1.6 }}>
            Every number FairWheels shows you comes from standard financial formulas — the same math your bank uses. Nothing is proprietary or hidden. Tap any question below to see exactly how we calculate it.
          </p>
        </Card>

        {items.map((item, i) => (
          <Card key={i} style={{ marginBottom: 8, cursor: "pointer" }} >
            <div onClick={() => setOpen(open === i ? null : i)} style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{item.q}</div>
              <div style={{ fontSize: 16, color: "#9ca3af", flexShrink: 0, transition: "transform 0.2s", transform: open === i ? "rotate(180deg)" : "none" }}>⌄</div>
            </div>
            {open === i && (
              <div style={{ padding: "0 16px 16px", borderTop: "1px solid #f3f4f6" }}>
                {item.a.split("\n\n").map((para, pi) => (
                  <p key={pi} style={{ margin: pi === 0 ? "12px 0 8px" : "8px 0", fontSize: 12, color: "#374151", lineHeight: 1.7, fontFamily: para.startsWith("•") || para.includes("=") ? MONO : FONT, whiteSpace: "pre-wrap" }}>
                    {para}
                  </p>
                ))}
              </div>
            )}
          </Card>
        ))}

        <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", lineHeight: 1.6, padding: "12px 0 20px" }}>
          FairWheels provides educational financial analysis only. Not a substitute for licensed financial advice.
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
// ── Email Sign-In Screen ─────────────────────────────────────────────────────
function InputField({ label, type, value, onChange, placeholder, error, showToggle, onToggle, showPw }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6, fontFamily: FONT }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", border: `2px solid ${error ? "#fca5a5" : focused ? BLUE : "#e5e7eb"}`, borderRadius: 10, background: error ? "#fef2f2" : focused ? "#f0f7ff" : "#fff", transition: "all 0.15s" }}>
        <input
          type={showToggle ? (showPw ? "text" : "password") : type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{ flex: 1, border: "none", outline: "none", padding: "13px 14px", fontSize: 15, fontFamily: FONT, background: "transparent", color: "#111827" }}
        />
        {showToggle && (
          <button onClick={onToggle} style={{ background: "none", border: "none", paddingRight: 14, cursor: "pointer", color: "#9ca3af", fontSize: 12, fontFamily: FONT }}>
            {showPw ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {error && <div style={{ color: "#dc2626", fontSize: 11, marginTop: 4, fontFamily: FONT }}>⚠ {error}</div>}
    </div>
  );
}

function SignInScreen({ onSignIn, onBack }) {
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const validate = () => {
    if (!email || !email.includes("@")) { setError("Enter a valid email address"); return false; }
    if (!password || password.length < 6) { setError("Password must be at least 6 characters"); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (tab === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signUpError) { setError(signUpError.message); setLoading(false); return; }
        // Also create user record in our users table
        await supabase.from("users").insert([{ email: email.trim().toLowerCase(), analyze_count: 0, is_pro: false }]);
        setSuccess("Account created! You are now signed in.");
        setTimeout(() => onSignIn({ email: email.trim().toLowerCase(), analyze_count: 0, is_pro: false }), 1000);
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) { setError("Incorrect email or password. Try again."); setLoading(false); return; }
        // Load user data
        const { data: userData } = await supabase.from("users").select("email, analyze_count, is_pro").eq("email", email.trim().toLowerCase()).maybeSingle();
        if (!userData) {
          await supabase.from("users").insert([{ email: email.trim().toLowerCase(), analyze_count: 0, is_pro: false }]);
          onSignIn({ email: email.trim().toLowerCase(), analyze_count: 0, is_pro: false });
        } else {
          onSignIn(userData);
        }
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: FONT, background: "#f8fafc", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ background: NAVY, padding: "16px 20px 28px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#60a5fa", fontSize: 13, cursor: "pointer", padding: 0, fontFamily: FONT, marginBottom: 14, display: "block" }}>← Back</button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "2px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>FairWheels</div>
              <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 2 }}>Your car deal analyzer</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 20px", width: "100%", boxSizing: "border-box", flex: 1 }}>
        {/* Tab switcher */}
        <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 12, padding: 4, marginBottom: 22 }}>
          {[["signin", "Sign in"], ["signup", "Create account"]].map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setError(""); setSuccess(""); }}
              style={{ flex: 1, padding: "10px 8px", background: tab === id ? "#fff" : "none", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, color: tab === id ? NAVY : "#6b7280", cursor: "pointer", fontFamily: FONT, boxShadow: tab === id ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "24px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          {/* Profile icon */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#eff6ff", border: "2px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
          </div>

          <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 4, textAlign: "center" }}>
            {tab === "signin" ? "Welcome back" : "Create your account"}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 22, lineHeight: 1.6, textAlign: "center" }}>
            {tab === "signin" ? "Sign in to access your deals and history." : "Create a free account to save your analyses."}
          </div>

          <InputField label="Email address" type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} placeholder="you@example.com" />
          <InputField label="Password" type="password" value={password} onChange={e => { setPassword(e.target.value); setError(""); }} placeholder={tab === "signup" ? "At least 6 characters" : "Your password"} showToggle onToggle={() => setShowPw(!showPw)} showPw={showPw} error={error} />

          {success && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 9, padding: "10px 12px", marginBottom: 12, fontSize: 13, color: "#16a34a", fontFamily: FONT }}>✓ {success}</div>}

          <button onClick={handleSubmit} disabled={loading}
            style={{ width: "100%", padding: 14, background: loading ? "#94a3b8" : NAVY, color: "#fff", border: "none", borderRadius: 11, fontSize: 15, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", fontFamily: FONT }}>
            {loading ? "Please wait..." : tab === "signin" ? "Sign in →" : "Create account →"}
          </button>
        </div>

        <div style={{ marginTop: 16, background: "#f8fafc", borderRadius: 12, border: "1px solid #e5e7eb", padding: "13px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
            Your password is encrypted and stored securely. We never see it. Your data is never sold or shared.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FairWheels() {
  const [form, setForm] = useState({ price: "", fees: "", apr: "", term: "" });
  const [errors, setErrors] = useState({});
  const [results, setResults] = useState(null);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState("home");
  const [selected, setSelected] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [analyzeCount, setAnalyzeCount] = useState(0);
  const [activeTab, setActiveTab] = useState("script");
  const [user, setUser] = useState(null);
  const [pendingAnalyze, setPendingAnalyze] = useState(false);

  const go = (v) => setView(v);
  const remaining = Math.max(FREE_LIMIT - analyzeCount, 0);

  useEffect(() => {
    if (user) {
      setAnalyzeCount(user.analyze_count || 0);
      setIsPro(user.is_pro || false);
    }
  }, [user]);

  const handleSignIn = (userData) => {
    setUser(userData);
    if (pendingAnalyze) {
      setPendingAnalyze(false);
      doAnalyze(userData);
    }
  };

  const updateCount = async (newCount, email) => {
    await supabase.from("users").update({ analyze_count: newCount }).eq("email", email);
  };

  const validate = () => {
    const e = {};
    if (!form.price || parse(form.price) <= 0) e.price = "Enter vehicle price";
    if (!form.apr || parse(form.apr) <= 0) e.apr = "Enter APR";
    if (!form.term || parse(form.term) <= 0) e.term = "Enter term";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const doAnalyze = (currentUser) => {
    const u = currentUser || user;
    const newCount = (u.analyze_count || 0) + 1;
    const deal = calcDeal(parse(form.price), parse(form.fees), parse(form.apr), parse(form.term));
    setResults(deal);
    setHistory(h => [deal, ...h]);
    setAnalyzeCount(newCount);
    setUser(prev => ({ ...prev, analyze_count: newCount }));
    updateCount(newCount, u.email);
    setActiveTab("script");
    go("result");
  };

  const analyze = () => {
    if (!validate()) return;
    if (!user) { setPendingAnalyze(true); go("signin"); return; }
    if (!isPro && analyzeCount >= FREE_LIMIT) { setShowUpgrade(true); return; }
    doAnalyze();
  };

  const handleUpgradeSuccess = () => { setIsPro(true); setShowUpgrade(false); };

  const base = { fontFamily: FONT, background: "#f8fafc", minHeight: "100%", display: "flex", flexDirection: "column" };
  const body = { maxWidth: 480, margin: "0 auto", padding: "16px 14px", width: "100%", boxSizing: "border-box", flex: 1 };

  if (view === "signin") return <SignInScreen onSignIn={handleSignIn} onBack={() => { setPendingAnalyze(false); go("home"); }} />;

  if (view === "profile") return (
    <div style={{ fontFamily: FONT, background: "#f8fafc", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <NavBar title="My account" sub={user?.email} onBack={() => go("home")} backLabel="Back" right={isPro ? <ProBadge /> : null} />
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px", width: "100%", boxSizing: "border-box", flex: 1 }}>

        {/* Avatar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#eff6ff", border: "3px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{user?.email}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{isPro ? "Pro member" : "Free plan"}</div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div style={{ background: "#fff", borderRadius: 13, border: "1px solid #e5e7eb", padding: "14px", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: NAVY, fontFamily: MONO }}>{analyzeCount}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>Deals analyzed</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 13, border: "1px solid #e5e7eb", padding: "14px", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: isPro ? "#d97706" : "#374151", fontFamily: MONO }}>{isPro ? "Pro" : "Free"}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>Current plan</div>
          </div>
        </div>

        {!isPro && (
          <div style={{ background: NAVY, borderRadius: 14, padding: "18px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 3 }}>Upgrade to Pro</div>
              <div style={{ fontSize: 12, color: "#93c5fd" }}>Unlimited analyses · $5.99/mo</div>
            </div>
            <button onClick={() => setShowUpgrade(true)} style={{ background: "#fff", color: NAVY, border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FONT, flexShrink: 0 }}>
              Upgrade
            </button>
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 16 }}>
          {[
            { label: "View deal history", action: () => go("history"), icon: "📋" },
            { label: "How it works", action: () => go("how"), icon: "❓" },
            { label: "About FairWheels", action: () => go("about"), icon: "ℹ️" },
          ].map(({ label, action, icon }, i, arr) => (
            <div key={label} onClick={action} style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderBottom: i < arr.length - 1 ? "1px solid #f3f4f6" : "none" }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#111827", flex: 1 }}>{label}</span>
              <span style={{ color: "#d1d5db", fontSize: 16 }}>›</span>
            </div>
          ))}
        </div>

        <button onClick={async () => {
          await supabase.auth.signOut();
          setUser(null);
          setIsPro(false);
          setAnalyzeCount(0);
          setHistory([]);
          go("home");
        }} style={{ width: "100%", padding: 13, background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
          Sign out
        </button>
      </div>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} onSuccess={handleUpgradeSuccess} />}
    </div>
  );
  if (view === "compare") return <CompareView history={history} onBack={() => go("history")} />;
  if (view === "about") return (
    <div style={base}>
      <AboutView />
      <BottomNav active="about" onHome={() => go("home")} onAbout={() => go("about")} onHow={() => go("how")} />
    </div>
  );
  if (view === "how") return (
    <div style={base}>
      <HowItWorksView />
      <BottomNav active="how" onHome={() => go("home")} onAbout={() => go("about")} onHow={() => go("how")} />
    </div>
  );

  // ── Home ────────────────────────────────────────────────────────────────────
  if (view === "home") return (
    <div style={base}>
      <NavBar
        title="FairWheels"
        sub="Know if your car deal is fair"
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isPro ? <ProBadge /> : (
              <button onClick={() => setShowUpgrade(true)} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, padding: "6px 12px", cursor: "pointer", fontFamily: FONT }}>
                Try Pro free
              </button>
            )}
            {history.length > 0 && (
              <button onClick={() => go("history")} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#93c5fd", fontSize: 11, padding: "6px 11px", cursor: "pointer", fontFamily: FONT }}>
                {history.length} saved
              </button>
            )}
            {user ? (
              <button onClick={() => go("profile")} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </button>
            ) : (
              <button onClick={() => go("signin")} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, padding: "6px 12px", cursor: "pointer", fontFamily: FONT }}>
                Sign in
              </button>
            )}
          </div>
        }
      />

      <div style={body}>
        {/* Free usage bar */}
        {!isPro && (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>Free analyses</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: remaining === 0 ? "#dc2626" : NAVY, fontFamily: MONO }}>{remaining}/{FREE_LIMIT}</span>
              </div>
              <div style={{ height: 5, background: "#f0f0f0", borderRadius: 99 }}>
                <div style={{ width: `${(remaining / FREE_LIMIT) * 100}%`, height: "100%", background: remaining === 0 ? "#dc2626" : BLUE, borderRadius: 99, transition: "width 0.4s" }} />
              </div>
            </div>
            <button onClick={() => setShowUpgrade(true)} style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT, flexShrink: 0 }}>
              Upgrade
            </button>
          </div>
        )}

        {/* Form */}
        <Card style={{ padding: "16px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 14 }}>Enter deal details</div>
          <Field label="Vehicle price" prefix="$" id="price" value={form.price}
            hint="Full purchase price" placeholder="35,000"
            onChange={e => setForm({ ...form, price: e.target.value })} error={errors.price} />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "0 10px" }}>
            <Field label="Dealer fees" prefix="$" id="fees" value={form.fees}
              hint="" placeholder="1,200"
              onChange={e => setForm({ ...form, fees: e.target.value })} />
            <Field label="APR" suffix="%" id="apr" value={form.apr}
              hint="" placeholder="6.9"
              onChange={e => setForm({ ...form, apr: e.target.value })} error={errors.apr} />
          </div>
          <Field label="Loan term" suffix="months" id="term" value={form.term}
            hint="36–72 months" placeholder="60"
            onChange={e => setForm({ ...form, term: e.target.value })} error={errors.term} />

          <button onClick={analyze} style={{ width: "100%", padding: 14, background: NAVY, color: "#fff", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FONT, marginTop: 4, letterSpacing: "-0.01em" }}>
            Analyze deal →
          </button>
        </Card>

        {/* Benchmarks */}
        <SectionLabel>Quick benchmarks</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 4 }}>
          {[
            { label: "Excellent APR", value: "< 4%", green: true },
            { label: "Good APR", value: "4 – 6%", green: true },
            { label: "High fees", value: "> 4% of price", green: false },
            { label: "Max term", value: "60 months", green: false },
          ].map(({ label, value, green }) => (
            <div key={label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 11, padding: "10px 12px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: green ? "#16a34a" : "#c2410c", fontFamily: MONO }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav active="home" onHome={() => go("home")} onAbout={() => go("about")} onHow={() => go("how")} />
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} onSuccess={handleUpgradeSuccess} />}
    </div>
  );

  // ── Result ──────────────────────────────────────────────────────────────────
  if (view === "result" && results) {
    const v = getVerdict(results.score);
    const script = isPro ? buildScript(results) : null;
    const amortRows = isPro ? buildAmortization(results.price, results.fees, results.apr, results.term) : [];

    return (
      <div style={base}>
        <NavBar
          title="Deal analysis"
          sub={results.date}
          onBack={() => { setForm({ price: "", fees: "", apr: "", term: "" }); go("home"); }}
          backLabel="New deal"
          right={isPro ? <ProBadge /> : <button onClick={() => setShowUpgrade(true)} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, padding: "6px 12px", cursor: "pointer", fontFamily: FONT }}>Try Pro</button>}
          {...(isPro && { tabs: [["script", "Script"], ["amort", "Amortization"]], activeTab, onTab: setActiveTab })}
        />

        <div style={body}>
          {/* Hero */}
          <Card style={{ padding: "18px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 16 }}>
            <ScoreRing score={results.score} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", marginBottom: 4 }}>Monthly payment</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: NAVY, fontFamily: MONO, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1 }}>{fmt(results.monthly)}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>{results.term} months at {results.apr}% APR</div>
            </div>
          </Card>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8, marginBottom: 12 }}>
            <StatCard label="Vehicle price" value={fmt(results.price)} />
            <StatCard label="Total fees" value={fmt(results.fees || 0)} />
            <StatCard label="Total interest" value={fmt(results.interest)} sub={`${pct(results.interest, results.price)}% of price`} />
            <StatCard label="Total cost" value={fmt(results.total)} accent />
          </div>

          {/* Verdict */}
          <div style={{ background: v.bg, borderRadius: 14, border: `1px solid ${v.border}`, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: v.dark, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Verdict</div>
            <p style={{ margin: 0, fontSize: 13, color: v.dark, lineHeight: 1.65 }}>
              {results.score >= 80 && "Strong deal. Your APR and interest are healthy. Proceed with confidence — but always negotiate the vehicle price before discussing financing."}
              {results.score >= 60 && results.score < 80 && `Fair deal. There's room to improve. Dropping APR by 0.5% alone could save you ${fmt(results.interest * 0.08)}+ over the term. Get pre-approved first.`}
              {results.score >= 40 && results.score < 60 && "Weak deal. Your interest costs are elevated. Get pre-approved at a bank or credit union — rates are often 2–3% lower than dealer financing."}
              {results.score < 40 && `Poor deal. At ${fmt(results.interest)} in total interest you're well above market rates. Negotiate hard, or walk away and compare other lenders before committing.`}
            </p>
          </div>

          {/* Score breakdown */}
          <Card style={{ padding: "15px 16px", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#111827", marginBottom: 12 }}>Score breakdown</div>
            {results.breakdown.map(b => (
              <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 112, flexShrink: 0, fontSize: 11, color: "#6b7280" }}>{b.label} <span style={{ color: "#d1d5db" }}>({b.weight})</span></div>
                <ScoreBar value={b.value} />
              </div>
            ))}
            <div style={{ marginTop: 6, padding: "8px 10px", background: "#f8fafc", borderRadius: 8 }}>
              <span style={{ fontSize: 10, color: "#9ca3af" }}>Tap "How it works" below to see exactly how this score is calculated.</span>
            </div>
          </Card>

          {/* Payment summary */}
          <Card style={{ marginBottom: 12 }}>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#111827", marginBottom: 10 }}>Payment summary</div>
              {[["Loan amount", fmt(results.price + (results.fees || 0))], ["Monthly payment", fmtDec(results.monthly)], ["Total interest", fmt(results.interest)], ["Total paid", fmt(results.total)]].map(([l, val], i, arr) => (
                <div key={l}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0" }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{l}</span>
                    <span style={{ fontSize: 12, fontWeight: i === arr.length - 1 ? 800 : 600, color: i === arr.length - 1 ? NAVY : "#111827", fontFamily: MONO }}>{val}</span>
                  </div>
                  {i < arr.length - 1 && <div style={{ height: 1, background: "#f3f4f6" }} />}
                </div>
              ))}
            </div>
          </Card>

          {/* Pro tabs — script + amort */}
          {isPro ? (
            <Card style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", borderBottom: "1px solid #f3f4f6" }}>
                {[["script", "Negotiation script"], ["amort", "Amortization table"]].map(([id, label]) => (
                  <button key={id} onClick={() => setActiveTab(id)} style={{ flex: 1, padding: "12px 8px", background: "none", border: "none", borderBottom: `2px solid ${activeTab === id ? NAVY : "transparent"}`, fontSize: 12, fontWeight: 700, color: activeTab === id ? NAVY : "#9ca3af", cursor: "pointer", fontFamily: FONT }}>
                    {label}
                  </button>
                ))}
              </div>
              {activeTab === "script" && script && (
                <div style={{ padding: "16px" }}>
                  <div style={{ background: "#eff6ff", borderRadius: 9, padding: "9px 12px", marginBottom: 14, fontSize: 11, color: "#1e40af" }}>
                    Tailored to this deal · Target APR: <strong>{Math.max(results.apr - 1.5, 2.5).toFixed(1)}%</strong>
                  </div>
                  {script.map((s, i) => (
                    <div key={i} style={{ marginBottom: i < script.length - 1 ? 14 : 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: NAVY, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{s.step}</div>
                      <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 13px", fontSize: 12, color: "#374151", lineHeight: 1.65 }}>{s.content}</div>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === "amort" && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Mo", "Principal", "Interest", "Balance"].map(h => (
                          <td key={h} style={{ padding: "9px 10px", color: "#9ca3af", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: h === "Mo" ? "left" : "right", fontFamily: FONT }}>{h}</td>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {amortRows.map((r, i) => (
                        <tr key={r.month} style={{ borderTop: "1px solid #f9fafb", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <td style={{ padding: "7px 10px", color: "#9ca3af", fontFamily: MONO, fontSize: 11 }}>{r.month}</td>
                          <td style={{ padding: "7px 10px", textAlign: "right", color: "#16a34a", fontFamily: MONO, fontSize: 11 }}>{fmtDec(r.principal)}</td>
                          <td style={{ padding: "7px 10px", textAlign: "right", color: "#dc2626", fontFamily: MONO, fontSize: 11 }}>{fmtDec(r.interest)}</td>
                          <td style={{ padding: "7px 10px", textAlign: "right", color: "#111827", fontFamily: MONO, fontSize: 11 }}>{fmt(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : (
            <div style={{ background: "#fff", borderRadius: 14, border: "2px dashed #e5e7eb", padding: "20px 18px", marginBottom: 12, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>🔒</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Negotiation script + Amortization table</div>
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, marginBottom: 16 }}>
                Get word-for-word negotiation tactics built from this deal's exact numbers, plus a full month-by-month breakdown of every payment.
              </div>
              <button onClick={() => setShowUpgrade(true)} style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>
                Unlock with Pro — free 7-day trial
              </button>
            </div>
          )}

          <button onClick={() => { setForm({ price: "", fees: "", apr: "", term: "" }); go("home"); }}
            style={{ width: "100%", padding: 13, background: NAVY, color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FONT, marginBottom: 4 }}>
            Analyze another deal
          </button>
        </div>

        <BottomNav active="home" onHome={() => { setForm({ price: "", fees: "", apr: "", term: "" }); go("home"); }} onAbout={() => go("about")} onHow={() => go("how")} />
        {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} onSuccess={handleUpgradeSuccess} />}
      </div>
    );
  }

  // ── History ─────────────────────────────────────────────────────────────────
  if (view === "history") return (
    <div style={base}>
      <NavBar title="Deal history" sub={`${history.length} deal${history.length !== 1 ? "s" : ""} saved`}
        onBack={() => go("home")}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isPro && history.length >= 2 && (
              <button onClick={() => go("compare")} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, padding: "6px 11px", cursor: "pointer", fontFamily: FONT }}>
                Compare
              </button>
            )}
            {isPro && <ProBadge />}
          </div>
        }
      />
      <div style={body}>
        {!isPro && history.length >= FREE_LIMIT && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "13px 15px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e" }}>Compare deals side-by-side</div>
              <div style={{ fontSize: 11, color: "#b45309", marginTop: 2, lineHeight: 1.4 }}>Pro unlocks comparison and unlimited history.</div>
            </div>
            <button onClick={() => setShowUpgrade(true)} style={{ background: "#d97706", border: "none", borderRadius: 9, color: "#fff", fontSize: 12, fontWeight: 800, padding: "8px 13px", cursor: "pointer", fontFamily: FONT, flexShrink: 0 }}>Upgrade</button>
          </div>
        )}
        {history.length === 0 && (
          <div style={{ textAlign: "center", padding: "56px 20px" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6 }}>No deals saved yet</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>Analyze your first deal to see it here.</div>
          </div>
        )}
        {history.map(h => {
          const v = getVerdict(h.score);
          return (
            <div key={h.id} onClick={() => { setSelected(h); go("detail"); }}
              style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 15px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", fontFamily: MONO, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmt(h.price)}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{h.apr}% APR · {h.term}mo · {h.date}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800, color: v.color }}>{h.score}</div>
                <Pill label={v.label} color={v.color} bg={v.bg} border={v.border} />
              </div>
            </div>
          );
        })}
        {history.length > 0 && (
          <button onClick={() => setHistory([])} style={{ width: "100%", marginTop: 6, padding: 11, background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>
            Clear all history
          </button>
        )}
      </div>
      <BottomNav active="home" onHome={() => go("home")} onAbout={() => go("about")} onHow={() => go("how")} />
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} onSuccess={handleUpgradeSuccess} />}
    </div>
  );

  // ── Detail ──────────────────────────────────────────────────────────────────
  if (view === "detail" && selected) {
    const v = getVerdict(selected.score);
    return (
      <div style={base}>
        <NavBar title="Deal details" sub={selected.date} onBack={() => go("history")} backLabel="History" right={isPro ? <ProBadge /> : null} />
        <div style={body}>
          <Card style={{ padding: "18px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 16 }}>
            <ScoreRing score={selected.score} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", marginBottom: 4 }}>Monthly payment</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: NAVY, fontFamily: MONO, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmt(selected.monthly)}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 5 }}>{selected.term} months at {selected.apr}% APR</div>
            </div>
          </Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8, marginBottom: 12 }}>
            <StatCard label="Vehicle price" value={fmt(selected.price)} />
            <StatCard label="Fees" value={fmt(selected.fees || 0)} />
            <StatCard label="Total interest" value={fmt(selected.interest)} sub={`${pct(selected.interest, selected.price)}% of price`} />
            <StatCard label="Total paid" value={fmt(selected.total)} accent />
          </div>
          <div style={{ background: v.bg, borderRadius: 12, border: `1px solid ${v.border}`, padding: "13px 15px" }}>
            <p style={{ margin: 0, fontSize: 13, color: v.dark, lineHeight: 1.65 }}>
              You paid <strong>{pct(selected.interest, selected.price)}%</strong> of the vehicle price in interest —{" "}
              {selected.score >= 70 ? "within a normal range." : "higher than ideal. Refinancing may be worth exploring."}
            </p>
          </div>
        </div>
        <BottomNav active="home" onHome={() => go("home")} onAbout={() => go("about")} onHow={() => go("how")} />
        {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} onSuccess={handleUpgradeSuccess} />}
      </div>
    );
  }

  return null;
}
