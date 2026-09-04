import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ComposedChart, LineChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar, Cell, Legend
} from 'recharts';
import {
  Ruler, ArrowRight, RotateCcw, Check, Users, Copy, Sparkles, BookOpen,
  Dice5, Info, Loader2
} from 'lucide-react';

/* ------------------------------------------------------------------ *
 *  BHE0014 · Decision Lab
 *  An in-class elicitation instrument for cumulative prospect theory.
 *  Students complete price-list tasks; the app fits alpha, beta,
 *  lambda and gamma to their own revealed choices and pools the
 *  cohort for the lecture.
 * ------------------------------------------------------------------ */

/* ---------- tokens ---------- */
const T = {
  paper: '#EDF1F6',
  sheet: '#F8FAFC',
  rule: '#CBD6E4',
  ruleSoft: '#DDE5EF',
  ink: '#14243B',
  inkSoft: '#4A5B75',
  inkFaint: '#7E8DA5',
  gain: '#0E7C66',
  loss: '#B23A48',
  signal: '#2F5FE0',
  weight: '#A96A18',
};

const CSS = `
  .dl-grid {
    background-color: ${T.paper};
    background-image:
      linear-gradient(${T.ruleSoft} 1px, transparent 1px),
      linear-gradient(90deg, ${T.ruleSoft} 1px, transparent 1px);
    background-size: 28px 28px;
  }
  .dl-num { font-variant-numeric: tabular-nums; }
  .dl-row { transition: background-color .12s linear; }
  .dl-line { transition: transform .18s cubic-bezier(.2,.8,.2,1); }
  .dl-fade { animation: dlFade .45s ease both; }
  @keyframes dlFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .dl-focus:focus-visible { outline: 2px solid ${T.signal}; outline-offset: 2px; }
  input[type=range] { accent-color: ${T.signal}; }
  @media (prefers-reduced-motion: reduce) {
    .dl-fade, .dl-line, .dl-row { animation: none !important; transition: none !important; }
  }
`;

/* ---------- prospect theory maths ---------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const prelec = (p, g) => Math.exp(-Math.pow(-Math.log(p), g));
const money = (v) => '£' + Math.round(v).toLocaleString('en-GB');

/**
 * Fit v(x) = x^a (gains), -L(-x)^b (losses), w(p) = exp(-(-ln p)^g).
 * Certainty equivalents give a ln(CE/G) = -(-ln p)^g, one equation per
 * elicited probability. Grid search over (a, g), then recover b and L.
 */
function estimate(d) {
  const G = 1000;
  const pts = [[0.05, d.ce05], [0.5, d.ce50], [0.95, d.ce95]]
    .filter(([, ce]) => Number.isFinite(ce))
    .map(([p, ce]) => [p, clamp(ce, 1, 999)]);

  let best = { a: 0.88, g: 0.61, sse: Infinity };
  for (let a = 0.25; a <= 1.45; a += 0.01) {
    for (let g = 0.3; g <= 1.6; g += 0.01) {
      let sse = 0;
      for (const [p, ce] of pts) {
        const lhs = a * Math.log(ce / G);
        const rhs = -Math.pow(-Math.log(p), g);
        sse += (lhs - rhs) * (lhs - rhs);
      }
      if (sse < best.sse) best = { a: +a.toFixed(2), g: +g.toFixed(2), sse };
    }
  }

  const w50 = prelec(0.5, best.g);
  const ceL = clamp(Math.abs(d.ceLoss), 1, 999);
  let b = Math.log(w50) / Math.log(ceL / G);
  b = clamp(Number.isFinite(b) ? b : best.a, 0.2, 2);

  const x = clamp(d.lambdaSwitch, 5, 400);
  let L = Math.pow(x, best.a) / Math.pow(100, b);
  L = clamp(Number.isFinite(L) ? L : 1, 0.05, 12);

  return {
    alpha: best.a,
    beta: +b.toFixed(2),
    gamma: best.g,
    lambda: +L.toFixed(2),
    fitError: Math.sqrt(best.sse / Math.max(pts.length, 1)),
    wHat: pts.map(([p, ce]) => ({ p, w: +Math.pow(ce / G, best.a).toFixed(3) })),
  };
}

const value = (x, a, b, L) => (x >= 0 ? Math.pow(x, a) : -L * Math.pow(-x, b));

/* ---------- tasks ---------- */
const seq = (from, to, step) => {
  const out = [];
  if (step > 0) for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v));
  else for (let v = from; v >= to - 1e-9; v += step) out.push(Math.round(v));
  return out;
};

