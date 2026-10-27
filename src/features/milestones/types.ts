import type { EventColor } from '../calendar/types'

// A row of public.milestones: a long-term goal with tasks as its steps
export interface Milestone {
  id: string
  title: string
  description: string
  emoji: string
  color: EventColor
  target_date: string | null // yyyy-MM-dd
  achieved_at: string | null
  created_at: string
}

export type MilestoneInput = Pick<Milestone, 'title' | 'description' | 'emoji' | 'color' | 'target_date'>

// A task that is a step towards a milestone
export interface Step {
  id: string
  title: string
  done: boolean
  due_at: string | null
  milestone_id: string
  sort_order: number
}

export const milestoneEmojis = ['🎯', '💻', '🏠', '✈️', '🚗', '🎓', '💪', '💍', '📚', '💰', '🎸', '🏃', '🌱', '👶', '🐶', '🏆']
