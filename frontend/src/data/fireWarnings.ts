/**
 * Warning codes the backend sends in result.json (DELIVERABLES tabs 1 and 8): it
 * sends codes only, the texts live here. Unknown codes still show, flagged.
 */
export const DEVELOPMENT_FIXTURE = 'DEVELOPMENT_FIXTURE';

export const WARNING_TEXT: Record<string, string> = {
  REGION_EXTRAPOLATED:
    'This regional model is being applied outside its training countries. This location is extrapolated, not directly validated.',
  MODEL_INPUT_CHECK_FAILED:
    'The model library reported input-check issues. Review the backend input diagnostics for units and training-range problems.',
  MANY_CELLS_EXCLUDED:
    'Many burned-area cells have no valid model estimate. The recovery average covers the retained cells and may overstate recovery.',
  ACCURACY_NOT_VALIDATED_WITHOUT_GEDI:
    'Calibration used GEDI reference heights. Its error estimates have not been validated for this alternative reference-height source.',
  MISSING_COVARIATES_USING_AVERAGES:
    'Some forecast covariates are missing; the model library substitutes training averages.',
  COVARIATE_OUT_OF_TRAINING_RANGE:
    'One or more supplied forecast covariates are outside the training range. Interpret the forecast with caution.',
  AGE_BELOW_VALIDATED: 'The fire is younger than the growth model’s validated age range.',
  NOT_VALIDATED_REGION:
    'The growth forecast is applied to a region where it has not been validated.',
  FORECAST_EXTRAPOLATES_BEYOND_AGE_36:
    'The supplied forecast extends beyond fire age 36 years, outside the validated age range.',
  LOW_NISAR_COVERAGE: 'NISAR data covers less than 80% of the assessed burn zone.',
  DEFAULT_DNBR: 'Burn severity (dNBR) is missing; the forecast uses the Canada mean.',
  DEFAULT_NBR_PRE: 'Pre-fire NBR is missing; the forecast uses the Canada mean.',
  DEFAULT_ELEV: 'Elevation is missing; the forecast uses the Canada mean.',
  DEFAULT_SLOPE: 'Slope is missing; the forecast uses the Canada mean.',
  DEFAULT_SOIL_CLAY: 'Soil clay content is missing; the forecast uses the Canada mean.',
  DEFAULT_SOIL_SAND: 'Soil sand content is missing; the forecast uses the Canada mean.',
  DEFAULT_SOIL_ORG_C: 'Soil organic carbon is missing; the forecast uses the Canada mean.',
  DEFAULT_DIST_EDGE_M: 'Distance to the fire edge is missing; the forecast uses the Canada mean.',
  [DEVELOPMENT_FIXTURE]:
    'Development fixture. The location is a placeholder and the cells are a synthetic geometric pattern for testing the interface. It contains no satellite observations, measurements or model results, and will be replaced by the team export.',
  MOCK_RESULT:
    'Illustrative mock result. Values were generated locally to test the interface. No satellite observations or trained model were used.',
  AGE_OUT_OF_RANGE:
    'The result flags the fire age as outside the model’s validated range. Interpret its forecast with caution.',
  PARTIAL_CONFIDENCE:
    'Only part of this fire lies where the model was trained. Cells outside that zone are shown grey and carry no estimate.',
  OUT_OF_DOMAIN:
    'This forest is unlike the forests the model was trained on, so the model was not run. Any estimate here would be very inaccurate.',
};

export function warningText(code: string): string {
  return (
    WARNING_TEXT[code] ??
    `The result includes warning ${code.replaceAll('_', ' ').toLowerCase()}. Its meaning needs confirmation from the data provider.`
  );
}
