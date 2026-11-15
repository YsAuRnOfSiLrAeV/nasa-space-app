/**
 * Research page copy: one scientific question per chapter. Text only; the numbers
 * live in src/data/calibrationEvidence.ts and the layout in the components, so the
 * team's reviewed wording can replace this file without touching either.
 *
 * Voice: plain statement first, the statistical term in brackets after it. One
 * opening paragraph per chapter; the figure carries the evidence.
 */
import type { EvidenceSource } from '@/data/calibrationEvidence';

/** The four kinds of numbers the page keeps visibly apart. */
export type Kind = 'observation' | 'estimate' | 'reference' | 'forecast';
export const KIND_LABELS: Record<Kind, string> = {
  observation: 'Observation',
  estimate: 'Model estimate',
  reference: 'Reference measurement',
  forecast: 'Forecast',
};

export interface ChapterCopy {
  id: string;
  n: string;
  /** Short title for the chapter bar. */
  short: string;
  question: string;
  title: string;
  /** The opening paragraph. */
  lede: string;
  figure: {
    label: string;
    title: string;
    caption: string;
    sources: EvidenceSource[];
    /** Which kinds of numbers the figure contains. */
    kinds: Kind[];
  };
  /** What the figure shows: at most three short findings. */
  findings: string[];
  /** Assumptions that are not settled, shown as a marked note. */
  unresolved?: string[];
}

