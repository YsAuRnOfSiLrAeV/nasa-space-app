/**
 * Calibration-study evidence for the Research page, transcribed from two team reports:
 *
 *   HEIGHT  plan_documentation/CALIBRATION_HEIGHT_VS_GEDI.pdf
 *   STATUS  plan_documentation/CALIBRATION_STATUS.pdf (dated 14.11.2026)
 *
 * Every number here is copied from those reports; nothing is derived except where a
 * comment says so. These are study results. They are NOT the values in the example-fire
 * exports (public/data/demo), which may come from a different model run, and they must
 * never be written into those exports.
 *
 * The reports are internal: the page credits them by `label` and never shows a file name.
 *
 * To substitute reviewed findings, edit this file only: the Research page reads it.
 */

export type EvidenceSource = 'HEIGHT' | 'STATUS';

export const EVIDENCE_SOURCES: Record<
  EvidenceSource,
  { title: string; file: string; note: string; label: string }
> = {
  HEIGHT: {
    title: 'Model calibration against GEDI: what was done and what to check',
    file: 'CALIBRATION_HEIGHT_VS_GEDI.pdf',
    label: 'project height calibration study against GEDI',
    note: 'Height regression against GEDI rh98, Canada. Script: scripts/calibration_check.py.',
  },
  STATUS: {
    title: 'Calibration: what we have and what is still needed',
    file: 'CALIBRATION_STATUS.pdf',
    label: 'project calibration review',
    note: 'Dated 14 November 2026. Scripts: calibration_check.py, calibration_probabilities.py, growth_drivers.py, build_growth_model.py.',
  },
};

/** Height validation design (HEIGHT, "What was done"; STATUS 1a). */
export const VALIDATION_DESIGN = {
  source: 'HEIGHT' as EvidenceSource,
  country: 'Canada',
  points: 1485,
  fires: 131,
  target: 'GEDI rh98 canopy height',
  split: 'GroupKFold, 10 folds, grouped by fire',
  models: ['Ridge regression', 'Gradient boosting'],
  calibration: 'Isotonic calibration, fitted on other fires',
  /** The same design in plain words, for the pipeline diagram. */
  targetPlain: 'GEDI canopy height',
  splitPlain: 'Always tested on fires held out of training',
  calibrationPlain: 'Recalibration tried, fitted on other fires',
} as const;

export interface InputFeature {
  name: string;
  sensor: 'Sentinel-1' | 'Optical' | 'NISAR';
  band: string;
  meaning: string;
}

/** The seven model inputs (HEIGHT: "S1 VV/VH/VH−VV, NDVI, NISAR HV/HH/HV−HH"). */
export const INPUT_FEATURES: InputFeature[] = [
  { name: 'VV', sensor: 'Sentinel-1', band: 'C-band radar', meaning: 'Co-polarised backscatter' },
  {
    name: 'VH',
    sensor: 'Sentinel-1',
    band: 'C-band radar',
    meaning: 'Cross-polarised backscatter',
  },
  {
    name: 'VH − VV',
    sensor: 'Sentinel-1',
    band: 'C-band radar',
    meaning: 'Polarisation difference',
  },
  {
    name: 'NDVI',
    sensor: 'Optical',
    band: 'Red and near-infrared',
    meaning: 'Vegetation greenness',
  },
  { name: 'HV', sensor: 'NISAR', band: 'L-band radar', meaning: 'Cross-polarised backscatter' },
  { name: 'HH', sensor: 'NISAR', band: 'L-band radar', meaning: 'Co-polarised backscatter' },
  { name: 'HV − HH', sensor: 'NISAR', band: 'L-band radar', meaning: 'Polarisation difference' },
];

export interface DemoFireComparison {
  fire: string;
  /** Median GEDI height of the neighbouring forest, metres. */
  neighbourM: number;
  /** Recovery as % of the neighbouring forest's height. */
  optical: number;
  modelRaw: number;
  modelCalibrated: number;
  gedi: number;
  /** GEDI points behind the row, as the report states them. */
  gediPoints: string;
}

/**
 * Optical proxy, model and GEDI for the four demonstration fires (HEIGHT, "Demo fires").
 * Out-of-sample: each fire was held out of the model that estimated it.
 */
