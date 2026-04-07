// src/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Hotel, Duration, Employee } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Auth functions
export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Hotel functions
export async function getHotels() {
  const { data, error } = await supabase
    .from('hotels')
    .select(`
      *,
      durations (
        *,
        employees (*)
      )
    `)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Hotel[];
}

export async function createHotel(hotel: Partial<Hotel>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('hotels')
    .insert({ ...hotel, user_id: user.id })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateHotel(id: string, updates: Partial<Hotel>) {
  const { data, error } = await supabase
    .from('hotels')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteHotel(id: string) {
  const { error } = await supabase.from('hotels').delete().eq('id', id);
  if (error) throw error;
}

// Duration functions
export async function createDuration(duration: Partial<Duration>) {
  const { data, error } = await supabase
    .from('durations')
    .insert(duration)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateDuration(id: string, updates: Partial<Duration>) {
  const { data, error } = await supabase
    .from('durations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteDuration(id: string) {
  const { error } = await supabase.from('durations').delete().eq('id', id);
  if (error) throw error;
}

// Employee functions
export async function createEmployee(employee: Partial<Employee> & { durationId: string; slotIndex: number }) {
  const { data, error } = await supabase
    .from('employees')
    .insert(employee)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateEmployee(id: string, updates: Partial<Employee>) {
  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
}
