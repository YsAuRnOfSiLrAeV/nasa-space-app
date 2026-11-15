/**
 * Warning codes the backend sends in result.json (DELIVERABLES tabs 1 and 8): it
 * sends codes only, the texts live here. Unknown codes still show, flagged.
 */
export const DEVELOPMENT_FIXTURE = 'DEVELOPMENT_FIXTURE';

export const WARNING_TEXT: Record<string, string> = {
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
