import { pause } from './AnalysisClient';
import type { Run } from './contracts';

export async function simulateAnalysis(
  signal: AbortSignal,
  fail: boolean,
  update: (run: Run) => void,
): Promise<Run> {
  for (let index = 0; index < 3; index++) {
    update({
      status: 'pending',
      id: 'development',
      step: index === 0 ? 'Checking development fixture' : 'Simulating processing',
      progress: index / 3,
    });
    await pause(600, signal);
  }
  return fail
    ? { status: 'failed', code: 'MOCK_FAILURE', message: 'Simulated development failure.' }
    : { status: 'complete', result: 'https://development.invalid/fixture' };
}
