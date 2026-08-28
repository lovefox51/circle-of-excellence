import { supabase } from "./supabaseClient";

function rowToRecord(row) {
  return {
    id: row.id,
    awardType: row.award_type,
    month: row.month,
    department: row.department,
    nominee: {
      name: row.nominee_name,
      clockNo: row.clock_no,
      department: row.department,
      position: row.position,
      level: row.level,
      startDate: row.start_date,
    },
    category: row.category,
    cleanFile: row.clean_file,
    monthsServed: row.months_served,
    isEligible: row.is_eligible,
    scores: row.scores || {},
    totalScore: row.total_score,
    comments: row.comments,
    nominatedBy: row.nominated_by,
    status: row.status,
    submittedAt: row.submitted_at,
    forwardedAt: row.forwarded_at,
    forwardedBy: row.forwarded_by,
    decidedAt: row.decided_at,
    decidedBy: row.decided_by,
    division: row.division,
    photoUrl: row.photo_url,
    yearAward: row.year_award,
  };
}

export async function fetchNominations() {
  const { data, error } = await supabase
    .from("nominations")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return data.map(rowToRecord);
}

export async function fetchMyProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function insertNomination(record) {
  const payload = {
    award_type: record.awardType,
    month: record.month,
    department: record.department,
    nominee_name: record.nominee.name,
    clock_no: record.nominee.clockNo,
    position: record.nominee.position,
    level: record.nominee.level || null,
    start_date: record.nominee.startDate,
    category: record.category || null,
    clean_file: record.cleanFile,
    months_served: record.monthsServed,
    is_eligible: record.isEligible,
    scores: record.scores,
    total_score: record.totalScore,
    comments: record.comments || null,
    nominated_by: record.nominatedBy,
    status: record.status,
  };
  if (record.decidedAt) {
    payload.decided_at = record.decidedAt;
    payload.decided_by = record.decidedBy;
  }
  const { data, error } = await supabase.from("nominations").insert(payload).select().single();
  if (error) throw error;
  return rowToRecord(data);
}

export async function forwardNomination(id, forwardedBy) {
  const { error } = await supabase
    .from("nominations")
    .update({ status: "with_gm", forwarded_at: new Date().toISOString(), forwarded_by: forwardedBy })
    .eq("id", id);
  if (error) throw error;
}

export async function forwardAllPending(forwardedBy) {
  const { error } = await supabase
    .from("nominations")
    .update({ status: "with_gm", forwarded_at: new Date().toISOString(), forwarded_by: forwardedBy })
    .eq("status", "submitted");
  if (error) throw error;
}

export async function selectWinner(record, decidedBy) {
  const now = new Date().toISOString();
  const { error: winnerErr } = await supabase
    .from("nominations")
    .update({ status: "winner", decided_at: now, decided_by: decidedBy })
    .eq("id", record.id);
  if (winnerErr) throw winnerErr;

  const { error: restErr } = await supabase
    .from("nominations")
    .update({ status: "not_selected", decided_at: now, decided_by: decidedBy })
    .eq("award_type", record.awardType)
    .eq("month", record.month)
    .eq("status", "with_gm")
    .neq("id", record.id);
  if (restErr) throw restErr;
}

// Champion of the Month: General Manager assigns up to 4 people
// (Front/Back of the House x Winner/Runner-up) from the forwarded pool.
export async function finalizeChampionSelections(month, assignments, decidedBy) {
  const now = new Date().toISOString();

  for (const a of assignments) {
    const { error } = await supabase
      .from("nominations")
      .update({ status: a.rank, division: a.division, decided_at: now, decided_by: decidedBy })
      .eq("id", a.id);
    if (error) throw error;
  }

  const assignedIds = assignments.map((a) => a.id);
  let query = supabase
    .from("nominations")
    .update({ status: "not_selected", decided_at: now, decided_by: decidedBy })
    .eq("award_type", "champion")
    .eq("month", month)
    .eq("status", "with_gm");

  if (assignedIds.length > 0) {
    query = query.not("id", "in", `(${assignedIds.join(",")})`);
  }

  const { error } = await query;
  if (error) throw error;
}

export async function uploadNominationPhoto(id, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${id}-${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage.from("winner-photos").upload(path, file, { upsert: true });
  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage.from("winner-photos").getPublicUrl(path);

  const { error: updateErr } = await supabase.from("nominations").update({ photo_url: data.publicUrl }).eq("id", id);
  if (updateErr) throw updateErr;

  return data.publicUrl;
}

// Award of the Year: General Manager picks winners across a whole year from
// the pool of that year's monthly winners (and, for Champion, runner-ups too).
// `assignments` is [{ id, awardType, division, rank }], rank is "winner" | "runner_up".
export async function finalizeYearAwards(year, assignments, decidedBy) {
  const now = new Date().toISOString();

  for (const a of assignments) {
    const { error } = await supabase
      .from("nominations")
      .update({ year_award: a.rank, decided_at: now, decided_by: decidedBy })
      .eq("id", a.id);
    if (error) throw error;
  }

  // Clear any previous year-award holders in the same category that weren't
  // re-selected this time (e.g. GM changes their mind on who was Hero of the Year).
  const groups = {};
  for (const a of assignments) {
    const key = `${a.awardType}|${a.division || ""}`;
    if (!groups[key]) groups[key] = { awardType: a.awardType, division: a.division, ids: [] };
    groups[key].ids.push(a.id);
  }

  for (const key of Object.keys(groups)) {
    const { awardType, division, ids } = groups[key];
    let query = supabase
      .from("nominations")
      .update({ year_award: null })
      .eq("award_type", awardType)
      .like("month", `${year}-%`)
      .not("id", "in", `(${ids.join(",")})`);
    if (division) query = query.eq("division", division);
    const { error } = await query;
    if (error) throw error;
  }
}

// Undo a single Award of the Year selection, so the General Manager can pick again.
export async function clearYearAward(id) {
  const { error } = await supabase.from("nominations").update({ year_award: null }).eq("id", id);
  if (error) throw error;
}

// Undo a monthly Champion/Shining Star decision: reopens every nomination for
// that award type + month back into the General Manager's selection pool.
export async function reopenMonth(awardType, month, decidedBy) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("nominations")
    .update({ status: "with_gm", decided_at: null, decided_by: null })
    .eq("award_type", awardType)
    .eq("month", month)
    .in("status", ["winner", "runner_up", "not_selected"]);
  if (error) throw error;
}

// Undo a Hero of the Month entry. Hero has no pool to reopen (it's finalized
// the moment the General Manager submits it), so undoing means deleting the
// record so a fresh one can be nominated for that month.
export async function deleteNomination(id) {
  const { error } = await supabase.from("nominations").delete().eq("id", id);
  if (error) throw error;
}
