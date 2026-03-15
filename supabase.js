// =============================================
//  Supabase Client — compartilhado por todo o site
// =============================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://frlaurisjqqaivkfnxfk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZybGF1cmlzanFxYWl2a2ZueGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTA3NTQsImV4cCI6MjA4OTE4Njc1NH0.HsmpSuR906KbEY5Shm2TjLeWAc7vvNLRLkTGNB7iHdI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
