import { ApiError } from '../api/client';
import { simulationApi } from '../api/endpoints';
import { useToast } from '../components/feedback/Toaster';

export type ReportFormat = 'csv' | 'json' | 'pdf';
export const REPORT_FORMATS: ReportFormat[] = ['csv', 'json', 'pdf'];

/** Downloads a simulation report and says so (or why not) in a toast. */
export function useReportExport(simulationId: string | null) {
  const { notify } = useToast();
  return async (format: ReportFormat) => {
    if (!simulationId) return;
    const name = format.toUpperCase();
    try {
      await simulationApi.report(simulationId, format);
      notify({ kind: 'success', title: `${name} report ready`, body: 'Saved to your downloads.' });
    } catch (err) {
      notify({
        kind: 'error',
        title: `The ${name} report could not be exported`,
        body: err instanceof ApiError ? err.message : 'Check your connection and try again.',
      });
    }
  };
}
