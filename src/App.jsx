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
  Users,
  Trophy,
  Printer,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import {
  fetchNominations,
  fetchMyProfile,
  insertNomination,
  forwardNomination,
  forwardAllPending,
  selectWinner,
  finalizeChampionSelections,
  finalizeYearAwards,
  clearYearAward,
  reopenMonth,
  deleteNomination,
  uploadNominationPhoto,
} from "./db";
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
  runner_up: { label: "Runner-up", bg: "rgba(165,131,214,0.18)", fg: COLORS.shiningStar },
  not_selected: { label: "Not Selected", bg: "rgba(108,116,150,0.16)", fg: COLORS.textFaint },
};

const DIVISION_LABEL = { foh: "Front of the House", boh: "Back of the House" };

const CHAMPION_SLOTS = [
  { key: "foh_winner", division: "foh", rank: "winner", label: "Front of the House — Winner" },
  { key: "foh_runner_up", division: "foh", rank: "runner_up", label: "Front of the House — Runner-up" },
  { key: "boh_winner", division: "boh", rank: "winner", label: "Back of the House — Winner" },
  { key: "boh_runner_up", division: "boh", rank: "runner_up", label: "Back of the House — Runner-up" },
];

const YEAR_CHAMPION_SLOTS = [
  { key: "foh_winner", division: "foh", rank: "winner", label: "Champion of the Year — Front of the House (Winner)" },
  { key: "foh_runner_up", division: "foh", rank: "runner_up", label: "Champion of the Year — Front of the House (Runner-up)" },
  { key: "boh_winner", division: "boh", rank: "winner", label: "Champion of the Year — Back of the House (Winner)" },
  { key: "boh_runner_up", division: "boh", rank: "runner_up", label: "Champion of the Year — Back of the House (Runner-up)" },
];

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

// Builds a specific label for a yearly award badge, e.g. "Champion of the
// Year — Front of the House (Winner)" instead of just "Year Winner".
function yearAwardLabel(record) {
  if (!record.yearAward) return null;
  const rank = record.yearAward === "winner" ? "Winner" : "Runner-up";
  if (record.awardType === "champion") {
    return `Champion of the Year — ${DIVISION_LABEL[record.division] || ""} (${rank})`;
  }
  if (record.awardType === "shiningStar") {
    return "Shining Star of the Year";
  }
  if (record.awardType === "hero") {
    return "Hero of the Year";
  }
  return `Year ${rank}`;
}

// Has this person (by Clock No.) already won any award this calendar year?
// Used to warn the General Manager before picking a repeat winner.
function findPriorWinInYear(nominations, clockNo, year, excludeId) {
  if (!clockNo || !nominations) return null;
  return nominations.find(
    (n) =>
      n.nominee.clockNo === clockNo &&
      n.status === "winner" &&
      n.id !== excludeId &&
      n.month &&
      n.month.startsWith(year)
  );
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

function GmHeroForm({ month, profile, onCancel, onSubmitted, allNominations }) {
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
    const year = f.month.slice(0, 4);
    const prior = findPriorWinInYear(allNominations, f.clockNo.trim(), year, null);
    if (prior) {
      const ok = window.confirm(
        `${f.name} already won ${AWARD_TYPES[prior.awardType].name} in ${formatMonthLabel(prior.month)} this year.\n\nSelect them again anyway?`
      );
      if (!ok) return;
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
          <Field label="Award month">
            <input type="month" value={f.month} onChange={(e) => f.setMonth(e.target.value)} style={inputStyle} />
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

function NewNominationTab({ profile, nominations, refresh }) {
  const [pickedAward, setPickedAward] = useState(null);
  const [justSubmitted, setJustSubmitted] = useState(null);

  const canDeptHead = profile.roles.includes("deptHead");

  if (!canDeptHead) {
    return <EmptyState icon={Send} title="No nomination permissions" body="Your account isn't set up to submit nominations. Contact P&C if this looks wrong." />;
  }

  if (justSubmitted) {
    const def = AWARD_TYPES[justSubmitted.awardType];
    return (
      <div className="flex flex-col items-center text-center py-16 px-6">
        <span className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: `${COLORS.good}22`, color: COLORS.good }}>
          <CheckCircle2 size={26} />
        </span>
        <h3 className="font-semibold text-lg mb-1" style={{ color: COLORS.text, fontFamily: "Fraunces, serif" }}>
          Sent to P&C
        </h3>
        <p className="text-sm max-w-sm mb-6" style={{ color: COLORS.textMuted }}>
          {justSubmitted.nominee.name} is now in the P&C queue for {def.name}, {formatMonthLabel(justSubmitted.month)}.
        </p>
        <button
          onClick={() => {
            setJustSubmitted(null);
            setPickedAward(null);
          }}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: COLORS.gold, color: "#1A1406" }}
        >
          Submit another
        </button>
      </div>
    );
  }

  if (pickedAward) {
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

  return (
    <div className="space-y-8">
      <AwardPicker types={["champion", "shiningStar"]} onPick={setPickedAward} />
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

function PhotoBlock({ record, profile, onUpload }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const canUpload = profile?.roles?.includes("pnc");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      await onUpload(record.id, file);
    } catch (err) {
      setError(err.message || "Couldn't upload photo.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (!record.photoUrl && !canUpload) return null;

  return (
    <div className="flex items-center gap-3">
      <Avatar photoUrl={record.photoUrl} size={56} />
      {canUpload && (
        <label className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: COLORS.panelAlt, color: COLORS.text, border: `1px solid ${COLORS.hairline}` }}>
          {uploading ? "Uploading..." : record.photoUrl ? "Replace photo" : "Upload photo"}
          <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="hidden" />
        </label>
      )}
      {error && (
        <span className="text-xs" style={{ color: COLORS.bad }}>
          {error}
        </span>
      )}
    </div>
  );
}

function NominationDetail({ record, profile, onPhotoUpload }) {
  const def = AWARD_TYPES[record.awardType];
  return (
    <div className="px-5 pb-5 pt-1 space-y-4">
      <PhotoBlock record={record} profile={profile} onUpload={onPhotoUpload} />
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
            {record.status === "winner"
              ? `Selected as winner${record.division ? ` (${DIVISION_LABEL[record.division]})` : ""}`
              : record.status === "runner_up"
              ? `Selected as runner-up${record.division ? ` (${DIVISION_LABEL[record.division]})` : ""}`
              : "Not selected"}{" "}
            on {formatDate(record.decidedAt)} by {record.decidedBy}
          </div>
        )}
      </div>
    </div>
  );
}