const TASKS = [
  {
    id: 'ce50', kind: 'ladder', block: 'Risk in the gain domain',
    title: 'What is this coin flip worth to you?',
    brief: 'Option B never changes: a fair coin decides whether you win £1,000 or nothing. Option A gets more generous as you move down the sheet.',
    values: seq(50, 950, 50),
    a: (v) => `${money(v)} for certain`,
    b: () => '50% £1,000 · 50% £0',
  },
  {
    id: 'frameGain', kind: 'choice',
    block: 'Framing', title: 'A restructuring decision',
    brief: 'A plant employing 600 people is closing. Two recovery plans are on the table. Their outcomes have been modelled precisely.',
    options: [
      { key: 'sure', label: 'Plan A', detail: '200 jobs will be saved.' },
      { key: 'risk', label: 'Plan B', detail: 'A one-third chance that all 600 jobs are saved, and a two-thirds chance that none are saved.' },
    ],
  },
  {
    id: 'ceLoss', kind: 'ladder', block: 'Risk in the loss domain',
    title: 'How much certain loss will you absorb?',
    brief: 'A supplier dispute has gone against you. Option B is a coin flip between losing £1,000 and losing nothing. Option A is a settlement you pay for certain — and it gets cheaper as you move down.',
    values: seq(950, 50, -50),
    a: (v) => `Settle for ${money(v)}`,
    b: () => '50% −£1,000 · 50% £0',
  },
  {
    id: 'lambda', kind: 'ladder', block: 'Mixed gambles',
    title: 'Would you take this bet?',
    brief: 'Every row is a single coin flip: heads you win the stated amount, tails you lose £100. Declining always leaves you at £0. The prize shrinks as you move down.',
    values: seq(300, 20, -20),
    a: () => 'Decline · £0',
    b: (v) => `50% win ${money(v)} · 50% lose £100`,
  },
  {
    id: 'ce05', kind: 'ladder', block: 'Small probabilities',
    title: 'A long shot',
    brief: 'Option B now pays £1,000 only 5% of the time. Its expected value is £50.',
    values: seq(10, 190, 10),
    a: (v) => `${money(v)} for certain`,
    b: () => '5% £1,000 · 95% £0',
  },
  {
    id: 'frameLoss', kind: 'choice',
    block: 'Framing', title: 'A second restructuring decision',
    brief: 'A different plant, also employing 600 people, is closing. Again there are two plans and the modelling is precise.',
    options: [
      { key: 'sure', label: 'Plan C', detail: '400 jobs will be lost.' },
      { key: 'risk', label: 'Plan D', detail: 'A one-third chance that no jobs are lost, and a two-thirds chance that all 600 are lost.' },
    ],
  },
  {
    id: 'ce95', kind: 'ladder', block: 'Near certainty',
    title: 'Almost a sure thing',
    brief: 'Option B pays £1,000 with probability 0.95. Its expected value is £950.',
    values: seq(620, 980, 20),
    a: (v) => `${money(v)} for certain`,
    b: () => '95% £1,000 · 5% £0',
  },
  {
    id: 'allais1', kind: 'choice', block: 'Independence',
    title: 'Portfolio one',
    brief: 'Pick the payoff distribution you would rather hold.',
    options: [
      { key: 'A', label: 'Portfolio A', detail: '£2,400 with certainty.' },
      { key: 'B', label: 'Portfolio B', detail: '33% £2,500 · 66% £2,400 · 1% £0.' },
    ],
  },
  {
    id: 'allais2', kind: 'choice', block: 'Independence',
    title: 'Portfolio two',
    brief: 'A separate decision, unrelated to the last one.',
    options: [
      { key: 'C', label: 'Portfolio C', detail: '34% £2,400 · 66% £0.' },
      { key: 'D', label: 'Portfolio D', detail: '33% £2,500 · 67% £0.' },
    ],
  },
  {
    id: 'wtp', kind: 'value', block: 'Valuation',
    title: 'What would you pay?',
    brief: 'A portable speaker is on sale in the seminar room. It has no resale market.',
    anchored: true,
    min: 0, max: 150, start: 40,
    label: 'Most you would pay',
  },
  {
    id: 'wta', kind: 'value', block: 'Valuation',
    title: 'What would you accept?',
    brief: 'Now assume the speaker is already yours — you were given one at registration and it is sitting in your bag. A classmate wants to buy it.',
    min: 0, max: 150, start: 40,
    label: 'Least you would accept',
  },
  {
    id: 'sunk', kind: 'choice', block: 'Mental accounting',
    title: 'The conference ticket',
    brief: 'You paid £180 for a non-refundable conference ticket three months ago. On the morning of the event you feel rough, the weather is foul, and a friend offers you a free ticket to something you would enjoy more, at the same time.',
    options: [
      { key: 'go', label: 'Go to the conference', detail: 'You have already paid for it.' },
      { key: 'skip', label: 'Go to the other event', detail: 'The £180 is gone either way.' },
    ],
  },
  {
    id: 'reflect', kind: 'text', block: 'Reflection',
    title: 'Before the results',
    brief: 'Selling something you own usually feels worse than never having bought it felt good. In one or two sentences, say why you think that is.',
  },
];

const LADDER_IDS = ['ce50', 'ceLoss', 'lambda', 'ce05', 'ce95'];

/* ---------- primitives ---------- */
const Sheet = ({ children, className = '', style = {} }) => (
  <div
    className={`rounded-lg ${className}`}
    style={{ background: T.sheet, border: `1px solid ${T.rule}`, boxShadow: '0 1px 0 rgba(20,36,59,.04)', ...style }}
  >
    {children}
  </div>
);

const Btn = ({ children, onClick, tone = 'solid', disabled, className = '', title }) => {
  const base = 'dl-focus inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition-colors';
  const styles = {
    solid: { background: disabled ? '#B8C4D6' : T.signal, color: '#fff', border: '1px solid transparent' },
    quiet: { background: 'transparent', color: T.ink, border: `1px solid ${T.rule}` },
    plain: { background: 'transparent', color: T.inkSoft, border: '1px solid transparent' },
  }[tone];
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      className={`${base} ${className}`}
      style={{ ...styles, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1 }}>
      {children}
    </button>
  );
};

const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="block text-sm mb-1" style={{ color: T.inkSoft }}>{label}</span>
    {children}
    {hint && <span className="block text-xs mt-1" style={{ color: T.inkFaint }}>{hint}</span>}
  </label>
);

const input = {
  background: '#fff', border: `1px solid ${T.rule}`, color: T.ink,
  borderRadius: 6, padding: '10px 12px', width: '100%', fontSize: 15,
};

