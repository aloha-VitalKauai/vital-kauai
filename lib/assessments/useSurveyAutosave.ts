import { useCallback, useEffect, useRef, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutosaveOptions {
  supabase:      SupabaseClient;
  assessmentId:  string;
  authUserId:    string;
  isReadOnly:    boolean;
  debounceMs?:   number;
}

interface AutosaveReturn {
  saveStatus:     SaveStatus;
  updateResponse: (field: string, value: unknown) => void;
  flushSave:      () => Promise<void>;
}

export function useSurveyAutosave({
  supabase,
  assessmentId,
  authUserId,
  isReadOnly,
  debounceMs = 1500,
}: AutosaveOptions): AutosaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const pendingRef   = useRef<Record<string, unknown>>({});
  const isDirtyRef   = useRef(false);
  const isSavingRef  = useRef(false);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSave = useCallback(async () => {
    if (!isDirtyRef.current || isSavingRef.current || isReadOnly) return;
    if (Object.keys(pendingRef.current).length === 0) return;

    isSavingRef.current = true;
    setSaveStatus('saving');

    const toSave = { ...pendingRef.current };
    pendingRef.current = {};

    try {
      const { error } = await supabase
        .from('outcome_assessments')
        .update({
          ...toSave,
          last_saved_at: new Date().toISOString(),
        })
        .eq('id', assessmentId)
        .eq('member_id', authUserId);

      if (error) throw error;

      isDirtyRef.current = Object.keys(pendingRef.current).length > 0;
      setSaveStatus('saved');

      setTimeout(() => {
        if (!isDirtyRef.current) setSaveStatus('idle');
      }, 3000);

    } catch (err) {
      console.error('[Autosave]', err);
      pendingRef.current = { ...toSave, ...pendingRef.current };
      isDirtyRef.current = true;
      setSaveStatus('error');
    } finally {
      isSavingRef.current = false;
    }
  }, [supabase, assessmentId, authUserId, isReadOnly]);

  const updateResponse = useCallback((field: string, value: unknown) => {
    if (isReadOnly) return;
    pendingRef.current[field] = value;
    isDirtyRef.current = true;
    setSaveStatus('idle');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(performSave, debounceMs);
  }, [isReadOnly, performSave, debounceMs]);

  const flushSave = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await performSave();
  }, [performSave]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'hidden' && isDirtyRef.current) {
        flushSave();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [flushSave]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        flushSave();
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [flushSave]);

  return { saveStatus, updateResponse, flushSave };
}