function NominationRow({ record, expanded, onToggle, actions, profile, onPhotoUpload }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.hairline}` }}>
      <button className="w-full flex items-center gap-3 p-4 text-left" onClick={onToggle}>
        <TierBadge type={record.awardType} />
        <Avatar photoUrl={record.photoUrl} />
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
            {record.division ? ` · ${DIVISION_LABEL[record.division]}` : ""}
            {record.awardType === "hero" && record.totalScore != null ? ` · ${record.totalScore}/${HERO_MAX_SCORE}` : ""}
          </div>
        </div>
        <StatusPill status={record.status} />
        {record.yearAward && (
          <span
            className="text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap flex items-center gap-1"
            style={{ background: `${COLORS.gold}26`, color: COLORS.gold }}
          >
            <Trophy size={10} /> {yearAwardLabel(record)}
          </span>
        )}
        <ChevronDown size={16} style={{ color: COLORS.textFaint, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {expanded && (
        <>
          <NominationDetail record={record} profile={profile} onPhotoUpload={onPhotoUpload} />
          {actions && <div className="px-5 pb-5 flex gap-2 flex-wrap">{actions}</div>}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  P&C Queue — forward only, no review                                    */
/* ---------------------------------------------------------------------- */

function PncQueueView({ profile, nominations, refresh, onPhotoUpload }) {
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [busyAll, setBusyAll] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectError, setRejectError] = useState("");

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

  async function handleReject(record) {
    const ok = window.confirm(
      `Reject and delete ${record.nominee.name}'s nomination?\n\nThis removes it completely — the Department Head will need to submit a new one. This cannot be undone.`
    );
    if (!ok) return;
    setRejectingId(record.id);
    setRejectError("");
    try {
      await deleteNomination(record.id);
      await refresh();
    } catch (e) {
      setRejectError(e.message || "Couldn't reject this nomination. Please try again.");
    } finally {
      setRejectingId(null);
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

      {rejectError && (
        <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: COLORS.bad }}>
          <AlertTriangle size={15} /> {rejectError}
        </div>
      )}

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
              profile={profile}
              onPhotoUpload={onPhotoUpload}
              actions={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => forwardOne(record)}
                    disabled={busyId === record.id || rejectingId === record.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: COLORS.champion, color: "#0D1B2A" }}
                  >
                    <Send size={14} /> Forward to General Manager
                  </button>
                  <button
                    onClick={() => handleReject(record)}
                    disabled={busyId === record.id || rejectingId === record.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: `${COLORS.bad}1A`, color: COLORS.bad, opacity: rejectingId === record.id ? 0.6 : 1 }}
                  >
                    <XCircle size={14} /> {rejectingId === record.id ? "Rejecting…" : "Reject"}
                  </button>
                </div>
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

function PhotoLightbox({ photoUrl, onClose }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.8)", zIndex: 1000 }}
      onClick={onClose}
    >
      <img
        src={photoUrl}
        alt=""
        className="rounded-2xl"
        style={{ maxWidth: "min(90vw, 480px)", maxHeight: "85vh", objectFit: "contain", border: `1px solid ${COLORS.hairline}` }}
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
        style={{ background: COLORS.panel, color: COLORS.text }}
      >
        <XCircle size={20} />
      </button>
    </div>
  );
}

function Avatar({ photoUrl, size = 32 }) {
  const [open, setOpen] = useState(false);
  if (!photoUrl) {
    return (
      <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: size, height: size, background: COLORS.panel, color: COLORS.textFaint }}>
        <Users size={size * 0.5} />
      </div>
    );
  }
  return (
    <>
      <img
        src={photoUrl}
        alt=""
        className="rounded-full object-cover shrink-0 cursor-pointer"
        style={{ width: size, height: size, border: `1px solid ${COLORS.hairline}` }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      />
      {open && <PhotoLightbox photoUrl={photoUrl} onClose={() => setOpen(false)} />}
    </>
  );
}

