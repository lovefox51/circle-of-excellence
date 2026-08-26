import React, { useState, useEffect, useMemo } from "react";
import {
  Award,
  Star,
  Flame,
  LayoutDashboard,
  Send,
  Crown,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Loader2,
  LogOut,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { fetchNominations, fetchMyProfile, insertNomination, forwardNomination, forwardAllPending, selectWinner } from "./db";
import Login from "./Login";

/* ---------------------------------------------------------------------- */
/*  Design tokens                                                          */
/* ---------------------------------------------------------------------- */

const COLORS = {
  bg: "#12162A",
  panel: "#1A2038",
  panelAlt: "#212949",
  hairline: "#2E3658",
  text: "#F2EFE7",
  textMuted: "#9AA3C4",
  textFaint: "#6C7496",
  gold: "#D8AA4E",
  goldSoft: "#E8CD8E",
  champion: "#5F94C4",
  shiningStar: "#A583D6",
  hero: "#E0793E",
  good: "#5FB88A",
  bad: "#D9705F",
};

/* ---------------------------------------------------------------------- */
/*  Award type definitions (mirrors the three source paper forms)          */
/* ---------------------------------------------------------------------- */

const AWARD_TYPES = {
  champion: {
    key: "champion",
    name: "Champion of the Month",
    tagline: "One nominee per department",
    color: COLORS.champion,
    icon: Award,
    flow: "Department Head → P&C → General Manager picks the winner",
    minMonths: 0,
    cleanFileMonths: 24,
    scale: [
      { key: "above", label: "Above Expectations" },
      { key: "meets", label: "Meets Expectations" },
      { key: "below", label: "Below Expectations" },
    ],
    criteria: ["Knowledge of Job", "Dependability", "Cooperation", "Quality & Quantity of Work", "Yes I Can Attitude"],
  },
  shiningStar: {
    key: "shiningStar",
    name: "Shining Star of the Month",
    tagline: "One nominee per department, supervisory track",
    color: COLORS.shiningStar,
    icon: Star,
    flow: "Department Head → P&C → General Manager picks the winner",
    minMonths: 6,
    cleanFileMonths: 24,
    categories: ["Supervisory Level", "Non-Supervisory Level"],
    scale: [
      { key: "above", label: "Above Expectations" },
      { key: "meets", label: "Meets Expectations" },
    ],
    criteria: ["Job Knowledge", "Ownership", "Problem Solving", "Collaboration", "Communication", "Motivation and Inspiration"],
  },
  hero: {
    key: "hero",
    name: "Hero of the Month",
    tagline: "Leadership-level recognition",
    color: COLORS.hero,
    icon: Flame,
    flow: "Nominated and finalized directly by the General Manager",
    minMonths: 12,
    cleanFileMonths: 24,
    levels: ["Department Head", "Assistant Manager", "Level 3 Supervisor"],
    foundations: [
      {
        key: "lead",
        title: "LEAD",
        subs: [
          ["Is Emotionally Intelligent", "Understands individual personalities and drivers; builds a team where everyone feels included, heard and understood."],
          ["Motivates, Inspires & Influences", "Instils the Yes I Can! spirit and genuinely celebrates the success of others."],
          ["Develops Self and Others", "Learns from successes and failures; sets clear expectations and grows future leaders."],
          ["Master Communication", "Listens actively and delivers messages clearly, honestly and on time."],
        ],
      },
      {
        key: "think",
        title: "THINK",
        subs: [
          ["Thinks Strategically", "Generates unique business insight and sees different possible outcomes."],
          ["Simplifies Complexity", "Structures communication around key messages and shapes shared understanding."],
          ["Is a Problem Solver", "Asks the tough questions and analyzes data to find the best solution."],
          ["Is Curious & Creative", "Steps out of the comfort zone and challenges the status quo."],
        ],
      },
      {
        key: "own",
        title: "OWN",
        subs: [
          ["Is a Business Expert", "Puts the guest at the centre of everything and knows the business inside out."],
          ["Thinks Bigger Business", "Understands how their actions ripple across the whole organisation."],
          ["Takes Responsibility", "Holds self and others accountable and goes the extra mile."],
          ["Is Open to Challenges", "Turns challenges into business opportunities."],
        ],
      },
      {
        key: "collaborate",
        title: "COLLABORATE",
        subs: [
          ["Fosters a Feedback Culture", "Gives and receives feedback constructively and without defensiveness."],
          ["Builds Trust", "Fosters open, direct, transparent communication."],
          ["Champions Diversity", "Promotes the hiring, development and recognition of a diverse workforce."],
          ["Is a Team Player", "Collaborates across units, teams and geographies with integrity."],
        ],
      },
      {
        key: "deliver",
        title: "DELIVER",
        subs: [
          ["Acts with a Sense of Urgency", "Pushes for decisions and moves forward using common sense."],
          ["Prioritizes to Get Things Done", "Speaks up on risk and activates solutions."],
          ["Executes the Plan", "Develops, executes and follows up on plans to deliver strategy."],
          ["Is a Change Agent", "Initiates and navigates change, making others ambassadors of it."],
        ],
      },
    ],
    scoreOptions: [
      { value: 10, label: "Above Expectations", short: "Score 10" },
      { value: 5, label: "Meets Expectations", short: "Score 05" },
    ],
  },
};

const HERO_MAX_SCORE = AWARD_TYPES.hero.foundations.reduce((sum, f) => sum + f.subs.length, 0) * 10;

function heroSubKey(foundationKey, subIndex) {
  return `${foundationKey}__${subIndex}`;
}

const STATUS_META = {
  submitted: { label: "Awaiting P&C", bg: "rgba(216,170,78,0.16)", fg: COLORS.gold },
  with_gm: { label: "With General Manager", bg: "rgba(95,148,196,0.18)", fg: COLORS.champion },
  winner: { label: "Winner", bg: "rgba(95,184,138,0.16)", fg: COLORS.good },
  not_selected: { label: "Not Selected", bg: "rgba(108,116,150,0.16)", fg: COLORS.textFaint },
};

/* ---------------------------------------------------------------------- */
/*  Helpers                                                                 */
/* ---------------------------------------------------------------------- */

function monthsBetween(startISO, endDate) {
  if (!startISO) return 0;
  const start = new Date(startISO);
  if (isNaN(start.getTime())) return 0;
  let months = (endDate.getFullYear() - start.getFullYear()) * 12 + (endDate.getMonth() - start.getMonth());
  if (endDate.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthValue) {
  if (!monthValue) return "—";
  const [y, m] = monthValue.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function heroTotalScore(scores) {
  return Object.values(scores || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

/* ---------------------------------------------------------------------- */
/*  Small shared UI pieces                                                 */
/* ---------------------------------------------------------------------- */

function StatusPill({ status }) {
  const s = STATUS_META[status] || STATUS_META.submitted;
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

function TierBadge({ type, size = "sm" }) {
  const def = AWARD_TYPES[type];
  const Icon = def.icon;
  const dims = size === "sm" ? "w-6 h-6" : "w-9 h-9";
  const iconDims = size === "sm" ? 14 : 18;
  return (
    <span className={`inline-flex items-center justify-center rounded-full ${dims}`} style={{ background: `${def.color}26`, color: def.color }}>
      <Icon size={iconDims} />
    </span>
  );
}

function EligibilityRing({ monthsServed, minMonths, size = 108 }) {
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = minMonths === 0 ? 1 : Math.min(1, monthsServed / minMonths);
  const dash = circumference * pct;
  const eligible = monthsServed >= minMonths;
  const color = eligible ? COLORS.good : COLORS.gold;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={COLORS.hairline} strokeWidth="7" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-semibold" style={{ color: COLORS.text, fontFamily: "IBM Plex Mono, monospace", fontSize: 20 }}>
          {monthsServed}
        </span>
        <span className="text-[10px] uppercase tracking-wide" style={{ color: COLORS.textFaint }}>
          months served
        </span>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1.5" style={{ color: COLORS.textMuted }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  background: COLORS.panel,
  border: `1px solid ${COLORS.hairline}`,
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 13.5,
  color: COLORS.text,
  outline: "none",
};

const readOnlyStyle = { ...inputStyle, opacity: 0.75, cursor: "not-allowed" };

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <span className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: COLORS.panelAlt, color: COLORS.textFaint }}>
        <Icon size={22} />
      </span>
      <h3 className="font-semibold mb-1" style={{ color: COLORS.text }}>
        {title}
      </h3>
      <p className="text-sm max-w-xs" style={{ color: COLORS.textMuted }}>
        {body}
      </p>
    </div>
  );
}

function RatingRow({ label, options, value, onChange }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center py-3 px-4 rounded-xl" style={{ background: COLORS.panelAlt }}>
      <span className="text-sm font-medium" style={{ color: COLORS.text }}>
        {label}
      </span>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={value === opt.key ? { background: COLORS.gold, color: "#1A1406" } : { background: "transparent", color: COLORS.textMuted, border: `1px solid ${COLORS.hairline}` }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function HeroFoundationGroup({ foundation, scores, onChange }) {
  const scoredCount = foundation.subs.filter((_, i) => scores[heroSubKey(foundation.key, i)] != null).length;
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.hairline}` }}>
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
        <span className="font-semibold" style={{ color: COLORS.text, fontFamily: "Fraunces, serif" }}>
          {foundation.title}
        </span>
        <span className="text-[11px]" style={{ color: COLORS.textFaint }}>
          {scoredCount}/{foundation.subs.length} scored
        </span>
      </div>
      <div className="px-4 pb-4 space-y-2.5">
        {foundation.subs.map(([t, d], i) => {
          const key = heroSubKey(foundation.key, i);
          const value = scores[key];
          return (
            <div key={t} className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3 rounded-lg" style={{ background: COLORS.panel }}>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold mb-0.5" style={{ color: COLORS.goldSoft }}>
                  {t}
                </div>
                <div className="text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
                  {d}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {AWARD_TYPES.hero.scoreOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(key, opt.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
                    style={value === opt.value ? { background: COLORS.hero, color: "#241205" } : { background: "transparent", color: COLORS.textMuted, border: `1px solid ${COLORS.hairline}` }}
                  >
                    {opt.short}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Nominee/eligibility/scoring block — shared by both submission forms     */
/* ---------------------------------------------------------------------- */

function useNominationFormState(def, extra = {}) {
  const [name, setName] = useState("");
  const [clockNo, setClockNo] = useState("");
  const [department, setDepartment] = useState(extra.department || "");
  const [position, setPosition] = useState("");
  const [level, setLevel] = useState(def.levels ? def.levels[0] : undefined);
  const [startDate, setStartDate] = useState("");
  const [category, setCategory] = useState(def.categories ? def.categories[0] : undefined);
  const [cleanFile, setCleanFile] = useState(false);
  const [month, setMonth] = useState(extra.month || currentMonthValue());
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState("");
  const [submittedBy] = useState(extra.submittedBy || "");

  const monthsServed = useMemo(() => monthsBetween(startDate, new Date()), [startDate]);
  const isEligible = monthsServed >= def.minMonths;
  const totalCriteria = def.criteria ? def.criteria.length : def.foundations.reduce((s, fo) => s + fo.subs.length, 0);
  const scoredCount = Object.keys(scores).length;
  const heroScore = def.foundations ? heroTotalScore(scores) : null;

  return {
    name, setName, clockNo, setClockNo, department, setDepartment, position, setPosition,
    level, setLevel, startDate, setStartDate, category, setCategory, cleanFile, setCleanFile,
    month, setMonth, scores, setScores, comments, setComments, submittedBy,
    monthsServed, isEligible, totalCriteria, scoredCount, heroScore,
  };
}

function ScoringBlock({ def, f }) {
  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <h3 className="font-semibold" style={{ color: COLORS.text, fontFamily: "Fraunces, serif" }}>
          Evaluation
        </h3>
        <span className="text-xs" style={{ color: COLORS.textFaint }}>
          {f.scoredCount}/{f.totalCriteria} scored
        </span>
        {def.foundations && (
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${COLORS.hero}26`, color: COLORS.hero }}>
            Total score: {f.heroScore}/{HERO_MAX_SCORE}
          </span>
        )}
      </div>
      <div className="space-y-3 mb-8">
        {def.foundations
          ? def.foundations.map((fo) => (
              <HeroFoundationGroup key={fo.key} foundation={fo} scores={f.scores} onChange={(key, v) => f.setScores((s) => ({ ...s, [key]: v }))} />
            ))
          : def.criteria.map((c) => (
              <RatingRow key={c} label={c} options={def.scale} value={f.scores[c]} onChange={(v) => f.setScores((s) => ({ ...s, [c]: v }))} />
            ))}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------- */