export const DEMO_FIRE_COMPARISON: DemoFireComparison[] = [
  {
    fire: 'Quebec 2010',
    neighbourM: 8.8,
    optical: 93,
    modelRaw: 76,
    modelCalibrated: 81,
    gedi: 43,
    gediPoints: '23–25',
  },
  {
    fire: 'BC 2003',
    neighbourM: 19.1,
    optical: 90,
    modelRaw: 50,
    modelCalibrated: 49,
    gedi: 37,
    gediPoints: '23–25',
  },
  {
    fire: 'Ontario 1988',
    neighbourM: 13.6,
    optical: 83,
    modelRaw: 68,
    modelCalibrated: 66,
    gedi: 67,
    gediPoints: '74',
  },
  {
    fire: 'Quebec 1995',
    neighbourM: 11.0,
    optical: 94,
    modelRaw: 82,
    modelCalibrated: 80,
    gedi: 88,
    gediPoints: '23–25',
  },
];

/** The optical proxy's rule, which the reports call conventional and not approved. */
export const OPTICAL_RULE = {
  source: 'HEIGHT' as EvidenceSource,
  rule: 'NDVI 0.2…0.8 mapped linearly to 0…100% recovery',
  status: 'Provisional: taken from the demo page, not approved by the team',
  alternative: 'Post-fire NDVI divided by pre-fire NDVI (suggested from the Mediterranean data)',
  /** Fire-level correlation of NDVI with GEDI height (HEIGHT, STATUS 1a). */
  ndviGediCorrelation: -0.23,
} as const;

/** Height accuracy at two levels (STATUS 1a, rounded; HEIGHT has the unrounded rows). */
export const HEIGHT_ACCURACY = {
  source: 'STATUS' as EvidenceSource,
  point: {
    label: 'Individual point',
    maeM: 3.7,
    r2: 0.11,
    /** Mean error on short (<5 m) and tall (≥10 m) GEDI points, metres. */
    biasLowM: 3.6,
    biasHighM: -6.5,
    slope: '0.12–0.17',
  },
  fire: {
    label: 'Whole fire',
    maeM: 1.8,
    r2: 0.34,
    /** MAE of the null model (the mean) at fire level, metres. */
    baselineMaeM: 2.2,
    fires: 54,
    minPoints: 10,
    biasM: 0.34,
    slope: '0.24',
    /** Error as % of the neighbouring forest's height. */
    relativeErrorMedianPct: 11.7,
    relativeErrorMeanPct: 13.7,
  },
  /** Point-level MAE before and after isotonic calibration, metres (STATUS 1a). */
  isotonic: { beforeM: 3.66, afterM: 3.71 },
  /** Slope of GEDI regressed on the prediction: calibrated on average (HEIGHT). */
  gediOnPredictionSlope: '0.8–0.9',
} as const;

export type Region = 'continental' | 'mediterranean' | 'savanna';
export interface CountryCalibration {
  region: Region;
  country: string;
  /** Share of GEDI points taller than 5 m. */
  actualShare: number;
  /** Mean `p_forest_gt5` score. */
  meanScore: number;
  auc: number;
  brier: number;
  /** Brier score of the null model (the base rate). */
  brierNull: number;
  ece: number;
  recalibrationSlope: number;
}

/**
 * `p_forest_gt5` outside the training country (STATUS 1b): trained on the other
 * countries of the region, evaluated on this one.
 */
export const SCORE_CALIBRATION: CountryCalibration[] = [
  {
    region: 'continental',
    country: 'Canada',
    actualShare: 0.65,
    meanScore: 0.73,
    auc: 0.71,
    brier: 0.209,
    brierNull: 0.228,
    ece: 0.087,
    recalibrationSlope: 1.05,
  },
  {
    region: 'continental',
    country: 'Ukraine',
    actualShare: 0.84,
    meanScore: 0.84,
    auc: 0.69,
    brier: 0.123,
    brierNull: 0.134,
    ece: 0.046,
    recalibrationSlope: 0.24,
  },
  {
    region: 'continental',
    country: 'USA',
    actualShare: 0.54,
    meanScore: 0.47,
    auc: 0.73,
    brier: 0.212,
    brierNull: 0.248,
    ece: 0.072,
    recalibrationSlope: 0.9,
  },
  {
    region: 'mediterranean',
    country: 'Greece',
    actualShare: 0.62,
    meanScore: 0.69,
    auc: 0.71,
    brier: 0.213,
    brierNull: 0.235,
    ece: 0.073,
    recalibrationSlope: 0.97,
  },
  {
    region: 'mediterranean',
    country: 'Turkey',
    actualShare: 0.62,
    meanScore: 0.75,
    auc: 0.65,
    brier: 0.236,
    brierNull: 0.236,
    ece: 0.135,
    recalibrationSlope: 0.68,
  },
  {
    region: 'mediterranean',
    country: 'Spain',
    actualShare: 0.52,
    meanScore: 0.57,
    auc: 0.75,
    brier: 0.208,
    brierNull: 0.25,
    ece: 0.064,
    recalibrationSlope: 1.36,
  },
  {
    region: 'savanna',
    country: 'Zambia',
    actualShare: 0.97,
    meanScore: 0.79,
    auc: 0.9,
    brier: 0.063,
    brierNull: 0.028,
    ece: 0.177,
    recalibrationSlope: 1.76,
  },
  {
    region: 'savanna',
    country: 'Tanzania',
    actualShare: 0.87,
    meanScore: 0.76,
    auc: 0.82,
    brier: 0.122,
    brierNull: 0.11,
    ece: 0.113,
    recalibrationSlope: 0.57,
  },
];