function ChampionSelectionPanel({ month, candidates, decided, finalized, onFinalize, busy, onReopen, reopening }) {
  const [assignments, setAssignments] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  if (finalized.length > 0) {
    return (
      <div>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          {CHAMPION_SLOTS.map((slot) => {
            const person = finalized.find((f) => f.status === slot.rank && f.division === slot.division);
            const expanded = person && expandedId === person.id;
            return (
              <div key={slot.key} className="rounded-xl overflow-hidden" style={{ background: `${COLORS.good}16`, border: `1px solid ${COLORS.good}55` }}>
                <button
                  className="w-full text-left p-3"
                  disabled={!person}
                  onClick={() => person && setExpandedId(expanded ? null : person.id)}
                >
                  <div className="text-[11px] font-semibold mb-1" style={{ color: COLORS.good }}>
                    {slot.label}
                  </div>
                  {person ? (
                    <>
                      <div className="font-semibold text-sm" style={{ color: COLORS.text }}>
                        {person.nominee.name}
                      </div>
                      <div className="text-xs" style={{ color: COLORS.textMuted }}>
                        {person.department}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs" style={{ color: COLORS.textFaint }}>
                      Not assigned
                    </div>
                  )}
                </button>
                {expanded && <NominationDetail record={person} />}
              </div>
            );
          })}
        </div>
        {decided.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs cursor-pointer" style={{ color: COLORS.textFaint }}>
              {decided.length} not selected
            </summary>
            <div className="mt-2 space-y-1.5">
              {decided.map((c) => {
                const expanded = expandedId === c.id;
                return (
                  <div key={c.id} className="rounded-lg overflow-hidden" style={{ background: COLORS.panelAlt }}>
                    <button
                      className="w-full text-left text-xs px-3 py-2 flex justify-between items-center"
                      style={{ color: COLORS.textMuted }}
                      onClick={() => setExpandedId(expanded ? null : c.id)}
                    >
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
        <button
          onClick={onReopen}
          disabled={reopening}
          className="text-xs font-medium underline mt-3"
          style={{ color: COLORS.textFaint, opacity: reopening ? 0.5 : 1 }}
        >
          {reopening ? "Reopening…" : "Reopen this month's decision"}
        </button>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <p className="text-sm py-6 text-center" style={{ color: COLORS.textFaint }}>
        No candidates forwarded yet for {formatMonthLabel(month)}.
      </p>
    );
  }

  const usedIds = new Set(Object.values(assignments).filter(Boolean));
  const canFinalize = Object.values(assignments).some(Boolean);

  function optionsFor(slotKey) {
    return candidates.filter((c) => !usedIds.has(c.id) || assignments[slotKey] === c.id);
  }

  return (
    <div>
      <p className="text-xs mb-3" style={{ color: COLORS.textFaint }}>
        Decide which nominees are Front of the House (guest-facing) and which are Back of the House, then assign a Winner and a Runner-up in each.
      </p>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        {CHAMPION_SLOTS.map((slot) => (
          <div key={slot.key} className="rounded-xl p-3" style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.hairline}` }}>
            <div className="text-[11px] font-semibold mb-2" style={{ color: COLORS.goldSoft }}>
              {slot.label}
            </div>
            <select
              value={assignments[slot.key] || ""}
              onChange={(e) => setAssignments((a) => ({ ...a, [slot.key]: e.target.value || undefined }))}
              style={inputStyle}
            >
              <option value="">— none —</option>
              {optionsFor(slot.key).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nominee.name} — {c.department}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="space-y-2.5 mb-4">
        {candidates.map((c) => {
          const expanded = expandedId === c.id;
          return (
            <div key={c.id} className="rounded-xl overflow-hidden" style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.hairline}` }}>
              <button className="w-full text-left p-3 flex items-center justify-between gap-3" onClick={() => setExpandedId(expanded ? null : c.id)}>
                <div className="flex items-center gap-2">
                  <ChevronDown size={14} style={{ color: COLORS.textFaint, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                  <Avatar photoUrl={c.photoUrl} />
                  <div>
                    <div className="font-semibold text-sm" style={{ color: COLORS.text }}>
                      {c.nominee.name}
                    </div>
                    <div className="text-xs" style={{ color: COLORS.textMuted }}>
                      {c.department} · {c.nominee.position}
                    </div>
                  </div>
                </div>
                {usedIds.has(c.id) && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={{ background: `${COLORS.gold}26`, color: COLORS.gold }}>
                    Assigned
                  </span>
                )}
              </button>
              {expanded && <NominationDetail record={c} />}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => onFinalize(assignments)}
        disabled={!canFinalize || busy}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: COLORS.gold, color: "#1A1406", opacity: !canFinalize || busy ? 0.6 : 1 }}
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        Finalize Champion of the Month
      </button>
    </div>
  );
}

function CandidatePanel({ def, month, candidates, decided, winner, onSelect, busyId, onReopen, reopening }) {
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
          <div className="px-4 pb-3">
            <button
              onClick={onReopen}
              disabled={reopening}
              className="text-xs font-medium underline"
              style={{ color: COLORS.textFaint, opacity: reopening ? 0.5 : 1 }}
            >
              {reopening ? "Reopening…" : "Reopen this month's decision"}
            </button>
          </div>
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
                      <Avatar photoUrl={c.photoUrl} />
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
  const [championBusy, setChampionBusy] = useState(false);
  const [reopeningChampion, setReopeningChampion] = useState(false);
  const [reopeningShiningStar, setReopeningShiningStar] = useState(false);
  const [heroDeleting, setHeroDeleting] = useState(false);
  const [heroDeleteError, setHeroDeleteError] = useState("");
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
    const year = monthFilter.slice(0, 4);
    const prior = findPriorWinInYear(nominations, record.nominee.clockNo, year, record.id);
    if (prior) {
      const ok = window.confirm(
        `${record.nominee.name} already won ${AWARD_TYPES[prior.awardType].name} in ${formatMonthLabel(prior.month)} this year.\n\nSelect them again anyway?`
      );
      if (!ok) return;
    }
    setBusyId(record.id);
    try {
      await selectWinner(record, profile.full_name);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleFinalizeChampion(assignments) {
    const year = monthFilter.slice(0, 4);
    const list = CHAMPION_SLOTS.filter((slot) => assignments[slot.key]).map((slot) => ({
      id: assignments[slot.key],
      division: slot.division,
      rank: slot.rank,
    }));

    const warnings = [];
    for (const item of list) {
      const candidate = championCandidates.find((c) => c.id === item.id);
      if (!candidate) continue;
      const prior = findPriorWinInYear(nominations, candidate.nominee.clockNo, year, candidate.id);
      if (prior) {
        warnings.push(`${candidate.nominee.name} already won ${AWARD_TYPES[prior.awardType].name} in ${formatMonthLabel(prior.month)}`);
      }
    }
    if (warnings.length > 0) {
      const ok = window.confirm(`${warnings.join("\n")}\n\nContinue anyway?`);
      if (!ok) return;
    }

    setChampionBusy(true);
    try {
      await finalizeChampionSelections(monthFilter, list, profile.full_name);
      await refresh();
    } finally {
      setChampionBusy(false);
    }
  }

  async function handleReopenChampion() {
    setReopeningChampion(true);
    try {
      await reopenMonth("champion", monthFilter, profile.full_name);
      await refresh();
    } finally {
      setReopeningChampion(false);
    }
  }

  async function handleReopenShiningStar() {
    setReopeningShiningStar(true);
    try {
      await reopenMonth("shiningStar", monthFilter, profile.full_name);
      await refresh();
    } finally {
      setReopeningShiningStar(false);
    }
  }

  async function handleDeleteHero(id) {
    setHeroDeleting(true);
    setHeroDeleteError("");
    try {
      await deleteNomination(id);
      await refresh();
    } catch (e) {
      setHeroDeleteError(e.message || "Couldn't remove this entry. Please try again.");
    } finally {
      setHeroDeleting(false);
    }
  }

  const heroThisMonth = nominations.find((n) => n.awardType === "hero" && n.month === monthFilter);

  const championCandidates = nominations.filter((n) => n.awardType === "champion" && n.month === monthFilter && n.status === "with_gm");
  const championFinalized = nominations.filter((n) => n.awardType === "champion" && n.month === monthFilter && (n.status === "winner" || n.status === "runner_up"));
  const championNotSelected = nominations.filter((n) => n.awardType === "champion" && n.month === monthFilter && n.status === "not_selected");

  const shiningStar = {
    def: AWARD_TYPES.shiningStar,
    candidates: nominations.filter((n) => n.awardType === "shiningStar" && n.month === monthFilter && n.status === "with_gm"),
    decided: nominations.filter((n) => n.awardType === "shiningStar" && n.month === monthFilter && n.status === "not_selected"),
    winner: nominations.find((n) => n.awardType === "shiningStar" && n.month === monthFilter && n.status === "winner"),
  };

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
        <div className="rounded-2xl p-5" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
          <div className="flex items-center gap-2 mb-4">
            <TierBadge type="champion" />
            <h3 className="font-semibold" style={{ color: COLORS.text, fontFamily: "Fraunces, serif" }}>
              {AWARD_TYPES.champion.name}
            </h3>
          </div>
          <ChampionSelectionPanel
            month={monthFilter}
            candidates={championCandidates}
            decided={championNotSelected}
            finalized={championFinalized}
            onFinalize={handleFinalizeChampion}
            busy={championBusy}
            onReopen={handleReopenChampion}
            reopening={reopeningChampion}
          />
        </div>

        <CandidatePanel
          def={shiningStar.def}
          month={monthFilter}
          candidates={shiningStar.candidates}
          decided={shiningStar.decided}
          winner={shiningStar.winner}
          onSelect={handleSelect}
          busyId={busyId}
          onReopen={handleReopenShiningStar}
          reopening={reopeningShiningStar}
        />
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
            allNominations={nominations}
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
            <div className="text-xs mb-2" style={{ color: COLORS.textMuted }}>
              {heroThisMonth.nominee.level} · {heroThisMonth.department} · {heroThisMonth.totalScore}/{HERO_MAX_SCORE} · finalized by {heroThisMonth.decidedBy}
            </div>
            <button
              onClick={() => handleDeleteHero(heroThisMonth.id)}
              disabled={heroDeleting}
              className="text-xs font-medium underline"
              style={{ color: COLORS.textFaint, opacity: heroDeleting ? 0.5 : 1 }}
            >
              {heroDeleting ? "Removing…" : "Remove & re-nominate"}
            </button>
            {heroDeleteError && (
              <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: COLORS.bad }}>
                <AlertTriangle size={12} /> {heroDeleteError}
              </div>
            )}
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
/*  Award of the Year — GM picks winners across a whole year                */
/* ---------------------------------------------------------------------- */

function AwardOfYearChampionPanel({ year, candidates, finalized, onFinalize, busy, onClear, clearingId }) {
  const [assignments, setAssignments] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  if (finalized.length > 0) {
    return (
      <div>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          {YEAR_CHAMPION_SLOTS.map((slot) => {
            const person = finalized.find((f) => f.yearAward === slot.rank && f.division === slot.division);
            const expanded = person && expandedId === person.id;
            return (
              <div key={slot.key} className="rounded-xl overflow-hidden" style={{ background: `${COLORS.good}16`, border: `1px solid ${COLORS.good}55` }}>
                <button className="w-full text-left p-3" disabled={!person} onClick={() => person && setExpandedId(expanded ? null : person.id)}>
                  <div className="text-[11px] font-semibold mb-1" style={{ color: COLORS.good }}>
                    {slot.label}
                  </div>
                  {person ? (
                    <>
                      <div className="font-semibold text-sm" style={{ color: COLORS.text }}>
                        {person.nominee.name}
                      </div>
                      <div className="text-xs" style={{ color: COLORS.textMuted }}>
                        {person.department} · won {formatMonthLabel(person.month)}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs" style={{ color: COLORS.textFaint }}>
                      Not assigned
                    </div>
                  )}
                </button>
                {expanded && <NominationDetail record={person} />}
                {person && (
                  <div className="px-3 pb-3">
                    <button
                      onClick={() => onClear(person.id)}
                      disabled={clearingId === person.id}
                      className="text-xs font-medium underline"
                      style={{ color: COLORS.textFaint, opacity: clearingId === person.id ? 0.5 : 1 }}
                    >
                      {clearingId === person.id ? "Changing…" : "Change selection"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <p className="text-sm py-6 text-center" style={{ color: COLORS.textFaint }}>
        No Champion of the Month winners or runners-up recorded yet for {year}.
      </p>
    );
  }

  const usedIds = new Set(Object.values(assignments).filter(Boolean));
  const canFinalize = Object.values(assignments).some(Boolean);

  function optionsFor(slot) {
    return candidates.filter((c) => c.division === slot.division && (!usedIds.has(c.id) || assignments[slot.key] === c.id));
  }

  return (
    <div>
      <p className="text-xs mb-3" style={{ color: COLORS.textFaint }}>
        Pick from everyone who was a monthly Champion Winner in {year} — Front of the House and Back of the House are judged separately.
      </p>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        {YEAR_CHAMPION_SLOTS.map((slot) => (
          <div key={slot.key} className="rounded-xl p-3" style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.hairline}` }}>
            <div className="text-[11px] font-semibold mb-2" style={{ color: COLORS.goldSoft }}>
              {slot.label}
            </div>
            <select
              value={assignments[slot.key] || ""}
              onChange={(e) => setAssignments((a) => ({ ...a, [slot.key]: e.target.value || undefined }))}
              style={inputStyle}
            >
              <option value="">— none —</option>
              {optionsFor(slot).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nominee.name} — {c.department} ({formatMonthLabel(c.month)})
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="space-y-2.5 mb-4">
        {candidates.map((c) => {
          const expanded = expandedId === c.id;
          return (
            <div key={c.id} className="rounded-xl overflow-hidden" style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.hairline}` }}>
              <button className="w-full text-left p-3 flex items-center justify-between gap-3" onClick={() => setExpandedId(expanded ? null : c.id)}>
                <div className="flex items-center gap-2">
                  <ChevronDown size={14} style={{ color: COLORS.textFaint, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                  <Avatar photoUrl={c.photoUrl} />
                  <div>
                    <div className="font-semibold text-sm" style={{ color: COLORS.text }}>
                      {c.nominee.name}
                    </div>
                    <div className="text-xs" style={{ color: COLORS.textMuted }}>
                      {c.department} · {formatMonthLabel(c.month)} · {c.division === "foh" ? "Front of the House" : "Back of the House"}
                    </div>
                  </div>
                </div>
                {usedIds.has(c.id) && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={{ background: `${COLORS.gold}26`, color: COLORS.gold }}>
                    Assigned
                  </span>
                )}
              </button>
              {expanded && <NominationDetail record={c} />}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => onFinalize(assignments)}
        disabled={!canFinalize || busy}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: COLORS.gold, color: "#1A1406", opacity: !canFinalize || busy ? 0.6 : 1 }}
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        Finalize Champion of the Year
      </button>
    </div>
  );
}

function AwardOfYearCandidatePanel({ def, year, candidates, winner, onSelect, busyId, onClear, clearingId }) {
  const Icon = def.icon;
  const [expandedId, setExpandedId] = useState(null);
  return (
    <div className="rounded-2xl p-5" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
      <div className="flex items-center gap-2 mb-4">
        <TierBadge type={def.key} />
        <h3 className="font-semibold" style={{ color: COLORS.text, fontFamily: "Fraunces, serif" }}>
          {def.name.replace(" of the Month", " of the Year")}
        </h3>
      </div>

      {winner ? (
        <div className="rounded-xl overflow-hidden" style={{ background: `${COLORS.good}16`, border: `1px solid ${COLORS.good}55` }}>
          <button className="w-full text-left p-4" onClick={() => setExpandedId(expandedId === winner.id ? null : winner.id)}>
            <div className="flex items-center gap-2 text-xs font-semibold mb-1" style={{ color: COLORS.good }}>
              <CheckCircle2 size={14} /> Winner of the Year selected
              <ChevronDown size={13} style={{ marginLeft: "auto", transform: expandedId === winner.id ? "rotate(180deg)" : "none" }} />
            </div>
            <div className="font-semibold" style={{ color: COLORS.text }}>
              {winner.nominee.name}
            </div>
            <div className="text-xs" style={{ color: COLORS.textMuted }}>
              {winner.department} · won {formatMonthLabel(winner.month)}
            </div>
          </button>
          {expandedId === winner.id && <NominationDetail record={winner} />}
          <div className="px-4 pb-3">
            <button
              onClick={() => onClear(winner.id)}
              disabled={clearingId === winner.id}
              className="text-xs font-medium underline"
              style={{ color: COLORS.textFaint, opacity: clearingId === winner.id ? 0.5 : 1 }}
            >
              {clearingId === winner.id ? "Changing…" : "Change selection"}
            </button>
          </div>
        </div>
      ) : candidates.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: COLORS.textFaint }}>
          No {def.name.replace(" of the Month", "")} winners recorded yet for {year}.
        </p>
      ) : (
        <div className="space-y-2.5">
          {candidates.map((c) => {
            const expanded = expandedId === c.id;
            return (
              <div key={c.id} className="rounded-xl overflow-hidden" style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.hairline}` }}>
                <button className="w-full text-left p-3" onClick={() => setExpandedId(expanded ? null : c.id)}>
                  <div className="flex items-center gap-2">
                    <ChevronDown size={14} style={{ color: COLORS.textFaint, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                    <Avatar photoUrl={c.photoUrl} />
                    <div>
                      <div className="font-semibold text-sm" style={{ color: COLORS.text }}>
                        {c.nominee.name}
                      </div>
                      <div className="text-xs" style={{ color: COLORS.textMuted }}>
                        {c.department} · won {formatMonthLabel(c.month)}
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
                    <Icon size={13} /> Select as Winner of the Year
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AwardOfYearView({ profile, nominations, refresh }) {
  const [busyId, setBusyId] = useState(null);
  const [championBusy, setChampionBusy] = useState(false);
  const [clearingId, setClearingId] = useState(null);
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));

  const years = useMemo(() => {
    const set = new Set(nominations.filter((n) => n.month).map((n) => n.month.slice(0, 4)));
    set.add(String(new Date().getFullYear()));
    return Array.from(set).sort().reverse();
  }, [nominations]);

  if (!profile.roles.includes("gm")) {
    return <EmptyState icon={Trophy} title="General Manager only" body="Your account isn't set up to select the Awards of the Year." />;
  }

  const inYear = (n) => n.month && n.month.startsWith(yearFilter);

  async function handleSelectYear(record, awardType) {
    setBusyId(record.id);
    try {
      await finalizeYearAwards(yearFilter, [{ id: record.id, awardType, rank: "winner" }], profile.full_name);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleClear(id) {
    setClearingId(id);
    try {
      await clearYearAward(id);
      await refresh();
    } finally {
      setClearingId(null);
    }
  }

  async function handleFinalizeChampionYear(assignments) {
    setChampionBusy(true);
    try {
      const list = YEAR_CHAMPION_SLOTS.filter((slot) => assignments[slot.key]).map((slot) => ({
        id: assignments[slot.key],
        awardType: "champion",
        division: slot.division,
        rank: slot.rank,
      }));
      await finalizeYearAwards(yearFilter, list, profile.full_name);
      await refresh();
    } finally {
      setChampionBusy(false);
    }
  }

  const championPool = nominations.filter((n) => n.awardType === "champion" && inYear(n) && n.status === "winner");
  const championFinalized = championPool.filter((n) => n.yearAward === "winner" || n.yearAward === "runner_up");

  const shiningStarPool = nominations.filter((n) => n.awardType === "shiningStar" && inYear(n) && n.status === "winner");
  const shiningStarYearWinner = shiningStarPool.find((n) => n.yearAward === "winner");

  const heroPool = nominations.filter((n) => n.awardType === "hero" && inYear(n) && n.status === "winner");
  const heroYearWinner = heroPool.find((n) => n.yearAward === "winner");

  return (
    <div>
      <div className="flex items-end gap-3 flex-wrap mb-6">
        <Field label="Year">
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="rounded-2xl p-5 mb-5" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
        <div className="flex items-center gap-2 mb-4">
          <TierBadge type="champion" />
          <h3 className="font-semibold" style={{ color: COLORS.text, fontFamily: "Fraunces, serif" }}>
            Champion of the Year
          </h3>
        </div>
        <AwardOfYearChampionPanel
          year={yearFilter}
          candidates={championPool.filter((c) => !c.yearAward)}
          finalized={championFinalized}
          onFinalize={handleFinalizeChampionYear}
          busy={championBusy}
          onClear={handleClear}
          clearingId={clearingId}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <AwardOfYearCandidatePanel
          def={AWARD_TYPES.shiningStar}
          year={yearFilter}
          candidates={shiningStarPool.filter((c) => !c.yearAward)}
          winner={shiningStarYearWinner}
          onSelect={(c) => handleSelectYear(c, "shiningStar")}
          busyId={busyId}
          onClear={handleClear}
          clearingId={clearingId}
        />
        <AwardOfYearCandidatePanel
          def={AWARD_TYPES.hero}
          year={yearFilter}
          candidates={heroPool.filter((c) => !c.yearAward)}
          winner={heroYearWinner}
          onSelect={(c) => handleSelectYear(c, "hero")}
          busyId={busyId}
          onClear={handleClear}
          clearingId={clearingId}
        />
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

// Builds a clean, printable HTML report of every decided winner for one
// month, and opens it in a new tab ready for the browser's print dialog.
function printMonthlyReport(month, nominations) {
  const inMonth = (n) => n.month === month;
  const champion = nominations.filter((n) => n.awardType === "champion" && inMonth(n) && (n.status === "winner" || n.status === "runner_up"));
  const shiningStar = nominations.filter((n) => n.awardType === "shiningStar" && inMonth(n) && n.status === "winner");
  const hero = nominations.filter((n) => n.awardType === "hero" && inMonth(n) && n.status === "winner");

  const row = (label, r) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;">
        ${r.photoUrl ? `<img src="${r.photoUrl}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;display:block;" />` : `<div style="width:44px;height:44px;border-radius:50%;background:#eee;"></div>`}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;">${label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;font-weight:600;">${r.nominee.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;">${r.nominee.clockNo || ""}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;">${r.department}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;">${r.nominee.position || ""}</td>
    </tr>`;

  let rows = "";
  const fohWinner = champion.find((r) => r.division === "foh" && r.status === "winner");
  const fohRunner = champion.find((r) => r.division === "foh" && r.status === "runner_up");
  const bohWinner = champion.find((r) => r.division === "boh" && r.status === "winner");
  const bohRunner = champion.find((r) => r.division === "boh" && r.status === "runner_up");
  if (fohWinner) rows += row("Champion — Front of the House (Winner)", fohWinner);
  if (fohRunner) rows += row("Champion — Front of the House (Runner-up)", fohRunner);
  if (bohWinner) rows += row("Champion — Back of the House (Winner)", bohWinner);
  if (bohRunner) rows += row("Champion — Back of the House (Runner-up)", bohRunner);
  shiningStar.forEach((r) => (rows += row("Shining Star of the Month", r)));
  hero.forEach((r) => (rows += row("Hero of the Month", r)));

  if (!rows) {
    rows = `<tr><td colspan="6" style="padding:16px;color:#888;text-align:center;">No winners decided yet for ${formatMonthLabel(month)}.</td></tr>`;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Circle of Excellence — ${formatMonthLabel(month)} Winners</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1A2038; margin: 40px; }
  h1 { font-size: 22px; margin-bottom: 2px; }
  h2 { font-size: 14px; font-weight: normal; color: #666; margin-top: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th { text-align: left; padding: 8px 12px; background: #1A2038; color: #fff; font-size: 12px; }
  th:first-child { width: 60px; }
  img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { body { margin: 15mm; } }
</style>
<script>
  window.onload = function () {
    var imgs = Array.prototype.slice.call(document.images);
    var pending = imgs.filter(function (img) { return !img.complete; });
    function go() { window.print(); }
    if (pending.length === 0) { go(); return; }
    var remaining = pending.length;
    function done() { remaining -= 1; if (remaining <= 0) go(); }
    pending.forEach(function (img) {
      img.addEventListener('load', done);
      img.addEventListener('error', done);
    });
    setTimeout(go, 4000); // fallback in case an image hangs
  };
</script>
</head>
<body>
  <h1>Circle of Excellence</h1>
  <h2>Winners Report — ${formatMonthLabel(month)}</h2>
  <table>
    <thead><tr><th>Photo</th><th>Award</th><th>Winner</th><th>Clock No.</th><th>Department</th><th>Position</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.focus();
}

function DashboardView({ nominations, profile, onPhotoUpload }) {
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const months = useMemo(() => Array.from(new Set(nominations.map((n) => n.month))).sort().reverse(), [nominations]);
  const years = useMemo(() => Array.from(new Set(nominations.map((n) => n.month.split("-")[0]))).sort().reverse(), [nominations]);

  const filtered = nominations
    .filter((n) => (yearFilter === "all" ? true : n.month.split("-")[0] === yearFilter))
    .filter((n) => (monthFilter === "all" ? true : n.month === monthFilter))
    .filter((n) => (typeFilter === "all" ? true : typeFilter === "yearWinner" ? !!n.yearAward : n.awardType === typeFilter))
    .filter((n) => (statusFilter === "all" ? true : n.status === statusFilter))
    .filter((n) => (divisionFilter === "all" ? true : n.division === divisionFilter))
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  const totals = {
    all: nominations.length,
    submitted: nominations.filter((n) => n.status === "submitted").length,
    with_gm: nominations.filter((n) => n.status === "with_gm").length,
    winner: nominations.filter((n) => n.status === "winner").length,
    yearAward: nominations.filter((n) => n.yearAward).length,
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <StatCard label="Total nominations" value={totals.all} />
        <StatCard label="Awaiting P&C" value={totals.submitted} color={COLORS.gold} />
        <StatCard label="With General Manager" value={totals.with_gm} color={COLORS.champion} />
        <StatCard label="Winners" value={totals.winner} color={COLORS.good} />
        <StatCard label="Awards of the Year" value={totals.yearAward} color={COLORS.gold} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="all">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
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
          <option value="yearWinner">Year Winner (Award of the Year)</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="all">All statuses</option>
          <option value="submitted">Awaiting P&C</option>
          <option value="with_gm">With General Manager</option>
          <option value="winner">Winner</option>
          <option value="runner_up">Runner-up</option>
          <option value="not_selected">Not Selected</option>
        </select>
        <select value={divisionFilter} onChange={(e) => setDivisionFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="all">Front &amp; Back of the House</option>
          <option value="foh">Front of the House only</option>
          <option value="boh">Back of the House only</option>
        </select>
        {(yearFilter !== "all" || monthFilter !== "all" || typeFilter !== "all" || statusFilter !== "all" || divisionFilter !== "all") && (
          <button
            onClick={() => {
              setYearFilter("all");
              setMonthFilter("all");
              setTypeFilter("all");
              setStatusFilter("all");
              setDivisionFilter("all");
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: COLORS.panelAlt, color: COLORS.textMuted, border: `1px solid ${COLORS.hairline}` }}
          >
            <XCircle size={14} /> Reset filters
          </button>
        )}
        {monthFilter !== "all" && (
          <button
            onClick={() => printMonthlyReport(monthFilter, nominations)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ background: COLORS.gold, color: "#1A1406" }}
          >
            <Printer size={14} /> Print {formatMonthLabel(monthFilter)} report
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Sparkles} title="No nominations yet" body="Submit one from the New Nomination tab to see it appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => (
            <NominationRow
              key={record.id}
              record={record}
              expanded={expandedId === record.id}
              onToggle={() => setExpandedId(expandedId === record.id ? null : record.id)}
              profile={profile}
              onPhotoUpload={onPhotoUpload}
            />
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
  const [tab, setTab] = useState(profile.roles.includes("deptHead") ? "new" : profile.roles.includes("pnc") ? "pnc" : "gm");
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

  async function handlePhotoUpload(id, file) {
    await uploadNominationPhoto(id, file);
    await loadData();
  }

  const pncBadge = profile.roles.includes("pnc") ? nominations.filter((n) => n.status === "submitted").length : 0;
  const gmBadge = profile.roles.includes("gm") ? nominations.filter((n) => n.status === "with_gm").length : 0;

  const canSeeDashboard = profile.roles.includes("pnc") || profile.roles.includes("gm");

  const tabs = [
    ...(profile.roles.includes("deptHead") ? [{ key: "new", label: "New Nomination", icon: PlusCircle }] : []),
    { key: "pnc", label: "P&C Queue", icon: Send, badge: pncBadge },
    { key: "gm", label: "GM Selection", icon: Crown, badge: gmBadge },
    ...(profile.roles.includes("gm") ? [{ key: "yearly", label: "Award of the Year", icon: Trophy }] : []),
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
            <NewNominationTab profile={profile} nominations={nominations} refresh={loadData} />
          ) : tab === "pnc" ? (
            <PncQueueView profile={profile} nominations={nominations} refresh={loadData} onPhotoUpload={handlePhotoUpload} />
          ) : tab === "gm" ? (
            <GmSelectionView profile={profile} nominations={nominations} refresh={loadData} />
          ) : tab === "yearly" ? (
            <AwardOfYearView profile={profile} nominations={nominations} refresh={loadData} />
          ) : canSeeDashboard ? (
            <DashboardView nominations={nominations} profile={profile} onPhotoUpload={handlePhotoUpload} />
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