/* ---------- the price list ---------- */
function Ladder({ task, onCommit }) {
  const [pick, setPick] = useState(null);
  const [hover, setHover] = useState(null);
  const rows = task.values;
  const marker = hover ?? pick;

  const ce = useMemo(() => {
    if (pick === null) return null;
    const v = rows;
    if (pick === 0) return v[0] - (v[1] - v[0]) / 2;
    if (pick === v.length) return v[v.length - 1] + (v[v.length - 1] - v[v.length - 2]) / 2;
    return (v[pick - 1] + v[pick]) / 2;
  }, [pick, rows]);

  return (
    <div>
      <p className="text-sm mb-3" style={{ color: T.inkSoft }}>
        Read down the sheet. Option A becomes more attractive as you go.
        Click the first row where you would choose A — everything above it is a vote for B.
      </p>

      <Sheet className="overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 text-xs" style={{ color: T.inkFaint, borderBottom: `1px solid ${T.rule}` }}>
          <div className="col-span-1">#</div>
          <div className="col-span-5">Option A</div>
          <div className="col-span-6">Option B</div>
        </div>

        <div>
          {rows.map((v, i) => {
            const isA = marker !== null && i >= marker;
            const tintA = isA ? 'rgba(47,95,224,.09)' : 'transparent';
            const tintB = !isA && marker !== null ? 'rgba(20,36,59,.05)' : 'transparent';
            const boundary = marker === i;
            return (
              <div key={v}>
                {boundary && (
                  <div className="dl-line flex items-center gap-2 px-4 py-1" style={{ background: 'rgba(47,95,224,.06)' }}>
                    <div className="h-px flex-1" style={{ background: T.signal }} />
                    <span className="text-xs font-semibold" style={{ color: T.signal }}>switch to A here</span>
                    <div className="h-px flex-1" style={{ background: T.signal }} />
                  </div>
                )}
                <button
                  className="dl-row dl-focus grid w-full grid-cols-12 items-center px-4 py-2 text-left text-sm"
                  style={{ borderTop: i === 0 ? 'none' : `1px solid ${T.ruleSoft}`, cursor: 'pointer' }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  onClick={() => setPick(i)}
                >
                  <span className="col-span-1 dl-num text-xs" style={{ color: T.inkFaint }}>{i + 1}</span>
                  <span className="col-span-5 dl-num px-2 py-1 rounded"
                    style={{ background: tintA, color: isA ? T.signal : T.ink, fontWeight: isA ? 600 : 400 }}>
                    {task.a(v)}
                  </span>
                  <span className="col-span-6 dl-num px-2 py-1 rounded"
                    style={{ background: tintB, color: !isA && marker !== null ? T.ink : T.inkSoft, fontWeight: !isA && marker !== null ? 600 : 400 }}>
                    {task.b(v)}
                  </span>
                </button>
              </div>
            );
          })}
          {marker === rows.length && (
            <div className="dl-line flex items-center gap-2 px-4 py-1" style={{ background: 'rgba(47,95,224,.06)' }}>
              <div className="h-px flex-1" style={{ background: T.signal }} />
              <span className="text-xs font-semibold" style={{ color: T.signal }}>B all the way down</span>
              <div className="h-px flex-1" style={{ background: T.signal }} />
            </div>
          )}
        </div>
      </Sheet>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Btn tone="quiet" onClick={() => setPick(rows.length)}>I would choose B in every row</Btn>
        <div className="flex-1" />
        {pick !== null && (
          <span className="dl-num text-sm" style={{ color: T.inkSoft }}>
            Indifference near {money(Math.abs(ce))}
          </span>
        )}
        <Btn onClick={() => onCommit(ce)} disabled={pick === null}>
          Record and continue
        </Btn>
      </div>
    </div>
  );
}

/* ---------- binary choice ---------- */
function Choice({ task, onCommit }) {
  const [sel, setSel] = useState(null);
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        {task.options.map((o) => {
          const on = sel === o.key;
          return (
            <button key={o.key} onClick={() => setSel(o.key)}
              className="dl-focus rounded-lg p-5 text-left transition-colors"
              style={{
                background: on ? 'rgba(47,95,224,.07)' : T.sheet,
                border: `1px solid ${on ? T.signal : T.rule}`,
                cursor: 'pointer',
              }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-semibold" style={{ color: on ? T.signal : T.ink }}>{o.label}</span>
                {on && <Check className="h-4 w-4" style={{ color: T.signal }} />}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>{o.detail}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex justify-end">
        <Btn onClick={() => onCommit(sel)} disabled={!sel}>Record and continue</Btn>
      </div>
    </div>
  );
}

/* ---------- valuation with anchor ---------- */
function Valuation({ task, anchor, onCommit }) {
  const [v, setV] = useState(task.start ?? 40);
  const [seen, setSeen] = useState(!task.anchored);
  const [above, setAbove] = useState(null);

  if (task.anchored && !seen) {
    return (
      <div className="dl-fade">
        <Sheet className="p-6">
          <p className="text-sm mb-1" style={{ color: T.inkFaint }}>Your randomly assigned bidder number</p>
          <p className="dl-num text-5xl font-bold mb-5" style={{ color: T.ink }}>{String(anchor).padStart(2, '0')}</p>
          <p className="text-base mb-4" style={{ color: T.ink }}>
            Would you pay more or less than {money(anchor)} for the speaker?
          </p>
          <div className="flex gap-3">
            {['More', 'Less'].map((lab) => (
              <button key={lab} onClick={() => { setAbove(lab === 'More'); setSeen(true); }}
                className="dl-focus rounded-md px-5 py-3 text-sm font-semibold"
                style={{ border: `1px solid ${T.rule}`, background: '#fff', color: T.ink, cursor: 'pointer' }}>
                {lab}
              </button>
            ))}
          </div>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="dl-fade">
      <Sheet className="p-6">
        <div className="flex items-end justify-between mb-4">
          <span className="text-sm" style={{ color: T.inkSoft }}>{task.label}</span>
          <span className="dl-num text-4xl font-bold" style={{ color: T.signal }}>{money(v)}</span>
        </div>
        <input type="range" min={task.min} max={task.max} value={v} step={1}
          onChange={(e) => setV(parseInt(e.target.value, 10))}
          className="dl-focus w-full" style={{ height: 6 }} />
        <div className="dl-num mt-1 flex justify-between text-xs" style={{ color: T.inkFaint }}>
          <span>{money(task.min)}</span><span>{money(task.max)}</span>
        </div>
      </Sheet>
      <div className="mt-5 flex justify-end">
        <Btn onClick={() => onCommit({ value: v, above })}>Record and continue</Btn>
      </div>
    </div>
  );
}

/* ---------- free text ---------- */
function TextTask({ onCommit }) {
  const [t, setT] = useState('');
  return (
    <div>
      <textarea value={t} onChange={(e) => setT(e.target.value)} rows={4}
        placeholder="Write a sentence or two."
        className="dl-focus w-full" style={{ ...input, resize: 'vertical', lineHeight: 1.6 }} />
      <div className="mt-4 flex justify-end">
        <Btn onClick={() => onCommit(t.trim())} disabled={t.trim().length < 8}>Finish and fit my curve</Btn>
      </div>
    </div>
  );
}

/* ---------- results components ---------- */
const Param = ({ symbol, name, val, median, note, colour }) => (
  <Sheet className="p-4">
    <div className="flex items-baseline justify-between">
      <span className="text-lg" style={{ color: colour, fontStyle: 'italic', fontWeight: 600 }}>{symbol}</span>
      <span className="dl-num text-2xl font-bold" style={{ color: T.ink }}>{val}</span>
    </div>
    <p className="mt-1 text-sm" style={{ color: T.ink }}>{name}</p>
    <p className="mt-2 text-xs leading-relaxed" style={{ color: T.inkFaint }}>{note}</p>
    <p className="dl-num mt-2 text-xs" style={{ color: T.inkFaint }}>Published median {median}</p>
  </Sheet>
);

const Finding = ({ on, title, detail }) => (
  <div className="flex gap-3 py-3" style={{ borderTop: `1px solid ${T.ruleSoft}` }}>
    <span className="mt-1 h-2 w-2 shrink-0 rounded-full"
      style={{ background: on ? T.loss : T.gain }} />
    <div>
      <p className="text-sm font-semibold" style={{ color: T.ink }}>{title}</p>
      <p className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>{detail}</p>
    </div>
  </div>
);

/* ================================================================== */
export default function App() {
  const [stage, setStage] = useState('intro');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [nickname, setNickname] = useState('');
  const [cohort, setCohort] = useState('BHE0014');
  const [anchor] = useState(() => (Math.random() < 0.5 ? 23 : 87));
  const [fitted, setFitted] = useState(null);
  const [payout, setPayout] = useState(null);
  const [shared, setShared] = useState('idle');
  const [classRows, setClassRows] = useState(null);
  const [classState, setClassState] = useState('idle');
  const [debrief, setDebrief] = useState({ state: 'idle', text: '' });
  const [tab, setTab] = useState('you');
  const topRef = useRef(null);

  const task = TASKS[idx];

  useEffect(() => {
    if (topRef.current) topRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [idx, stage]);

  const record = (val) => {
    const next = { ...answers, [task.id]: val };
    setAnswers(next);
    if (idx < TASKS.length - 1) { setIdx(idx + 1); return; }
    finish(next);
  };

  const finish = (a) => {
    const d = {
      ce05: a.ce05, ce50: a.ce50, ce95: a.ce95,
      ceLoss: a.ceLoss, lambdaSwitch: a.lambda,
    };
    const f = estimate(d);
    setFitted(f);

    // Random incentivised selection: one decision is drawn and resolved.
    const drawable = LADDER_IDS.filter((k) => Number.isFinite(a[k]));
    const chosen = drawable[Math.floor(Math.random() * drawable.length)];
    const heads = Math.random() < 0.5;
    setPayout({ task: chosen, heads });
    setStage('results');
  };

  const derived = useMemo(() => {
    if (!fitted) return null;
    const a = answers;
    return {
      riskAverseGain: a.ce50 < 500,
      riskSeekingLoss: Math.abs(a.ceLoss) < 500,
      lossAverse: fitted.lambda > 1.05,
      overweightSmall: a.ce05 > 50,
      underweightLarge: a.ce95 < 950,
      allais: (a.allais1 === 'A' && a.allais2 === 'D') || (a.allais1 === 'B' && a.allais2 === 'C'),
      framing: a.frameGain === 'sure' && a.frameLoss === 'risk',
      endowment: (a.wta?.value ?? 0) > (a.wtp?.value ?? 0),
      sunk: a.sunk === 'go',
      wtaRatio: ((a.wta?.value ?? 0) / Math.max(a.wtp?.value ?? 1, 1)).toFixed(2),
    };
  }, [fitted, answers]);

  const record_ = useMemo(() => {
    if (!fitted) return null;
    return {
      cohort, nickname: nickname || 'anon', t: Date.now(),
      ce05: answers.ce05, ce50: answers.ce50, ce95: answers.ce95,
      ceLoss: answers.ceLoss, lambdaSwitch: answers.lambda,
      alpha: fitted.alpha, beta: fitted.beta, gamma: fitted.gamma, lambda: fitted.lambda,
      anchor, wtp: answers.wtp?.value, wta: answers.wta?.value,
      allais: derived.allais ? 1 : 0, framing: derived.framing ? 1 : 0, sunk: derived.sunk ? 1 : 0,
    };
  }, [fitted, answers, derived, anchor, cohort, nickname]);

  /* ---------- shared cohort store ---------- */
  const key = (id) => `dl:${cohort.replace(/[^A-Za-z0-9_-]/g, '')}:${id}`;

  const submitToCohort = async () => {
    if (!window.storage) { setShared('unavailable'); return; }
    setShared('saving');
    try {
      const id = Math.random().toString(36).slice(2, 10);
      await window.storage.set(key(id), JSON.stringify(record_), true);
      setShared('done');
    } catch (e) {
      setShared('error');
    }
  };

  const loadCohort = async () => {
    if (!window.storage) { setClassState('unavailable'); return; }
    setClassState('loading');
    try {
      const list = await window.storage.list(`dl:${cohort.replace(/[^A-Za-z0-9_-]/g, '')}:`, true);
      const keys = (list?.keys ?? []).slice(0, 80);
      const out = [];
      for (const k of keys) {
        try {
          const r = await window.storage.get(k, true);
          if (r?.value) out.push(JSON.parse(r.value));
        } catch (e) { /* skip unreadable entry */ }
        setClassRows([...out]);
      }
      setClassRows(out);
      setClassState(out.length ? 'done' : 'empty');
    } catch (e) {
      setClassState('error');
    }
  };

  /* ---------- optional AI debrief ---------- */
  const runDebrief = async () => {
    setDebrief({ state: 'loading', text: '' });
    const prompt = `You are a behavioural economics tutor writing a short, specific debrief for one undergraduate.
Their fitted cumulative prospect theory parameters, from their own price-list choices:
alpha (gain curvature) ${fitted.alpha}, beta (loss curvature) ${fitted.beta}, lambda (loss aversion) ${fitted.lambda}, gamma (probability weighting) ${fitted.gamma}.
Certainty equivalents: 5% of £1000 -> £${Math.round(answers.ce05)}; 50% -> £${Math.round(answers.ce50)}; 95% -> £${Math.round(answers.ce95)}; 50% chance of -£1000 -> £${Math.round(Math.abs(answers.ceLoss))} settled.
Allais-style independence violation: ${derived.allais ? 'yes' : 'no'}. Framing reversal: ${derived.framing ? 'yes' : 'no'}. WTA/WTP ratio: ${derived.wtaRatio}.
Their own explanation of the endowment effect: "${answers.reflect}"
Write 110-140 words. Address them directly, quote their actual numbers, say one thing their choices got right and one tension worth examining, and end with a concrete decision context where this pattern would cost them money. No headings, no bullet points, no flattery.`;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).map((c) => (c.type === 'text' ? c.text : '')).join('').trim();
      setDebrief(text ? { state: 'done', text } : { state: 'error', text: '' });
    } catch (e) {
      setDebrief({ state: 'error', text: '' });
    }
  };

  /* ---------- chart data ---------- */
  const valueData = useMemo(() => {
    if (!fitted) return [];
    const rows = [];
    const scaleYou = 100 / Math.pow(100, fitted.alpha);
    const scaleRef = 100 / Math.pow(100, 0.88);
    for (let x = -300; x <= 300; x += 10) {
      rows.push({
        x,
        you: +(value(x, fitted.alpha, fitted.beta, fitted.lambda) * scaleYou).toFixed(2),
        ref: +(value(x, 0.88, 0.88, 2.25) * scaleRef).toFixed(2),
        neutral: x,
      });
    }
    return rows;
  }, [fitted]);

  const weightData = useMemo(() => {
    if (!fitted) return [];
    const rows = [];
    for (let p = 0.01; p <= 0.995; p += 0.01) {
      rows.push({
        p: +p.toFixed(2),
        you: +prelec(p, fitted.gamma).toFixed(3),
        ref: +prelec(p, 0.61).toFixed(3),
        identity: +p.toFixed(3),
        point: fitted.wHat.find((q) => Math.abs(q.p - p) < 0.005)?.w ?? null,
      });
    }
    return rows;
  }, [fitted]);

  const ceData = useMemo(() => {
    if (!fitted) return [];
    return [
      { name: '5% of £1,000', ev: 50, ce: Math.round(answers.ce05) },
      { name: '50% of £1,000', ev: 500, ce: Math.round(answers.ce50) },
      { name: '95% of £1,000', ev: 950, ce: Math.round(answers.ce95) },
    ];
  }, [fitted, answers]);

  const csv = useMemo(() => {
    if (!record_) return '';
    const head = Object.keys(record_).join(',');
    const row = Object.values(record_).map((v) => (typeof v === 'string' ? `"${v}"` : v)).join(',');
    return `${head}\n${row}`;
  }, [record_]);

  const cohortCsv = useMemo(() => {
    if (!classRows?.length) return '';
    const head = Object.keys(classRows[0]).join(',');
    return [head, ...classRows.map((r) => Object.values(r).map((v) => (typeof v === 'string' ? `"${v}"` : v)).join(','))].join('\n');
  }, [classRows]);

  const copy = (text) => {
    try { navigator.clipboard.writeText(text); } catch (e) { /* selection fallback below */ }
  };

  /* ================= renders ================= */

  const Header = () => (
    <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3"
      style={{ borderBottom: `1px solid ${T.rule}`, paddingBottom: 14 }}>
      <div className="flex items-baseline gap-3">
        <Ruler className="h-5 w-5" style={{ color: T.signal, transform: 'translateY(3px)' }} />
        <span className="text-lg font-semibold" style={{ color: T.ink }}>Decision Lab</span>
        <span className="dl-num text-sm" style={{ color: T.inkFaint }}>BHE0014</span>
      </div>
      {stage === 'tasks' && (
        <span className="dl-num text-sm" style={{ color: T.inkSoft }}>
          {idx + 1} of {TASKS.length} · {task.block}
        </span>
      )}
    </header>
  );

  const intro = (
    <div className="dl-fade mx-auto max-w-3xl">
      <div className="mb-10">
        <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl" style={{ color: T.ink, letterSpacing: '-0.02em' }}>
          Thirteen decisions, and then your own value function.
        </h1>
        <p className="text-lg leading-relaxed" style={{ color: T.inkSoft, maxWidth: '62ch' }}>
          This is an elicitation instrument, not a quiz. You will work down a series of price lists
          and pick the row where you change your mind. Those switching points are enough to estimate
          the four parameters of cumulative prospect theory for you personally, and to plot your
          curve against Kahneman and Tversky's.
        </p>
      </div>

      <Sheet className="mb-8 p-0 overflow-hidden">
        <div className="px-6 pt-6">
          <p className="text-sm" style={{ color: T.inkFaint }}>What gets drawn at the end</p>
        </div>
        <div className="h-56 px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={Array.from({ length: 61 }, (_, i) => {
              const x = -300 + i * 10;
              return { x, ref: value(x, 0.88, 0.88, 2.25) * (100 / Math.pow(100, 0.88)) };
            })} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={T.ruleSoft} />
              <XAxis dataKey="x" type="number" domain={[-300, 300]} tick={{ fill: T.inkFaint, fontSize: 11 }} stroke={T.rule} />
              <YAxis tick={{ fill: T.inkFaint, fontSize: 11 }} stroke={T.rule} />
              <ReferenceLine x={0} stroke={T.rule} />
              <ReferenceLine y={0} stroke={T.rule} />
              <Line type="monotone" dataKey="ref" stroke={T.inkFaint} strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="px-6 pb-5 text-sm" style={{ color: T.inkFaint }}>
          The dashed line is the published median. Yours will be drawn over it.
        </p>
      </Sheet>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Field label="Display name for the class results" hint="Anything you like. This is shared with everyone in the room.">
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={18}
            placeholder="e.g. Blue Owl" className="dl-focus" style={input} />
        </Field>
        <Field label="Session code" hint="Keeps seminar groups separate. Your lecturer will give you this.">
          <input value={cohort} onChange={(e) => setCohort(e.target.value)} maxLength={20}
            className="dl-focus dl-num" style={input} />
        </Field>
      </div>

      <div className="mb-8 flex gap-3 rounded-md p-4" style={{ background: 'rgba(47,95,224,.06)', border: `1px solid ${T.ruleSoft}` }}>
        <Info className="mt-1 h-4 w-4 shrink-0" style={{ color: T.signal }} />
        <p className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>
          No feedback is given between tasks. Telling you the theory halfway through would change
          how you answer the rest, and the estimates would be worthless. Everything is explained at the end.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Btn onClick={() => setStage('tasks')}>Begin <ArrowRight className="h-4 w-4" /></Btn>
        <span className="text-sm" style={{ color: T.inkFaint }}>About eight minutes · University of Huddersfield · Said Kaawach</span>
      </div>
    </div>
  );

  const tasks = (
    <div className="dl-fade mx-auto max-w-3xl">
      <div className="mb-6 h-1 w-full rounded-full" style={{ background: T.ruleSoft }}>
        <div className="h-1 rounded-full" style={{ width: `${(idx / TASKS.length) * 100}%`, background: T.signal, transition: 'width .3s ease' }} />
      </div>
      <p className="mb-1 text-sm" style={{ color: T.signal }}>{task.block}</p>
      <h2 className="mb-3 text-3xl font-bold" style={{ color: T.ink, letterSpacing: '-0.01em' }}>{task.title}</h2>
      <p className="mb-6 text-base leading-relaxed" style={{ color: T.inkSoft, maxWidth: '68ch' }}>{task.brief}</p>

      {task.kind === 'ladder' && <Ladder key={task.id} task={task} onCommit={record} />}
      {task.kind === 'choice' && <Choice key={task.id} task={task} onCommit={record} />}
      {task.kind === 'value' && <Valuation key={task.id} task={task} anchor={anchor} onCommit={record} />}
      {task.kind === 'text' && <TextTask key={task.id} onCommit={record} />}
    </div>
  );

  const you = fitted && (
    <div className="dl-fade">
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <Param symbol="α" name="Curvature over gains" val={fitted.alpha} median="0.88" colour={T.gain}
          note={fitted.alpha < 1 ? 'Below 1: each extra pound adds less than the one before.' : 'At or above 1: you treat gains close to linearly.'} />
        <Param symbol="β" name="Curvature over losses" val={fitted.beta} median="0.88" colour={T.loss}
          note={fitted.beta < 1 ? 'Below 1: the second thousand lost hurts less than the first.' : 'At or above 1: losses scale steadily for you.'} />
        <Param symbol="λ" name="Loss aversion" val={fitted.lambda} median="2.25" colour={T.loss}
          note={`Losing £100 feels like ${fitted.lambda.toFixed(2)} times the gain of winning £100.`} />
        <Param symbol="γ" name="Probability weighting" val={fitted.gamma} median="0.61" colour={T.weight}
          note={fitted.gamma < 1 ? 'Below 1: small chances loom large, near-certainties get discounted.' : 'At or above 1: you take stated probabilities close to face value.'} />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Sheet className="p-5">
          <h3 className="mb-1 text-base font-semibold" style={{ color: T.ink }}>Your value function</h3>
          <p className="mb-3 text-sm" style={{ color: T.inkFaint }}>
            Solid is you, dashed is the published median, thin grey is a risk-neutral agent. Normalised so v(100) = 100.
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={valueData} margin={{ top: 6, right: 16, bottom: 6, left: 0 }}>
                <CartesianGrid stroke={T.ruleSoft} />
                <XAxis dataKey="x" type="number" domain={[-300, 300]} tick={{ fill: T.inkFaint, fontSize: 11 }} stroke={T.rule} />
                <YAxis tick={{ fill: T.inkFaint, fontSize: 11 }} stroke={T.rule} />
                <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${T.rule}`, borderRadius: 6, fontSize: 12 }} />
                <ReferenceLine x={0} stroke={T.rule} />
                <ReferenceLine y={0} stroke={T.rule} />
                <Line name="Risk neutral" type="linear" dataKey="neutral" stroke={T.ruleSoft} strokeWidth={1.5} dot={false} />
                <Line name="Median" type="monotone" dataKey="ref" stroke={T.inkFaint} strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line name="You" type="monotone" dataKey="you" stroke={T.signal} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Sheet>

        <Sheet className="p-5">
          <h3 className="mb-1 text-base font-semibold" style={{ color: T.ink }}>Your probability weighting</h3>
          <p className="mb-3 text-sm" style={{ color: T.inkFaint }}>
            Dots are the three weights implied by your certainty equivalents; the straight line is what a rational agent would do.
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weightData} margin={{ top: 6, right: 16, bottom: 6, left: 0 }}>
                <CartesianGrid stroke={T.ruleSoft} />
                <XAxis dataKey="p" type="number" domain={[0, 1]} tick={{ fill: T.inkFaint, fontSize: 11 }} stroke={T.rule} />
                <YAxis domain={[0, 1]} tick={{ fill: T.inkFaint, fontSize: 11 }} stroke={T.rule} />
                <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${T.rule}`, borderRadius: 6, fontSize: 12 }} />
                <Line name="Stated probability" type="linear" dataKey="identity" stroke={T.ruleSoft} strokeWidth={1.5} dot={false} />
                <Line name="Median" type="monotone" dataKey="ref" stroke={T.inkFaint} strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line name="You" type="monotone" dataKey="you" stroke={T.weight} strokeWidth={2.5} dot={false} />
                <Scatter name="Your data" dataKey="point" fill={T.weight} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Sheet>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Sheet className="p-5">
          <h3 className="mb-1 text-base font-semibold" style={{ color: T.ink }}>What you charged for risk</h3>
          <p className="mb-3 text-sm" style={{ color: T.inkFaint }}>
            Your certainty equivalent against the expected value of each lottery. Gaps below the line are risk premia you paid.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ceData} margin={{ top: 6, right: 16, bottom: 6, left: 0 }}>
                <CartesianGrid stroke={T.ruleSoft} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: T.inkFaint, fontSize: 11 }} stroke={T.rule} />
                <YAxis tick={{ fill: T.inkFaint, fontSize: 11 }} stroke={T.rule} />
                <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${T.rule}`, borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar name="Expected value" dataKey="ev" fill={T.ruleSoft} />
                <Bar name="Your certainty equivalent" dataKey="ce" fill={T.signal} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Sheet>

        <Sheet className="p-5">
          <h3 className="mb-3 text-base font-semibold" style={{ color: T.ink }}>Consistency checks</h3>
          <Finding on={derived.allais}
            title={derived.allais ? 'You violated the independence axiom' : 'Your portfolio choices were consistent'}
            detail={derived.allais
              ? 'Portfolios one and two are the same gamble with a common 66% component stripped out. Preferring A then D (or B then C) cannot be represented by any expected utility function. This is the Allais paradox, and almost everyone falls into it.'
              : 'You made the same trade-off in both portfolio decisions, which is what expected utility requires. Most people do not.'} />
          <Finding on={derived.framing}
            title={derived.framing ? 'The wording moved you' : 'You held the same position in both frames'}
            detail={derived.framing
              ? 'Plans A and C are identical outcomes, as are B and D. Choosing the certain plan when it was described as jobs saved, then the gamble when it was described as jobs lost, is the classic reflection effect.'
              : 'The two restructuring problems were the same numbers in different clothes, and you treated them the same way.'} />
          <Finding on={derived.endowment}
            title={`Your selling price was ${derived.wtaRatio}× your buying price`}
            detail={derived.endowment
              ? 'Ownership moved your reference point. What you were happy to pay became a floor once the speaker was yours, which is the endowment effect and a direct consequence of λ > 1.'
              : 'You valued the speaker the same whether buying or selling. Standard theory says this is correct, and it is unusual.'} />
          <Finding on={derived.sunk}
            title={derived.sunk ? 'The £180 pulled you in' : 'You ignored the sunk cost'}
            detail={derived.sunk
              ? 'The ticket money is spent whatever you do this morning. Only the enjoyment of the two events should have entered the decision.'
              : 'The money was gone either way, and you decided on the merits of the morning ahead.'} />
        </Sheet>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Sheet className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <Dice5 className="h-4 w-4" style={{ color: T.signal }} />
            <h3 className="text-base font-semibold" style={{ color: T.ink }}>If this had been for real money</h3>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>
            Experiments pay one randomly drawn decision, so that no single answer can be treated as
            costless. The draw selected <strong>{TASKS.find((t) => t.id === payout?.task)?.title}</strong> and
            the coin came up <strong>{payout?.heads ? 'heads' : 'tails'}</strong>. Knowing this rule
            in advance is what makes it rational to answer honestly rather than strategically.
          </p>
        </Sheet>

        <Sheet className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: T.weight }} />
            <h3 className="text-base font-semibold" style={{ color: T.ink }}>Written debrief</h3>
          </div>
          {debrief.state === 'idle' && (
            <>
              <p className="mb-3 text-sm" style={{ color: T.inkSoft }}>
                Reads your fitted parameters and your own explanation of the endowment effect, and writes back a short critique.
              </p>
              <Btn tone="quiet" onClick={runDebrief}>Write my debrief</Btn>
            </>
          )}
          {debrief.state === 'loading' && (
            <p className="flex items-center gap-2 text-sm" style={{ color: T.inkSoft }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Reading your choices
            </p>
          )}
          {debrief.state === 'done' && (
            <p className="text-sm leading-relaxed" style={{ color: T.ink }}>{debrief.text}</p>
          )}
          {debrief.state === 'error' && (
            <div>
              <p className="mb-3 text-sm" style={{ color: T.inkSoft }}>
                The debrief did not come back. Your results above are unaffected.
              </p>
              <Btn tone="quiet" onClick={runDebrief}>Try again</Btn>
            </div>
          )}
        </Sheet>
      </div>
    </div>
  );

  const cohortView = (
    <div className="dl-fade">
      <Sheet className="mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold" style={{ color: T.ink }}>Session {cohort}</h3>
            <p className="text-sm" style={{ color: T.inkSoft }}>
              Submitting adds your four parameters and your anchor group to a pool everyone in the session can read. No names beyond your display name.
            </p>
          </div>
          <div className="flex gap-3">
            <Btn onClick={submitToCohort} disabled={shared === 'saving' || shared === 'done'}>
              {shared === 'done' ? <><Check className="h-4 w-4" /> Submitted</> : 'Submit my results'}
            </Btn>
            <Btn tone="quiet" onClick={loadCohort}>
              <Users className="h-4 w-4" /> Load the room
            </Btn>
          </div>
        </div>
        {shared === 'error' && <p className="mt-3 text-sm" style={{ color: T.loss }}>Submission failed. Check the session code and try again.</p>}
        {shared === 'unavailable' && <p className="mt-3 text-sm" style={{ color: T.inkSoft }}>Shared storage is not available here. Use the export below and hand the row to your lecturer.</p>}
      </Sheet>

      {classState === 'loading' && <p className="text-sm" style={{ color: T.inkSoft }}>Loading submissions…</p>}
      {classState === 'empty' && <p className="text-sm" style={{ color: T.inkSoft }}>Nobody has submitted to this session code yet.</p>}
      {classState === 'error' && <p className="text-sm" style={{ color: T.loss }}>Could not read the pool. Try loading again.</p>}

      {classRows?.length > 0 && <CohortCharts rows={classRows} csv={cohortCsv} onCopy={copy} />}
    </div>
  );

  const notes = (
    <div className="dl-fade mx-auto max-w-3xl">
      <Sheet className="mb-6 p-6">
        <h3 className="mb-3 text-lg font-semibold" style={{ color: T.ink }}>How the parameters were recovered</h3>
        <p className="mb-3 text-sm leading-relaxed" style={{ color: T.inkSoft }}>
          Each price list gives a switching row, and the midpoint of the bracketing amounts is taken
          as a certainty equivalent. Under cumulative prospect theory a certainty equivalent for a
          single-outcome prospect satisfies CE<sup>α</sup> = w(p)·G<sup>α</sup>, so with the Prelec
          weighting function w(p) = exp(−(−ln p)<sup>γ</sup>) each elicited CE becomes one equation in
          α and γ. Three probabilities give an over-identified system, solved here by grid search over
          α ∈ [0.25, 1.45] and γ ∈ [0.30, 1.60] minimising squared error in log space.
        </p>
        <p className="mb-3 text-sm leading-relaxed" style={{ color: T.inkSoft }}>
          The loss-domain certainty equivalent identifies β directly, because λ cancels on both sides
          of the indifference condition. The mixed gamble then pins down λ: at the switching prize x*,
          indifference between accepting and declining implies λ = x*<sup>α</sup> / 100<sup>β</sup>.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>
          Estimates from a dozen decisions are noisy, and the standard caveats apply: hypothetical
          stakes, a single session, no randomisation of row order, and switching points that are
          intervals rather than points. The instrument is built to make the mechanics visible, not to
          publish.
        </p>
      </Sheet>

      <Sheet className="mb-6 p-6">
        <h3 className="mb-3 text-lg font-semibold" style={{ color: T.ink }}>Running this in a seminar</h3>
        <ul className="space-y-3 text-sm leading-relaxed" style={{ color: T.inkSoft }}>
          <li>Give every group a different session code so the pools stay separate and comparable.</li>
          <li>
            Bidder numbers are assigned at random as £23 or £87 before the willingness-to-pay question.
            Anchoring is invisible within one student and obvious across the room, so the anchor chart
            only works once the cohort has submitted. It is the strongest reveal in the set.
          </li>
          <li>Ask for the Allais and framing counts before showing them. Predictions made out loud are harder to forget.</li>
          <li>The cohort export is a flat CSV, ready for a quick regression of λ on anything else you collect.</li>
        </ul>
      </Sheet>

      <Sheet className="p-6">
        <h3 className="mb-3 text-lg font-semibold" style={{ color: T.ink }}>Your row, as data</h3>
        <textarea readOnly value={csv} rows={4}
          className="dl-num dl-focus w-full text-xs" style={{ ...input, fontFamily: 'ui-monospace, monospace' }} />
        <div className="mt-3">
          <Btn tone="quiet" onClick={() => copy(csv)}><Copy className="h-4 w-4" /> Copy CSV</Btn>
        </div>
      </Sheet>
    </div>
  );

  const results = (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h2 className="mb-2 text-3xl font-bold" style={{ color: T.ink, letterSpacing: '-0.01em' }}>
          {nickname ? `${nickname}, here is your curve` : 'Here is your curve'}
        </h2>
        <p className="text-base" style={{ color: T.inkSoft, maxWidth: '66ch' }}>
          Fitted to your thirteen decisions by minimising squared error against the certainty
          equivalents you revealed. Residual {fitted?.fitError.toFixed(3)} in log utility units.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-1" style={{ borderBottom: `1px solid ${T.rule}` }}>
        {[['you', 'Your results'], ['class', 'The room'], ['method', 'Method and teaching notes']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className="dl-focus px-4 py-3 text-sm font-semibold"
            style={{
              color: tab === k ? T.signal : T.inkSoft,
              borderBottom: `2px solid ${tab === k ? T.signal : 'transparent'}`,
              background: 'transparent', cursor: 'pointer', marginBottom: -1,
            }}>
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <Btn tone="plain" onClick={() => window.location.reload()}>
          <RotateCcw className="h-4 w-4" /> Restart
        </Btn>
      </div>

      {tab === 'you' && you}
      {tab === 'class' && cohortView}
      {tab === 'method' && notes}
    </div>
  );

  return (
    <div className="dl-grid min-h-screen px-5 py-8" style={{ color: T.ink, fontFamily: 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <style>{CSS}</style>
      <div ref={topRef} />
      <div className="mx-auto max-w-6xl">
        <Header />
        {stage === 'intro' && intro}
        {stage === 'tasks' && tasks}
        {stage === 'results' && results}
      </div>
    </div>
  );
}

/* ---------- cohort analytics ---------- */
function CohortCharts({ rows, csv, onCopy }) {
  const lambdaBuckets = useMemo(() => {
    const edges = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 12];
    return edges.slice(0, -1).map((lo, i) => {
      const hi = edges[i + 1];
      return {
        band: hi === 12 ? '4+' : `${lo}–${hi}`,
        n: rows.filter((r) => r.lambda >= lo && r.lambda < hi).length,
      };
    });
  }, [rows]);

  const anchorSplit = useMemo(() => {
    const g = (a) => rows.filter((r) => r.anchor === a && Number.isFinite(r.wtp));
    const mean = (xs) => (xs.length ? xs.reduce((s, r) => s + r.wtp, 0) / xs.length : 0);
    const lo = g(23), hi = g(87);
    return [
      { group: 'Shown £23', wtp: +mean(lo).toFixed(1), n: lo.length },
      { group: 'Shown £87', wtp: +mean(hi).toFixed(1), n: hi.length },
    ];
  }, [rows]);

  const rates = useMemo(() => {
    const pct = (f) => Math.round((rows.filter(f).length / rows.length) * 100);
    return [
      { label: 'Violated independence (Allais)', v: pct((r) => r.allais === 1) },
      { label: 'Reversed with the framing', v: pct((r) => r.framing === 1) },
      { label: 'Followed the sunk cost', v: pct((r) => r.sunk === 1) },
      { label: 'Loss averse (λ > 1)', v: pct((r) => r.lambda > 1) },
      { label: 'Sold higher than they would buy', v: pct((r) => r.wta > r.wtp) },
    ];
  }, [rows]);

  const medianLambda = useMemo(() => {
    const xs = rows.map((r) => r.lambda).sort((a, b) => a - b);
    return xs.length ? xs[Math.floor(xs.length / 2)].toFixed(2) : '–';
  }, [rows]);

  const anchorGap = anchorSplit[1].wtp - anchorSplit[0].wtp;

  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Sheet className="p-4">
          <p className="text-sm" style={{ color: T.inkSoft }}>Submissions</p>
          <p className="dl-num text-3xl font-bold" style={{ color: T.ink }}>{rows.length}</p>
        </Sheet>
        <Sheet className="p-4">
          <p className="text-sm" style={{ color: T.inkSoft }}>Median λ in the room</p>
          <p className="dl-num text-3xl font-bold" style={{ color: T.loss }}>{medianLambda}</p>
        </Sheet>
        <Sheet className="p-4">
          <p className="text-sm" style={{ color: T.inkSoft }}>Anchor gap in mean willingness to pay</p>
          <p className="dl-num text-3xl font-bold" style={{ color: anchorGap > 0 ? T.weight : T.inkFaint }}>
            {anchorGap > 0 ? '+' : ''}{anchorGap.toFixed(1)}
          </p>
        </Sheet>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Sheet className="p-5">
          <h3 className="mb-1 text-base font-semibold" style={{ color: T.ink }}>Distribution of loss aversion</h3>
          <p className="mb-3 text-sm" style={{ color: T.inkFaint }}>Published median is 2.25. The spread is the point: there is no representative agent in this room.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lambdaBuckets} margin={{ top: 6, right: 16, bottom: 6, left: 0 }}>
                <CartesianGrid stroke={T.ruleSoft} vertical={false} />
                <XAxis dataKey="band" tick={{ fill: T.inkFaint, fontSize: 11 }} stroke={T.rule} />
                <YAxis allowDecimals={false} tick={{ fill: T.inkFaint, fontSize: 11 }} stroke={T.rule} />
                <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${T.rule}`, borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="n" fill={T.loss}>
                  {lambdaBuckets.map((b, i) => <Cell key={i} fill={b.band === '2–2.5' ? T.signal : T.loss} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Sheet>

        <Sheet className="p-5">
          <h3 className="mb-1 text-base font-semibold" style={{ color: T.ink }}>The anchoring experiment</h3>
          <p className="mb-3 text-sm" style={{ color: T.inkFaint }}>
            Half the room saw £23 before valuing the speaker and half saw £87. The number was drawn at
            random and carried no information. Mean willingness to pay, by group.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={anchorSplit} margin={{ top: 6, right: 16, bottom: 6, left: 0 }}>
                <CartesianGrid stroke={T.ruleSoft} vertical={false} />
                <XAxis dataKey="group" tick={{ fill: T.inkFaint, fontSize: 11 }} stroke={T.rule} />
                <YAxis tick={{ fill: T.inkFaint, fontSize: 11 }} stroke={T.rule} />
                <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${T.rule}`, borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="wtp" fill={T.weight} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="dl-num mt-2 text-xs" style={{ color: T.inkFaint }}>
            n = {anchorSplit[0].n} and {anchorSplit[1].n}
          </p>
        </Sheet>
      </div>

      <Sheet className="mb-6 p-5">
        <h3 className="mb-4 text-base font-semibold" style={{ color: T.ink }}>How often the room departed from the textbook</h3>
        <div className="space-y-3">
          {rates.map((r) => (
            <div key={r.label}>
              <div className="mb-1 flex justify-between text-sm">
                <span style={{ color: T.inkSoft }}>{r.label}</span>
                <span className="dl-num font-semibold" style={{ color: T.ink }}>{r.v}%</span>
              </div>
              <div className="h-2 w-full rounded-full" style={{ background: T.ruleSoft }}>
                <div className="h-2 rounded-full" style={{ width: `${r.v}%`, background: T.signal }} />
              </div>
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4" style={{ color: T.inkSoft }} />
          <h3 className="text-base font-semibold" style={{ color: T.ink }}>Cohort export</h3>
        </div>
        <textarea readOnly value={csv} rows={5}
          className="dl-num dl-focus w-full text-xs" style={{ ...input, fontFamily: 'ui-monospace, monospace' }} />
        <div className="mt-3">
          <Btn tone="quiet" onClick={() => onCopy(csv)}><Copy className="h-4 w-4" /> Copy CSV</Btn>
        </div>
      </Sheet>
    </div>
  );
}
