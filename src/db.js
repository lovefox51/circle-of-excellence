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
