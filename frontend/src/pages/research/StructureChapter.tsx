import { Reveal } from '@/components/shell/Reveal';
import { SignalEvidence } from '@/components/visualizations/SignalEvidence';
import { INPUT_FEATURES, VALIDATION_DESIGN } from '@/data/calibrationEvidence';
import { Chapter, Supporting } from './ChapterFrame';
import { Prose } from './Prose';
import { CHAPTERS } from './chapters';
import { FeatureTable, PipelineDiagram } from './figures/PipelineDiagram';

import type { ResearchSelection } from './ResearchStudy';
import { GediReference } from './ResearchStudy';

export function StructureChapter({ sample, group, onPick }: ResearchSelection) {
  return (
    <Reveal>
      <Chapter
        copy={CHAPTERS.structure}
        band="ink"
        figure={<PipelineDiagram features={INPUT_FEATURES} design={VALIDATION_DESIGN} />}
      >
        <Supporting
          summary="The seven inputs and how the model was tested"
          note="Calibration study"
        >
          <FeatureTable features={INPUT_FEATURES} />
          <Prose>
            Test design, in the study’s terms: {VALIDATION_DESIGN.target}; {VALIDATION_DESIGN.split}
            ; {VALIDATION_DESIGN.models.join(' and ').toLowerCase()};{' '}
            {VALIDATION_DESIGN.calibration.toLowerCase()}.
          </Prose>
        </Supporting>
        <Supporting
          defer={group !== null}
          summary="Satellite signals against GEDI height in the Ontario sample"
          note="Observations and reference measurements · Ontario study sample"
        >
          {sample((s) => (
            <div className="space-y-8">
              <Prose>
                Each panel plots one satellite signal against the GEDI canopy height of the same
                point. ρ is an association in this one sample and region. It is not a comparative
                evaluation of the sensors, and radar backscatter is not a measurement of tree
                height.
              </Prose>
              <SignalEvidence points={s.points} layout="row" />
              <GediReference study={s} group={group} onPick={onPick} />
            </div>
          ))}
        </Supporting>
      </Chapter>
    </Reveal>
  );
}