/*  Department Head submission form (Champion / Shining Star)              */
/* ---------------------------------------------------------------------- */

function DeptHeadForm({ awardType, profile, onBack, onSubmitted }) {
  const def = AWARD_TYPES[awardType];
  const f = useNominationFormState(def, { department: profile.department, submittedBy: profile.full_name });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = f.name.trim() && f.clockNo.trim() && f.position.trim() && f.startDate && f.cleanFile && f.scoredCount === f.totalCriteria;

  async function handleSubmit() {
    if (!canSubmit) {
      setError("Please complete every required field, the eligibility confirmation, and every criterion before submitting.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const record = {
        awardType,
        month: f.month,
        department: profile.department,
        nominee: { name: f.name, clockNo: f.clockNo, position: f.position, startDate: f.startDate },
        category: f.category || null,
        cleanFile: f.cleanFile,
        monthsServed: f.monthsServed,
        isEligible: f.isEligible,
        scores: f.scores,
        totalScore: null,
        comments: f.comments,
        nominatedBy: profile.full_name,
        status: "submitted",
      };
      const saved = await insertNomination(record);
      onSubmitted(saved);
    } catch (e) {
      setError(e.message || "Couldn't save this nomination. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm mb-6" style={{ color: COLORS.textMuted }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to tiers
      </button>

      <div className="flex items-center gap-3 mb-6">
        <TierBadge type={awardType} size="lg" />
        <div>
          <h2 className="text-xl font-semibold" style={{ color: COLORS.text, fontFamily: "Fraunces, serif" }}>
            {def.name}
          </h2>
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            {def.flow}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_auto] gap-6 mb-8">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nominee name *">
            <input value={f.name} onChange={(e) => f.setName(e.target.value)} style={inputStyle} placeholder="Full name" />
          </Field>
          <Field label="Clock No. *">
            <input value={f.clockNo} onChange={(e) => f.setClockNo(e.target.value)} style={inputStyle} placeholder="e.g. 10234" />
          </Field>
          <Field label="Department">
            <input value={profile.department} disabled style={readOnlyStyle} />
          </Field>
          <Field label="Position *">
            <input value={f.position} onChange={(e) => f.setPosition(e.target.value)} style={inputStyle} placeholder="e.g. Guest Service Agent" />
          </Field>
          <Field label="Start date *">
            <input type="date" value={f.startDate} onChange={(e) => f.setStartDate(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Award month">
            <input type="month" value={f.month} onChange={(e) => f.setMonth(e.target.value)} style={inputStyle} />
          </Field>
          {def.categories && (
            <Field label="Category">
              <select value={f.category} onChange={(e) => f.setCategory(e.target.value)} style={inputStyle}>
                {def.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Submitted by">
            <input value={profile.full_name} disabled style={readOnlyStyle} />
          </Field>
        </div>

        <div className="flex flex-col items-center justify-center p-4 rounded-2xl" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}`, minWidth: 168 }}>
          <EligibilityRing monthsServed={f.startDate ? f.monthsServed : 0} minMonths={def.minMonths} />
          <p className="text-xs text-center mt-2" style={{ color: f.isEligible ? COLORS.good : COLORS.gold }}>
            {def.minMonths === 0 ? "No minimum tenure" : f.isEligible ? "Tenure requirement met" : `Needs ${def.minMonths - f.monthsServed} more month(s)`}
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 p-4 rounded-xl mb-8 cursor-pointer" style={{ background: COLORS.panelAlt }}>
        <input type="checkbox" checked={f.cleanFile} onChange={(e) => f.setCleanFile(e.target.checked)} className="mt-0.5" />
        <span className="text-sm" style={{ color: COLORS.text }}>
          I confirm the nominee has a <strong>clean disciplinary file for the past {def.cleanFileMonths} months</strong>. (Required to submit.)
        </span>
      </label>

      <ScoringBlock def={def} f={f} />

      <Field label="Comments — what did they do above and beyond this month?">
        <textarea value={f.comments} onChange={(e) => f.setComments(e.target.value)} style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} placeholder="Be specific — P&C and the GM read this first." />
      </Field>

      {error && (
        <div className="flex items-center gap-2 mt-4 text-sm" style={{ color: COLORS.bad }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm" style={{ background: COLORS.gold, color: "#1A1406", opacity: saving ? 0.7 : 1 }}>
          {saving && <Loader2 size={15} className="animate-spin" />}
          Send to P&C
        </button>
      </div>
    </div>
  );
}

function AwardPicker({ types, onPick }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <div className="h-px flex-1" style={{ background: COLORS.hairline }} />
        <span className="text-xs uppercase tracking-[0.2em]" style={{ color: COLORS.textFaint }}>
          Choose the tier
        </span>
        <div className="h-px flex-1" style={{ background: COLORS.hairline }} />
      </div>
      <p className="text-center text-sm mb-8" style={{ color: COLORS.textMuted }}>
        Submit one nominee per tier for your department this month.
      </p>
      <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${types.length}, minmax(0,1fr))` }}>
        {types.map((key) => {
          const def = AWARD_TYPES[key];
          const Icon = def.icon;
          return (
            <button
              key={def.key}
              onClick={() => onPick(def.key)}
              className="text-left p-6 rounded-2xl transition-transform hover:-translate-y-1 focus:outline-none"
              style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}
            >
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-full mb-4" style={{ background: `${def.color}26`, color: def.color }}>
                <Icon size={20} />
              </span>
              <h3 className="font-semibold text-lg mb-1" style={{ color: COLORS.text, fontFamily: "Fraunces, serif" }}>
                {def.name}
              </h3>
              <p className="text-sm mb-4" style={{ color: COLORS.textMuted }}>
                {def.tagline}
              </p>
              <div className="text-xs space-y-1" style={{ color: COLORS.textFaint }}>
                <div>Eligibility: {def.minMonths > 0 ? `${def.minMonths}+ months of service` : "No minimum tenure"}, clean file {def.cleanFileMonths} months</div>
                <div>{def.flow}</div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-sm font-medium" style={{ color: def.color }}>
                Start nomination <ChevronRight size={15} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  General Manager — Hero of the Month (direct, self-finalizing)          */
/* ---------------------------------------------------------------------- */

function GmHeroForm({ month, profile, onCancel, onSubmitted }) {
  const def = AWARD_TYPES.hero;
  const f = useNominationFormState(def, { month, submittedBy: profile.full_name });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = f.name.trim() && f.clockNo.trim() && f.department.trim() && f.position.trim() && f.startDate && f.cleanFile && f.scoredCount === f.totalCriteria;

  async function handleSubmit() {
    if (!canSubmit) {
      setError("Please complete every required field, the eligibility confirmation, and every leadership foundation before finalizing.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const record = {
        awardType: "hero",
        month: f.month,
        department: f.department,
        nominee: { name: f.name, clockNo: f.clockNo, position: f.position, level: f.level, startDate: f.startDate },
        category: null,
        cleanFile: f.cleanFile,
        monthsServed: f.monthsServed,
        isEligible: f.isEligible,
        scores: f.scores,
        totalScore: f.heroScore,
        comments: f.comments,
        nominatedBy: profile.full_name,
        status: "winner",
        decidedAt: now,
        decidedBy: profile.full_name,
      };
      const saved = await insertNomination(record);
      onSubmitted(saved);
    } catch (e) {
      setError(e.message || "Couldn't save this nomination. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button onClick={onCancel} className="flex items-center gap-1 text-sm mb-6" style={{ color: COLORS.textMuted }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Cancel
      </button>

      <div className="flex items-center gap-3 mb-6">
        <TierBadge type="hero" size="lg" />
        <div>
          <h2 className="text-xl font-semibold" style={{ color: COLORS.text, fontFamily: "Fraunces, serif" }}>
            Hero of the Month — {formatMonthLabel(f.month)}
          </h2>
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            Chosen directly from the leadership pool: department heads, assistant managers, and level-3 supervisors.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_auto] gap-6 mb-8">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Candidate name *">
            <input value={f.name} onChange={(e) => f.setName(e.target.value)} style={inputStyle} placeholder="Full name" />
          </Field>
          <Field label="Clock No. *">
            <input value={f.clockNo} onChange={(e) => f.setClockNo(e.target.value)} style={inputStyle} placeholder="e.g. 10234" />
          </Field>
          <Field label="Department *">
            <input value={f.department} onChange={(e) => f.setDepartment(e.target.value)} style={inputStyle} placeholder="e.g. Front Office" />
          </Field>
          <Field label="Leadership level *">
            <select value={f.level} onChange={(e) => f.setLevel(e.target.value)} style={inputStyle}>
              {def.levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Position / title *">
            <input value={f.position} onChange={(e) => f.setPosition(e.target.value)} style={inputStyle} placeholder="e.g. Front Office Manager" />
          </Field>
          <Field label="Start date *">
            <input type="date" value={f.startDate} onChange={(e) => f.setStartDate(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Finalized by">
            <input value={profile.full_name} disabled style={readOnlyStyle} />
          </Field>
        </div>

        <div className="flex flex-col items-center justify-center p-4 rounded-2xl" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}`, minWidth: 168 }}>
          <EligibilityRing monthsServed={f.startDate ? f.monthsServed : 0} minMonths={def.minMonths} />
          <p className="text-xs text-center mt-2" style={{ color: f.isEligible ? COLORS.good : COLORS.gold }}>
            {f.isEligible ? "Tenure requirement met" : `Needs ${def.minMonths - f.monthsServed} more month(s)`}
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 p-4 rounded-xl mb-8 cursor-pointer" style={{ background: COLORS.panelAlt }}>
        <input type="checkbox" checked={f.cleanFile} onChange={(e) => f.setCleanFile(e.target.checked)} className="mt-0.5" />
        <span className="text-sm" style={{ color: COLORS.text }}>
          I confirm the candidate has a <strong>clean disciplinary file for the past {def.cleanFileMonths} months</strong>. (Required to finalize.)
        </span>
      </label>

      <ScoringBlock def={def} f={f} />

      <Field label="Comments">
        <textarea value={f.comments} onChange={(e) => f.setComments(e.target.value)} style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} placeholder="Why this candidate, this month." />
      </Field>

      {error && (
        <div className="flex items-center gap-2 mt-4 text-sm" style={{ color: COLORS.bad }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm" style={{ background: COLORS.hero, color: "#241205", opacity: saving ? 0.7 : 1 }}>
          {saving && <Loader2 size={15} className="animate-spin" />}
          Finalize as Hero of the Month
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  New Nomination tab — content depends on the logged-in profile's roles  */
/* ---------------------------------------------------------------------- */

function NewNominationTab({ profile, refresh }) {
  const [pickedAward, setPickedAward] = useState(null);
  const [showHeroForm, setShowHeroForm] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(null);

  const canDeptHead = profile.roles.includes("deptHead");
  const canGm = profile.roles.includes("gm");

  if (!canDeptHead && !canGm) {
    return <EmptyState icon={Send} title="No nomination permissions" body="Your account isn't set up to submit nominations. Contact P&C if this looks wrong." />;
  }

  if (justSubmitted) {
    const def = AWARD_TYPES[justSubmitted.awardType];
    const isHero = justSubmitted.awardType === "hero";
    return (
      <div className="flex flex-col items-center text-center py-16 px-6">
        <span className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: `${COLORS.good}22`, color: COLORS.good }}>
          <CheckCircle2 size={26} />
        </span>
        <h3 className="font-semibold text-lg mb-1" style={{ color: COLORS.text, fontFamily: "Fraunces, serif" }}>
          {isHero ? "Hero of the Month finalized" : "Sent to P&C"}
        </h3>
        <p className="text-sm max-w-sm mb-6" style={{ color: COLORS.textMuted }}>
          {justSubmitted.nominee.name} {isHero ? "is now this month's Hero of the Month." : `is now in the P&C queue for ${def.name}, ${formatMonthLabel(justSubmitted.month)}.`}
        </p>
        <button
          onClick={() => {
            setJustSubmitted(null);
            setPickedAward(null);
            setShowHeroForm(false);
          }}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: COLORS.gold, color: "#1A1406" }}
        >
          Submit another
        </button>
      </div>
    );
  }

  if (canDeptHead && pickedAward) {
    return (
      <DeptHeadForm
        awardType={pickedAward}
        profile={profile}
        onBack={() => setPickedAward(null)}
        onSubmitted={async (record) => {
          await refresh();
          setJustSubmitted(record);
        }}
      />
    );
  }

  if (canGm && showHeroForm) {
    return (
      <GmHeroForm
        month={currentMonthValue()}
        profile={profile}
        onCancel={() => setShowHeroForm(false)}
        onSubmitted={async (record) => {
          await refresh();
          setJustSubmitted(record);
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {canDeptHead && <AwardPicker types={["champion", "shiningStar"]} onPick={setPickedAward} />}
      {canGm && (
        <div className="flex flex-col items-center text-center py-10 px-6 rounded-2xl" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ background: `${COLORS.hero}26`, color: COLORS.hero }}>
            <Flame size={24} />
          </span>
          <h3 className="font-semibold text-lg mb-1" style={{ color: COLORS.text, fontFamily: "Fraunces, serif" }}>
            Hero of the Month is yours to give
          </h3>
          <p className="text-sm max-w-sm mb-6" style={{ color: COLORS.textMuted }}>
            Chosen directly from the leadership pool — no P&C step, no forwarding.
          </p>
          <button onClick={() => setShowHeroForm(true)} className="px-6 py-3 rounded-xl font-semibold text-sm" style={{ background: COLORS.hero, color: "#241205" }}>
            Nominate Hero of the Month
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Detail / row renderers (shared by P&C queue, GM selection, dashboard)   */
/* ---------------------------------------------------------------------- */

function InfoBit({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: COLORS.textFaint }}>
        {label}
      </div>
      <div style={{ color: COLORS.text, fontFamily: "IBM Plex Mono, monospace", fontSize: 12.5 }}>{value || "—"}</div>
    </div>
  );
}

function NominationDetail({ record }) {
  const def = AWARD_TYPES[record.awardType];
  return (
    <div className="px-5 pb-5 pt-1 space-y-4">
      {!record.isEligible && (
        <div className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg" style={{ background: `${COLORS.gold}1f`, color: COLORS.gold }}>
          <AlertTriangle size={14} /> Did not meet the {def.minMonths}-month tenure rule at submission ({record.monthsServed} months served).
        </div>
      )}
      <div className="grid sm:grid-cols-4 gap-3 text-xs">
        <InfoBit label="Clock No." value={record.nominee.clockNo} />
        <InfoBit label="Position" value={record.nominee.level ? `${record.nominee.position} (${record.nominee.level})` : record.nominee.position} />
        <InfoBit label="Start date" value={formatDate(record.nominee.startDate)} />
        <InfoBit label="Submitted by" value={record.nominatedBy} />
      </div>

      <div className="grid gap-3">
        {record.awardType === "hero"
          ? def.foundations.map((fo) => (
              <div key={fo.key} className="rounded-lg p-3" style={{ background: COLORS.panel }}>
                <div className="text-xs font-semibold mb-1.5" style={{ color: COLORS.goldSoft }}>
                  {fo.title}
                </div>
                <div className="space-y-1">
                  {fo.subs.map(([t], i) => {
                    const v = record.scores[heroSubKey(fo.key, i)];
                    return (
                      <div key={t} className="flex items-center justify-between gap-2">
                        <span className="text-xs" style={{ color: COLORS.text }}>
                          {t}
                        </span>
                        <span className="text-xs font-semibold whitespace-nowrap" style={{ color: COLORS.hero }}>
                          {v === 10 ? "Above (10)" : v === 5 ? "Meets (05)" : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          : def.criteria.map((c) => (
              <div key={c} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: COLORS.panel }}>
                <span className="text-sm" style={{ color: COLORS.text }}>
                  {c}
                </span>
                <span className="text-xs font-semibold" style={{ color: def.color }}>
                  {def.scale.find((s) => s.key === record.scores[c])?.label || "—"}
                </span>
              </div>
            ))}
      </div>

      {record.comments && (
        <div>
          <span className="block text-xs font-medium mb-1" style={{ color: COLORS.textFaint }}>
            Comments
          </span>
          <p className="text-sm p-3 rounded-lg" style={{ background: COLORS.panel, color: COLORS.text }}>
            {record.comments}
          </p>
        </div>
      )}

      <div className="text-xs space-y-0.5" style={{ color: COLORS.textFaint }}>
        <div>Submitted {formatDate(record.submittedAt)}</div>
        {record.forwardedAt && (
          <div>
            Forwarded to General Manager {formatDate(record.forwardedAt)} by {record.forwardedBy}
          </div>
        )}
        {record.decidedAt && (
          <div>
            {record.status === "winner" ? "Selected as winner" : "Not selected"} on {formatDate(record.decidedAt)} by {record.decidedBy}
          </div>
        )}
      </div>
    </div>
  );
}

function NominationRow({ record, expanded, onToggle, actions }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.hairline}` }}>
      <button className="w-full flex items-center gap-3 p-4 text-left" onClick={onToggle}>
        <TierBadge type={record.awardType} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: COLORS.text }}>
              {record.nominee.name}
            </span>
            <span className="text-xs" style={{ color: COLORS.textFaint }}>
              {record.department}
            </span>
          </div>
          <div className="text-xs" style={{ color: COLORS.textMuted }}>
            {AWARD_TYPES[record.awardType].name} · {formatMonthLabel(record.month)}
            {record.awardType === "hero" && record.totalScore != null ? ` · ${record.totalScore}/${HERO_MAX_SCORE}` : ""}
          </div>
        </div>
        <StatusPill status={record.status} />
        <ChevronDown size={16} style={{ color: COLORS.textFaint, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {expanded && (
        <>
          <NominationDetail record={record} />
          {actions && <div className="px-5 pb-5 flex gap-2 flex-wrap">{actions}</div>}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  P&C Queue — forward only, no review                                    */
/* ---------------------------------------------------------------------- */

function PncQueueView({ profile, nominations, refresh }) {
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [busyAll, setBusyAll] = useState(false);

  if (!profile.roles.includes("pnc")) {
    return <EmptyState icon={Send} title="P&C-only queue" body="Your account isn't set up to forward nominations to the General Manager." />;
  }

  const pending = nominations.filter((n) => n.status === "submitted");

  async function forwardOne(record) {
    setBusyId(record.id);
    try {
      await forwardNomination(record.id, profile.full_name);
      await refresh();
    } finally {
      setBusyId(null);
      setExpandedId(null);
    }
  }

  async function forwardAll() {
    setBusyAll(true);
    try {
      await forwardAllPending(profile.full_name);
      await refresh();
    } finally {
      setBusyAll(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <p className="text-xs" style={{ color: COLORS.textFaint }}>
          P&C collects and forwards nominations as submitted by Department Heads — no scoring or eligibility review happens at this stage.
        </p>
        {pending.length > 0 && (
          <button onClick={forwardAll} disabled={busyAll} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: COLORS.gold, color: "#1A1406", opacity: busyAll ? 0.7 : 1 }}>
            {busyAll && <Loader2 size={14} className="animate-spin" />}
            <Send size={14} /> Forward all pending ({pending.length})
          </button>
        )}
      </div>

      {pending.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nothing waiting to be forwarded" body="New Department Head submissions will appear here." />
      ) : (
        <div className="space-y-3">
          {pending.map((record) => (
            <NominationRow
              key={record.id}
              record={record}
              expanded={expandedId === record.id}
              onToggle={() => setExpandedId(expandedId === record.id ? null : record.id)}
              actions={
                <button
                  onClick={() => forwardOne(record)}
                  disabled={busyId === record.id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: COLORS.champion, color: "#0D1B2A" }}
                >
                  <Send size={14} /> Forward to General Manager
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  GM Selection — pick one winner per tier, per month                     */
/* ---------------------------------------------------------------------- */

function CandidatePanel({ def, month, candidates, decided, winner, onSelect, busyId }) {
  const Icon = def.icon;
  const [expandedId, setExpandedId] = useState(null);
  return (
    <div className="rounded-2xl p-5" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
      <div className="flex items-center gap-2 mb-4">
        <TierBadge type={def.key} />
        <h3 className="font-semibold" style={{ color: COLORS.text, fontFamily: "Fraunces, serif" }}>
          {def.name}
        </h3>
      </div>

      {winner ? (
        <div className="rounded-xl mb-3 overflow-hidden" style={{ background: `${COLORS.good}16`, border: `1px solid ${COLORS.good}55` }}>
          <button className="w-full text-left p-4" onClick={() => setExpandedId(expandedId === winner.id ? null : winner.id)}>
            <div className="flex items-center gap-2 text-xs font-semibold mb-1" style={{ color: COLORS.good }}>
              <CheckCircle2 size={14} /> Winner selected
              <ChevronDown size={13} style={{ marginLeft: "auto", transform: expandedId === winner.id ? "rotate(180deg)" : "none" }} />
            </div>
            <div className="font-semibold" style={{ color: COLORS.text }}>
              {winner.nominee.name}
            </div>
            <div className="text-xs" style={{ color: COLORS.textMuted }}>
              {winner.department} · decided by {winner.decidedBy} on {formatDate(winner.decidedAt)}
            </div>
          </button>
          {expandedId === winner.id && <NominationDetail record={winner} />}
        </div>
      ) : candidates.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: COLORS.textFaint }}>
          No candidates forwarded yet for {formatMonthLabel(month)}.
        </p>
      ) : (
        <div className="space-y-2.5">
          {candidates.map((c) => {
            const expanded = expandedId === c.id;
            return (
              <div key={c.id} className="rounded-xl overflow-hidden" style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.hairline}` }}>
                <button className="w-full text-left p-3" onClick={() => setExpandedId(expanded ? null : c.id)}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <ChevronDown size={14} style={{ color: COLORS.textFaint, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                      <div>
                        <div className="font-semibold text-sm" style={{ color: COLORS.text }}>
                          {c.nominee.name}
                        </div>
                        <div className="text-xs" style={{ color: COLORS.textMuted }}>
                          {c.department} · {c.nominee.position}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
                {expanded && <NominationDetail record={c} />}
                <div className="px-3 pb-3">
                  <button
                    onClick={() => onSelect(c)}
                    disabled={busyId === c.id}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: def.color, color: "#0D1B2A", opacity: busyId === c.id ? 0.6 : 1 }}
                  >
                    <Icon size={13} /> Select as winner
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {decided.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs cursor-pointer" style={{ color: COLORS.textFaint }}>
            {decided.length} not selected
          </summary>
          <div className="mt-2 space-y-1.5">
            {decided.map((c) => {
              const expanded = expandedId === c.id;
              return (
                <div key={c.id} className="rounded-lg overflow-hidden" style={{ background: COLORS.panelAlt }}>
                  <button className="w-full text-left text-xs px-3 py-2 flex justify-between items-center" style={{ color: COLORS.textMuted }} onClick={() => setExpandedId(expanded ? null : c.id)}>
                    <span>{c.nominee.name}</span>
                    <span>{c.department}</span>
                  </button>
                  {expanded && <NominationDetail record={c} />}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

function GmSelectionView({ profile, nominations, refresh }) {
  const [busyId, setBusyId] = useState(null);
  const [monthFilter, setMonthFilter] = useState(currentMonthValue());
  const [showHeroForm, setShowHeroForm] = useState(false);

  const months = useMemo(() => {
    const set = new Set(nominations.map((n) => n.month));
    set.add(currentMonthValue());
    return Array.from(set).sort().reverse();
  }, [nominations]);

  if (!profile.roles.includes("gm")) {
    return <EmptyState icon={Crown} title="General Manager only" body="Your account isn't set up to select monthly winners or finalize Hero of the Month." />;
  }

  async function handleSelect(record) {
    setBusyId(record.id);
    try {
      await selectWinner(record, profile.full_name);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const heroThisMonth = nominations.find((n) => n.awardType === "hero" && n.month === monthFilter);

  const panelData = ["champion", "shiningStar"].map((key) => ({
    def: AWARD_TYPES[key],
    candidates: nominations.filter((n) => n.awardType === key && n.month === monthFilter && n.status === "with_gm"),
    decided: nominations.filter((n) => n.awardType === key && n.month === monthFilter && n.status === "not_selected"),
    winner: nominations.find((n) => n.awardType === key && n.month === monthFilter && n.status === "winner"),
  }));

  return (
    <div>
      <div className="flex items-end gap-3 flex-wrap mb-6">
        <Field label="Month">
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-6">
        {panelData.map((p) => (
          <CandidatePanel key={p.def.key} def={p.def} month={monthFilter} candidates={p.candidates} decided={p.decided} winner={p.winner} onSelect={handleSelect} busyId={busyId} />
        ))}
      </div>

      <div className="rounded-2xl p-5" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
        <div className="flex items-center gap-2 mb-3">
          <TierBadge type="hero" />
          <h3 className="font-semibold" style={{ color: COLORS.text, fontFamily: "Fraunces, serif" }}>
            Hero of the Month
          </h3>
        </div>
        {showHeroForm ? (
          <GmHeroForm
            month={monthFilter}
            profile={profile}
            onCancel={() => setShowHeroForm(false)}
            onSubmitted={async () => {
              await refresh();
              setShowHeroForm(false);
            }}
          />
        ) : heroThisMonth ? (
          <div className="p-4 rounded-xl" style={{ background: `${COLORS.good}16`, border: `1px solid ${COLORS.good}55` }}>
            <div className="font-semibold" style={{ color: COLORS.text }}>
              {heroThisMonth.nominee.name}
            </div>
            <div className="text-xs" style={{ color: COLORS.textMuted }}>
              {heroThisMonth.nominee.level} · {heroThisMonth.department} · {heroThisMonth.totalScore}/{HERO_MAX_SCORE} · finalized by {heroThisMonth.decidedBy}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm" style={{ color: COLORS.textMuted }}>
              No Hero of the Month finalized yet for {formatMonthLabel(monthFilter)}.
            </p>
            <button onClick={() => setShowHeroForm(true)} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: COLORS.hero, color: "#241205" }}>
              Nominate Hero of the Month
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Dashboard / archive                                                     */
/* ---------------------------------------------------------------------- */

function StatCard({ label, value, color }) {
  return (
    <div className="p-4 rounded-xl flex-1 min-w-[120px]" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
      <div className="text-2xl font-semibold" style={{ color: color || COLORS.text, fontFamily: "IBM Plex Mono, monospace" }}>
        {value}
      </div>
      <div className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
        {label}
      </div>
    </div>
  );
}

function DashboardView({ nominations }) {
  const [monthFilter, setMonthFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const months = useMemo(() => Array.from(new Set(nominations.map((n) => n.month))).sort().reverse(), [nominations]);

  const filtered = nominations
    .filter((n) => (monthFilter === "all" ? true : n.month === monthFilter))
    .filter((n) => (typeFilter === "all" ? true : n.awardType === typeFilter))
    .filter((n) => (statusFilter === "all" ? true : n.status === statusFilter))
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  const totals = {
    all: nominations.length,
    submitted: nominations.filter((n) => n.status === "submitted").length,
    with_gm: nominations.filter((n) => n.status === "with_gm").length,
    winner: nominations.filter((n) => n.status === "winner").length,
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <StatCard label="Total nominations" value={totals.all} />
        <StatCard label="Awaiting P&C" value={totals.submitted} color={COLORS.gold} />
        <StatCard label="With General Manager" value={totals.with_gm} color={COLORS.champion} />
        <StatCard label="Winners" value={totals.winner} color={COLORS.good} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="all">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="all">All tiers</option>
          {Object.values(AWARD_TYPES).map((d) => (
            <option key={d.key} value={d.key}>
              {d.name}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="all">All statuses</option>
          <option value="submitted">Awaiting P&C</option>
          <option value="with_gm">With General Manager</option>
          <option value="winner">Winner</option>
          <option value="not_selected">Not Selected</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Sparkles} title="No nominations yet" body="Submit one from the New Nomination tab to see it appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => (
            <NominationRow key={record.id} record={record} expanded={expandedId === record.id} onToggle={() => setExpandedId(expandedId === record.id ? null : record.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Signed-in shell                                                         */
/* ---------------------------------------------------------------------- */

function MainApp({ profile, onSignOut }) {
  const [tab, setTab] = useState("new");
  const [nominations, setNominations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const rows = await fetchNominations();
      setNominations(rows);
    } catch (e) {
      setLoadError(e.message || "Couldn't load nominations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const pncBadge = profile.roles.includes("pnc") ? nominations.filter((n) => n.status === "submitted").length : 0;
  const gmBadge = profile.roles.includes("gm") ? nominations.filter((n) => n.status === "with_gm").length : 0;

    const canSeeDashboard = profile.roles.includes("pnc") || profile.roles.includes("gm");

  const tabs = [
    { key: "new", label: "New Nomination", icon: PlusCircle },
    { key: "pnc", label: "P&C Queue", icon: Send, badge: pncBadge },
    { key: "gm", label: "GM Selection", icon: Crown, badge: gmBadge },
    ...(canSeeDashboard ? [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }] : []),
  ];
  
  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh" }}>
      <div className="max-w-5xl mx-auto rounded-2xl overflow-hidden" style={{ background: COLORS.bg }}>
        {/* Header */}
        <div className="px-6 pt-6 pb-5" style={{ borderBottom: `1px solid ${COLORS.hairline}` }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.hero})` }}>
                <Sparkles size={18} color="#1A1406" />
              </span>
              <div>
                <h1 className="text-lg font-semibold leading-tight" style={{ color: COLORS.text, fontFamily: "Fraunces, serif" }}>
                  Circle of Excellence
                </h1>
                <p className="text-xs" style={{ color: COLORS.textFaint }}>
                  {profile.full_name} · {profile.department} · {profile.roles.join(" + ")}
                </p>
              </div>
            </div>
            <button onClick={onSignOut} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium" style={{ color: COLORS.textMuted, border: `1px solid ${COLORS.hairline}` }}>
              <LogOut size={13} /> Sign out
            </button>
          </div>

          <div className="flex gap-1 mt-5 flex-wrap">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="relative flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium"
                  style={active ? { background: COLORS.panel, color: COLORS.text, borderBottom: `2px solid ${COLORS.gold}` } : { color: COLORS.textMuted, borderBottom: "2px solid transparent" }}
                >
                  <Icon size={15} /> {t.label}
                  {!!t.badge && (
                    <span className="ml-1 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center" style={{ background: COLORS.gold, color: "#1A1406" }}>
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="p-6" style={{ background: COLORS.bg, minHeight: 420 }}>
          {loading ? (
            <div className="flex items-center justify-center py-24" style={{ color: COLORS.textFaint }}>
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : loadError ? (
            <EmptyState icon={AlertTriangle} title="Couldn't load data" body={loadError} />
          ) : tab === "new" ? (
            <NewNominationTab profile={profile} refresh={loadData} />
          ) : tab === "pnc" ? (
            <PncQueueView profile={profile} nominations={nominations} refresh={loadData} />
          ) : tab === "gm" ? (
            <GmSelectionView profile={profile} nominations={nominations} refresh={loadData} />
                    ) : canSeeDashboard ? (
            <DashboardView nominations={nominations} />
          ) : (
            <EmptyState icon={LayoutDashboard} title="Not available" body="This view isn't part of your role." />
          )}
        </div>

        <div className="px-6 py-3 text-[11px] flex items-center gap-1.5" style={{ borderTop: `1px solid ${COLORS.hairline}`, color: COLORS.textFaint }}>
          <Clock size={11} /> Connected to your organization's live database.
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Root — auth + profile loading                                          */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    setProfileError("");
    fetchMyProfile(session.user.id)
      .then(setProfile)
      .catch((e) => setProfileError(e.message || "No profile found for this account."));
  }, [session]);

  if (authLoading) {
    return (
      <div style={{ background: COLORS.bg, minHeight: "100vh" }} className="flex items-center justify-center">
        <Loader2 size={22} className="animate-spin" style={{ color: COLORS.textFaint }} />
      </div>
    );
  }

  if (!session) return <Login />;

  if (profileError) {
    return (
      <div style={{ background: COLORS.bg, minHeight: "100vh" }} className="flex items-center justify-center px-6">
        <EmptyState icon={AlertTriangle} title="Account not fully set up" body={`${profileError} Contact P&C to link this account to a department and role.`} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ background: COLORS.bg, minHeight: "100vh" }} className="flex items-center justify-center">
        <Loader2 size={22} className="animate-spin" style={{ color: COLORS.textFaint }} />
      </div>
    );
  }

  return <MainApp profile={profile} onSignOut={() => supabase.auth.signOut()} />;
}
