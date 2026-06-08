/**
 * Maps health conditions/diseases to medical specialties
 * and relevant OSM amenity tags for Overpass queries.
 */

const SPECIALTY_MAP = {
  // ── cardiac ──
  heart:         { specialties: ["cardiology", "cardiac"],
                   osmTags: ["hospital", "clinic"],
                   label: "Cardiologist / Heart Specialist" },
  cardiac:       { specialties: ["cardiology", "cardiac"],
                   osmTags: ["hospital", "clinic"],
                   label: "Cardiologist / Heart Specialist" },
  cardiology:    { specialties: ["cardiology"],
                   osmTags: ["hospital"],
                   label: "Cardiology Hospital" },

  // ── cancer / oncology ──
  cancer:        { specialties: ["oncology", "cancer"],
                   osmTags: ["hospital"],
                   label: "Cancer / Oncology Hospital" },
  oncology:      { specialties: ["oncology"],
                   osmTags: ["hospital"],
                   label: "Oncology Hospital" },
  tumor:         { specialties: ["oncology", "cancer"],
                   osmTags: ["hospital"],
                   label: "Cancer / Oncology Hospital" },

  // ── neuro ──
  brain:         { specialties: ["neurology", "neuro"],
                   osmTags: ["hospital", "clinic"],
                   label: "Neurologist / Brain Specialist" },
  neuro:         { specialties: ["neurology"],
                   osmTags: ["hospital"],
                   label: "Neurology Hospital" },
  seizure:       { specialties: ["neurology", "epilepsy"],
                   osmTags: ["hospital", "clinic"],
                   label: "Neurologist" },
  epilepsy:      { specialties: ["neurology", "epilepsy"],
                   osmTags: ["hospital", "clinic"],
                   label: "Epilepsy / Neurology Specialist" },
  stroke:        { specialties: ["neurology", "stroke"],
                   osmTags: ["hospital"],
                   label: "Stroke / Neurology Center" },

  // ── orthopaedic ──
  bone:          { specialties: ["orthopaedic", "orthopedic"],
                   osmTags: ["hospital", "clinic"],
                   label: "Orthopaedic Specialist" },
  joint:         { specialties: ["orthopaedic", "rheumatology"],
                   osmTags: ["hospital", "clinic"],
                   label: "Orthopaedic / Joint Specialist" },
  fracture:      { specialties: ["orthopaedic"],
                   osmTags: ["hospital", "clinic"],
                   label: "Orthopaedic Surgeon" },
  spine:         { specialties: ["orthopaedic", "spine", "neurosurgery"],
                   osmTags: ["hospital"],
                   label: "Spine Specialist" },
  knee:          { specialties: ["orthopaedic"],
                   osmTags: ["hospital", "clinic"],
                   label: "Orthopaedic / Knee Specialist" },

  // ── eye ──
  eye:           { specialties: ["ophthalmology", "eye"],
                   osmTags: ["hospital", "clinic", "doctors"],
                   label: "Eye Specialist / Ophthalmologist" },
  vision:        { specialties: ["ophthalmology"],
                   osmTags: ["clinic", "doctors"],
                   label: "Eye / Vision Specialist" },
  cataract:      { specialties: ["ophthalmology"],
                   osmTags: ["hospital", "clinic"],
                   label: "Cataract Surgery Specialist" },

  // ── skin ──
  skin:          { specialties: ["dermatology", "skin"],
                   osmTags: ["clinic", "doctors"],
                   label: "Dermatologist / Skin Specialist" },
  dermatology:   { specialties: ["dermatology"],
                   osmTags: ["clinic", "doctors"],
                   label: "Dermatology Clinic" },
  psoriasis:     { specialties: ["dermatology"],
                   osmTags: ["clinic"],
                   label: "Dermatologist" },
  eczema:        { specialties: ["dermatology"],
                   osmTags: ["clinic"],
                   label: "Dermatologist" },

  // ── mental health ──
  mental:        { specialties: ["psychiatry", "psychology", "mental_health"],
                   osmTags: ["hospital", "clinic", "doctors"],
                   label: "Psychiatrist / Mental Health Specialist" },
  depression:    { specialties: ["psychiatry", "psychology"],
                   osmTags: ["clinic", "doctors"],
                   label: "Psychiatrist / Psychologist" },
  anxiety:       { specialties: ["psychiatry", "psychology"],
                   osmTags: ["clinic", "doctors"],
                   label: "Psychiatrist / Psychologist" },
  psychiatric:   { specialties: ["psychiatry"],
                   osmTags: ["hospital", "clinic"],
                   label: "Psychiatric Hospital" },
  schizophrenia: { specialties: ["psychiatry"],
                   osmTags: ["hospital"],
                   label: "Psychiatric Specialist" },

  // ── kidney ──
  kidney:        { specialties: ["nephrology", "urology"],
                   osmTags: ["hospital", "clinic"],
                   label: "Nephrologist / Kidney Specialist" },
  dialysis:      { specialties: ["nephrology", "dialysis"],
                   osmTags: ["hospital", "clinic"],
                   label: "Dialysis / Kidney Center" },
  nephrology:    { specialties: ["nephrology"],
                   osmTags: ["hospital"],
                   label: "Nephrology Hospital" },

  // ── liver ──
  liver:         { specialties: ["gastroenterology", "hepatology"],
                   osmTags: ["hospital", "clinic"],
                   label: "Hepatologist / Liver Specialist" },
  hepatitis:     { specialties: ["gastroenterology", "hepatology"],
                   osmTags: ["hospital", "clinic"],
                   label: "Hepatology Specialist" },
  cirrhosis:     { specialties: ["gastroenterology", "hepatology"],
                   osmTags: ["hospital"],
                   label: "Liver / Gastroenterology Hospital" },

  // ── diabetes / endocrine ──
  diabetes:      { specialties: ["endocrinology", "diabetology"],
                   osmTags: ["hospital", "clinic", "doctors"],
                   label: "Diabetologist / Endocrinologist" },
  thyroid:       { specialties: ["endocrinology"],
                   osmTags: ["clinic", "doctors"],
                   label: "Endocrinologist / Thyroid Specialist" },
  hormonal:      { specialties: ["endocrinology"],
                   osmTags: ["clinic"],
                   label: "Endocrinologist" },

  // ── respiratory ──
  lung:          { specialties: ["pulmonology", "respiratory"],
                   osmTags: ["hospital", "clinic"],
                   label: "Pulmonologist / Lung Specialist" },
  asthma:        { specialties: ["pulmonology", "respiratory"],
                   osmTags: ["clinic", "doctors"],
                   label: "Pulmonologist / Asthma Specialist" },
  copd:          { specialties: ["pulmonology"],
                   osmTags: ["hospital", "clinic"],
                   label: "COPD / Respiratory Specialist" },
  tuberculosis:  { specialties: ["pulmonology", "tb"],
                   osmTags: ["hospital"],
                   label: "TB / Chest Disease Hospital" },
  tb:            { specialties: ["pulmonology", "tb"],
                   osmTags: ["hospital"],
                   label: "TB Hospital" },

  // ── gastro ──
  stomach:       { specialties: ["gastroenterology"],
                   osmTags: ["hospital", "clinic"],
                   label: "Gastroenterologist" },
  gastro:        { specialties: ["gastroenterology"],
                   osmTags: ["hospital", "clinic"],
                   label: "Gastroenterology Clinic" },
  ibs:           { specialties: ["gastroenterology"],
                   osmTags: ["clinic"],
                   label: "Gastroenterologist" },

  // ── child / paediatric ──
  child:         { specialties: ["paediatric", "pediatric", "child"],
                   osmTags: ["hospital", "clinic"],
                   label: "Paediatrician / Children's Hospital" },
  paediatric:    { specialties: ["paediatric", "pediatric"],
                   osmTags: ["hospital", "clinic"],
                   label: "Paediatric Hospital" },

  // ── dental ──
  dental:        { specialties: ["dental", "dentist"],
                   osmTags: ["dentist", "clinic"],
                   label: "Dentist / Dental Clinic" },
  teeth:         { specialties: ["dental"],
                   osmTags: ["dentist"],
                   label: "Dental Clinic" },

  // ── gynaecology / maternity ──
  gynaecology:   { specialties: ["gynaecology", "gynecology", "obstetrics"],
                   osmTags: ["hospital", "clinic"],
                   label: "Gynaecologist / Women's Hospital" },
  maternity:     { specialties: ["obstetrics", "maternity"],
                   osmTags: ["hospital"],
                   label: "Maternity Hospital" },
  fertility:     { specialties: ["fertility", "ivf", "reproductive"],
                   osmTags: ["hospital", "clinic"],
                   label: "Fertility / IVF Clinic" },

  // ── blood ──
  blood:         { specialties: ["haematology", "hematology"],
                   osmTags: ["hospital"],
                   label: "Haematologist / Blood Specialist" },
  anaemia:       { specialties: ["haematology"],
                   osmTags: ["hospital", "clinic"],
                   label: "Haematologist" },
  thalassemia:   { specialties: ["haematology"],
                   osmTags: ["hospital"],
                   label: "Thalassemia / Blood Disorder Center" },

  // ── surgery ──
  surgery:       { specialties: ["surgery", "surgical"],
                   osmTags: ["hospital"],
                   label: "Surgical Hospital" },
  transplant:    { specialties: ["transplant", "surgery"],
                   osmTags: ["hospital"],
                   label: "Transplant Center" },

  // ── general / others ──
  fever:         { specialties: ["general", "medicine"],
                   osmTags: ["hospital", "clinic", "doctors"],
                   label: "General Physician" },
  infection:     { specialties: ["infectious_disease", "general"],
                   osmTags: ["hospital", "clinic"],
                   label: "Infectious Disease Specialist" },
  allergy:       { specialties: ["allergy", "immunology"],
                   osmTags: ["clinic", "doctors"],
                   label: "Allergist / Immunologist" },
  rehabilitation:{ specialties: ["rehabilitation", "physiotherapy"],
                   osmTags: ["hospital", "clinic"],
                   label: "Rehabilitation Center" },
  physiotherapy: { specialties: ["physiotherapy"],
                   osmTags: ["clinic"],
                   label: "Physiotherapy Clinic" },
};

/**
 * Given a user-typed health condition string,
 * returns the best matching specialty info.
 * Checks word by word so "heart disease" matches "heart".
 */
export const mapConditionToSpecialty = (condition) => {
  if (!condition) return null;

  const words = condition.toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  // exact match first
  for (const word of words) {
    if (SPECIALTY_MAP[word]) return SPECIALTY_MAP[word];
  }

  // partial match — check if any key is contained in the input
  const input = condition.toLowerCase();
  for (const [key, value] of Object.entries(SPECIALTY_MAP)) {
    if (input.includes(key)) return value;
  }

  // fallback — general physician
  return {
    specialties: ["general", "hospital"],
    osmTags: ["hospital", "clinic", "doctors"],
    label: "General Hospital / Clinic"
  };
};

export default SPECIALTY_MAP;