/** Known limits of the inputs and references (STATUS 2; HEIGHT "Limitations"). */
export const LIMITATIONS: { title: string; detail: string; source: EvidenceSource }[] = [
  {
    title: 'Temporal mismatch',
    detail:
      'GEDI measured in 2019–2023; the radar and imagery are from 2026. Part of the "error" is real growth over 3–7 years. Not quantified.',
    source: 'STATUS',
  },
  {
    title: 'Provisional NISAR calibration',
    detail: 'The NISAR product is provisional; the team did not verify its calibration itself.',
    source: 'STATUS',
  },
  {
    title: 'Sentinel-1 terrain correction',
    detail: 'Sentinel-1 is used without terrain correction, which is worse on slopes above 10°.',
    source: 'STATUS',
  },
  {
    title: 'NDVI cloud handling',
    detail: 'NDVI is computed without a per-scene cloud mask.',
    source: 'STATUS',
  },
  {
    title: 'Reference-forest selection',
    detail:
      'The neighbouring forest height is the GEDI median in a 1.5–6 km ring. For Quebec 2010 it is 8.8 m: a small denominator makes the percentage unstable, and the ring filter (clear-cuts, lakes, old burns) needs checking.',
    source: 'STATUS',
  },
  {
    title: 'Season outside Canada',
    detail:
      'In the savanna, July–August imagery is the dry season, while the model assumes a leaf-on summer.',
    source: 'STATUS',
  },
  {
    title: 'Not yet checked',
    detail:
      'Model height of the unburned forest around a fire (few data: 150 Ontario points), and the effect of standing dead trunks on GEDI in young burns.',
    source: 'HEIGHT',
  },
];

/** Growth-forecast validation, Canada (STATUS summary 3 and item 2.6). */
export const FORECAST_VALIDATION = {
  source: 'STATUS' as EvidenceSource,
  fires: 51,
  r2WithDrivers: 0.44,
  r2Comparison: 0.38,
  nominalIntervalPct: 80,
  observedCoveragePct: 82,
  /** Fire age beyond which a forecast is an extrapolation, years. */
  extrapolationBeyondYears: 36,
  demoFiresInTraining: 4,
} as const;

/**
 * Display bands for the `p_forest_gt5` relative score (percent). Provisional: a
 * frontend presentation choice until the model owner (Sofia) approves thresholds.
 * The map layer and the Research page both read these.
 */
export const SCORE_BANDS = {
  breaks: [40, 70] as const,
  labels: ['Low', 'Medium', 'High'] as const,
  status: 'Provisional thresholds, pending approval by the model owner',
} as const;

/** Open decisions the reports leave to the team, shown on the page as unresolved. */
export const OPEN_QUESTIONS: {
  question: string;
  /** Suggested owner; the reports name the decision, not always the person. */
  owner: string;
  /** 'APP' marks an assumption made by the frontend, not a finding of the reports. */
  source: EvidenceSource | 'APP';
}[] = [
  {
    question: 'Which optical-to-recovery rule to use; the current NDVI rule is not approved.',
    owner: 'Team decision with Sofia',
    source: 'STATUS',
  },
  {
    question:
      'Which error to quote against GEDI: 12% (fire-level median), 14% (mean) or ±3.7 m per point.',
    owner: 'Ilya, Sofia',
    source: 'STATUS',
  },
  {
    question: 'How to present p_forest_gt5; the report proposes categories, not a percentage.',
    owner: 'Sofia',
    source: 'STATUS',
  },
  {
    question: 'Whether Turkey counts as "not confirmed" (Brier equals the null model).',
    owner: 'Ilya, Sofia',
    source: 'STATUS',
  },
  {
    question:
      'The growth-curve equation: the app infers R(age) = 1 − exp(−age / τ) from exported parameters.',
    owner: 'Sofia (model owner)',
    source: 'APP',
  },
];
