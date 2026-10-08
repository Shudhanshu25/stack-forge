import { useEffect, useState } from 'react';
import type { IndustryTemplate } from '@stackforge/shared';
import { startupApi } from '../api/endpoints';

export function useTemplates(): { templates: IndustryTemplate[]; error: string | null } {
  const [templates, setTemplates] = useState<IndustryTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    startupApi
      .templates()
      .then(setTemplates)
      .catch(() => setError('Could not load industry templates'));
  }, []);
  return { templates, error };
}
