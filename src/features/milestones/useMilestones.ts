import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { createMilestone, createStep, deleteMilestone, listMilestones, listSteps, setStepDone, updateMilestone } from './api'
import type { Milestone, MilestoneInput, Step } from './types'

// Milestones and their steps, kept live. Edits show at once and roll back by
// reloading if the server refuses them.
export function useMilestones() {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [ms, ss] = await Promise.all([listMilestones(), listSteps()])
      setMilestones(ms)
      setSteps(ss)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load milestones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const channel = supabase
      .channel('milestones-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones' }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => reload())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [reload])

  const guard = useCallback(
    async (work: Promise<unknown>) => {
      try {
        await work
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save')
        await reload()
      }
    },
    [reload],
  )

  const add = useCallback(async (input: MilestoneInput) => {
    const m = await createMilestone(input)
    setMilestones((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m]))
  }, [])

  const edit = useCallback(
    (id: string, changes: Partial<MilestoneInput & { achieved_at: string | null }>) => {
      setMilestones((ms) => ms.map((m) => (m.id === id ? { ...m, ...changes } : m)))
      return guard(updateMilestone(id, changes))
    },
    [guard],
  )

  const remove = useCallback(
    (id: string) => {
      setMilestones((ms) => ms.filter((m) => m.id !== id))
      setSteps((ss) => ss.filter((s) => s.milestone_id !== id))
      return guard(deleteMilestone(id))
    },
    [guard],
  )

  const addStep = useCallback(async (milestone: Milestone, title: string) => {
    const step = await createStep(milestone, title)
    setSteps((ss) => (ss.some((s) => s.id === step.id) ? ss : [...ss, step]))
  }, [])

  const toggleStep = useCallback(
    (step: Step) => {
      setSteps((ss) => ss.map((s) => (s.id === step.id ? { ...s, done: !s.done } : s)))
      return guard(setStepDone(step.id, !step.done))
    },
    [guard],
  )

  return { milestones, steps, loading, error, reload, add, edit, remove, addStep, toggleStep }
}