export const CHAPTERS = {
  green: {
    id: 'chapter-green',
    n: '01',
    short: 'Green is not recovered',
    question: 'Does a burn scar that looks green again have its forest back?',
    title: 'Green does not always mean recovered',
    lede: 'Grasses and shrubs return within a few years of a fire, and satellites see the green return with them. Tall forest takes decades. Three readings of the same four fires show how far apart "green" and "grown" can be.',
    figure: {
      label: 'Fig. 1',
      title: 'Recovery of four fires by three readings',
      caption:
        'Recovery as a percentage of the neighbouring forest’s height. Calibration-study results: each fire was held out of the model that estimated it. These are not necessarily the values shown by the example-fire exports on the map.',
      sources: ['HEIGHT'],
      kinds: ['observation', 'estimate', 'reference'],
    },
    findings: [
      'The optical proxy reads well above GEDI in three of the four fires: by 50 points in Quebec 2010, 53 in BC 2003 and 16 in Ontario 1988.',
      'The model is close to GEDI in Ontario 1988 and Quebec 1995. The model also substantially overestimates Quebec 2010: 81% against 43%.',
      'In Quebec 1995 the optical proxy is within 6 points of GEDI. Optical readings do not always overestimate recovery.',
    ],
    unresolved: [
      'The optical-to-recovery rule (NDVI 0.2…0.8 mapped to 0…100%) is provisional and not approved by the team. A different rule would move every optical value here.',
      'Quebec 2010’s neighbouring forest is only 8.8 m tall, so its percentages are unstable.',
      'GEDI measured in 2019–2023 and the radar in 2026: part of each gap is real growth.',
    ],
  },
  structure: {
    id: 'chapter-structure',
    n: '02',
    short: 'Reading structure',
    question: 'How can satellites read forest structure, not just colour?',
    title: 'Reading forest structure from space',
    lede: 'The model takes seven inputs from three sensors. Only three of the seven are NISAR measurements. NISAR’s long radar waves respond to trunks and branches, but it does not measure tree height: height comes from GEDI lidar, which the model is tested against and never sees as an input.',
    figure: {
      label: 'Fig. 2',
      title: 'From satellite observations to fire-level estimates',
      caption:
        'The pipeline and how it was tested, as reported. The model is always tested on fires it did not see in training.',
      sources: ['HEIGHT', 'STATUS'],
      kinds: ['observation', 'estimate', 'reference'],
    },
    findings: [],
  },
  accuracy: {
    id: 'chapter-accuracy',
    n: '03',
    short: 'Right and wrong',
    question: 'How close are the model’s heights to GEDI?',
    title: 'What the model gets right and wrong',
    lede: 'At a single point the model is weak: it is off by 3.7 m on average. Averaged over a whole fire the errors partly cancel and the estimate becomes useful. The model does not predict the height of individual trees or cells accurately.',
    figure: {
      label: 'Fig. 3',
      title: 'Height error at point level and at fire level',
      caption:
        'Compared with GEDI canopy height in Canada, always on fires held out of training. Point level: 1,485 points in 131 fires. Fire level: the 54 fires with at least 10 points.',
      sources: ['STATUS', 'HEIGHT'],
      kinds: ['estimate', 'reference'],
    },
    findings: [
      'For a whole fire the typical error is 1.8 m, against about 2.2 m for simply guessing the average. That is a median of 11.7% of the neighbouring forest’s height (mean 13.7%).',
      'Predicted heights are compressed toward the mean: short stands come out 3.6 m too tall and tall stands 6.5 m too short.',
      'Recalibrating the output did not materially help (3.66 m to 3.71 m): the signal is weak, not offset.',
    ],
    unresolved: [
      'Which error the interface should quote (12% fire-level median, 14% mean, or ±3.7 m per point) is an open team decision.',
    ],
  },
  reliability: {
    id: 'chapter-reliability',
    n: '04',
    short: 'Where it works',
    question: 'Where can the model be trusted, and what does its score mean?',
    title: 'Where the model works',
    lede: 'The model gives every cell a score for forest taller than 5 m. Tested in eight countries, the score ranks places well, but its absolute values are shifted, so it is not a calibrated probability. The map shows it as Low, Medium or High, never as "an 80% chance of forest".',
    figure: {
      label: 'Fig. 4',
      title: 'Mean relative score against the real share of forest above 5 m',
      caption:
        'One mark per country, each tested with a model trained on the other countries of its region. On the diagonal, the mean score would equal the real share of GEDI points taller than 5 m.',
      sources: ['STATUS'],
      kinds: ['estimate', 'reference'],
    },
    findings: [
      'The score ranks places moderately well in Canada, Ukraine and Turkey (ranking skill, AUC: 0.71, 0.69, 0.65).',
      'Ranking is strongest in Zambia and Tanzania (AUC 0.90 and 0.82), yet the scores there are far too low: 0.79 against a real share of 0.97 in Zambia.',
      'Good ranking does not guarantee calibrated probabilities.',
    ],
    unresolved: [
      'The Low / Medium / High band thresholds are provisional until the model owner approves them.',
      'Geographic applicability zone boundaries are not drawn here: no zone geometry has been supplied.',
      'Whether Turkey should be listed as "not confirmed" is an open team decision.',
    ],
  },
  forecast: {
    id: 'chapter-forecast',
    n: '05',
    short: 'Forecasting recovery',
    question: 'How is recovery forecast, and how far can the forecast be trusted?',
    title: 'Forecasting recovery',
    lede: 'The forecast gives one expected recovery value per year for a whole fire. It does not forecast individual cells, and choosing a forecast year never recolours the observation grid on the map. It was tested on Canadian fires held out of training.',
    figure: {
      label: 'Fig. 5',
      title: 'Growth-forecast validation on held-out fires',
      caption:
        'Canada, 51 fires. How much of the difference between fires each growth model explains, and how many held-out fires fell inside the nominal 80% prediction interval.',
      sources: ['STATUS'],
      kinds: ['forecast', 'reference'],
    },
    findings: [
      'Adding drivers to the growth model is a modest gain: it explains 0.44 of the variation between fires, against 0.38.',
      'Nominal 80% prediction intervals covered 82% of held-out fires. Forecasts beyond 36 years of fire age are extrapolations.',
      'The four demonstration fires were part of the growth model’s training data, so they are not independent tests of it.',
    ],
    unresolved: [
      'The curve the fire panel draws, R(age) = 1 − exp(−age / τ), is inferred by the app from exported parameters. The model owner has not confirmed it, so it is provisional, not the verified method.',
      'An age-only curve describes a typical fire of that age. A fire’s observed 2026 recovery estimate can differ from it, as BC 2003’s does.',
    ],
  },
} satisfies Record<string, ChapterCopy>;

export const CHAPTER_LIST: ChapterCopy[] = Object.values(CHAPTERS);

export const INTRO = {
  eyebrow: 'Research · evidence and calibration',
  title: 'Green again is not forest again',
  lede: 'A burn scar can look recovered from space long before its trees have grown back. Five questions set out the evidence, and where it stops.',
  /** The headline comparison shown in the opening band (a row of DEMO_FIRE_COMPARISON). */
  headlineFire: 'BC 2003',
  headlineNote:
    'British Columbia, 23 years after the fire: recovery as a share of the neighbouring forest’s height. Calibration-study values.',
};
