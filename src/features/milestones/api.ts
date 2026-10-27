import { supabase } from '../../lib/supabase'
import type { Milestone, MilestoneInput, Step } from './types'

const columns = 'id,title,description,emoji,color,target_date,achieved_at,created_at'
const stepColumns = 'id,title,done,due_at,milestone_id,sort_order'

export async function listMilestones(): Promise<Milestone[]> {
  const { data, error } = await supabase.from('milestones').select(columns).is('deleted_at', null)
  if (error) throw error
  return data as Milestone[]
}

export async function listSteps(): Promise<Step[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(stepColumns)
    .is('deleted_at', null)
    .not('milestone_id', 'is', null)
    .order('sort_order')
  if (error) throw error
  return data as Step[]
}

export async function createMilestone(input: MilestoneInput): Promise<Milestone> {
  const { data, error } = await supabase.from('milestones').insert(input).select(columns).single()
  if (error) throw error
  return data as Milestone
}

export async function updateMilestone(id: string, changes: Partial<MilestoneInput & { achieved_at: string | null }>) {
  const { error } = await supabase.from('milestones').update(changes).eq('id', id)
  if (error) throw error
}

// Soft delete; its steps stay as ordinary tasks
export async function deleteMilestone(id: string) {
  const { error } = await supabase.from('milestones').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
  await supabase.from('tasks').update({ milestone_id: null }).eq('milestone_id', id)
}

// Steps are tasks, filed in a list named after the milestone so they also
// show up on the Tasks page
export async function createStep(milestone: Milestone, title: string): Promise<Step> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ title, list: milestone.title, milestone_id: milestone.id, sort_order: Date.now() })
    .select(stepColumns)
    .single()
  if (error) throw error
  return data as Step
}

export async function setStepDone(id: string, done: boolean) {
  const { error } = await supabase
    .from('tasks')
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}
