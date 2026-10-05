import React, { useState } from 'react'
import { useFlowStore } from '@renderer/store/flow-store'
import { FlowItem, Project } from '@shared/types'
import { IconGlyph } from '@renderer/utils/icons'
import { isValidShortcutInput, formatBadgeShortcut } from '@renderer/utils/platform'
import { useSettings } from '@renderer/store/settings-store'
import ConfirmDialog from './ConfirmDialog'
import ShortcutRecorder from './ShortcutRecorder'
import SetShortcutModal from './SetShortcutModal'

interface ProjectsViewProps {
  onSelectFlowItem: (item: FlowItem) => void
  onOpenAddFlow: () => void
}

export default function ProjectsView({ onSelectFlowItem, onOpenAddFlow }: ProjectsViewProps) {
  const projects = useFlowStore((s) => s.projects)
  const activeProjectId = useFlowStore((s) => s.activeProjectId)
  const setActiveProjectId = useFlowStore((s) => s.setActiveProjectId)
  const addProject = useFlowStore((s) => s.addProject)
  const updateProject = useFlowStore((s) => s.updateProject)
  const deleteProject = useFlowStore((s) => s.deleteProject)
  const removeItemFromProject = useFlowStore((s) => s.removeItemFromProject)
  const addItemToProject = useFlowStore((s) => s.addItemToProject)
  const items = useFlowStore((s) => s.items)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [showAddExistingModal, setShowAddExistingModal] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [projectForShortcut, setProjectForShortcut] = useState<Project | null>(null)

  // Project form state
  const [projName, setProjName] = useState('')
  const [projShortcut, setProjShortcut] = useState('')
  const [projShortcutError, setProjShortcutError] = useState<string | null>(null)

  const activeProject = projects.find((p) => p.id === activeProjectId) || null

  const itemsById = new Map(items.map((i) => [i.id, i]))
  const activeProjectItems = activeProject
    ? activeProject.itemIds
        .map((id) => itemsById.get(id))
        .filter((item): item is FlowItem => Boolean(item))
    : []

  const handleOpenCreate = () => {
    setEditingProject(null)
    setProjName('')
    setProjShortcut('')
    setProjShortcutError(null)
    setShowCreateModal(true)
  }

  const handleOpenEdit = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingProject(project)
    setProjName(project.name)
    setProjShortcut(project.shortcut || '')
    setProjShortcutError(null)
    setShowCreateModal(true)
  }

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!projName.trim()) return

    const shortcutVal = projShortcut.trim().toLowerCase()
    if (shortcutVal) {
      if (!isValidShortcutInput(shortcutVal)) {
        setProjShortcutError('Use a valid combo like ctrl+alt+d')
        return
      }

      // Check collision with other projects or items
      const conflictProj = projects.find(
        (p) => p.id !== editingProject?.id && p.shortcut?.toLowerCase() === shortcutVal
      )
      if (conflictProj) {
        setProjShortcutError(`Already used by project "${conflictProj.name}"`)
        return
      }

      const conflictItem = items.find((i) => i.shortcut?.toLowerCase() === shortcutVal)
      if (conflictItem) {
        setProjShortcutError(`Already used by flow item "${conflictItem.name}"`)
        return
      }

      const currentSettings = useSettings.getState()
      if (
        shortcutVal === currentSettings.globalShortcut.toLowerCase() ||
        shortcutVal === currentSettings.settingsShortcut.toLowerCase() ||
        shortcutVal === currentSettings.actionShortcut.toLowerCase() ||
        shortcutVal === currentSettings.screenshotShortcut.toLowerCase()
      ) {
        setProjShortcutError('Conflicts with an existing system shortcut')
        return
      }
    }

    if (editingProject) {
      updateProject(editingProject.id, {
        name: projName.trim(),
        shortcut: shortcutVal || undefined,
      })
    } else {
      const created = addProject(projName.trim(), 'folder', shortcutVal)
      setActiveProjectId(created.id)
    }

    setShowCreateModal(false)
  }

  const handleDeleteProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const p = projects.find((x) => x.id === projectId)
    if (!p) return
    setProjectToDelete(p)
  }

  const confirmDeleteProject = () => {
    if (!projectToDelete) return
    deleteProject(projectToDelete.id)
    setProjectToDelete(null)
  }

  // Items eligible to be added to this project (not already in it)
  const availableItems = activeProject
    ? items.filter((i) => !activeProject.itemIds.includes(i.id))
    : []

  return (
    <div className="flex h-full flex-col overflow-hidden px-4 select-none">
      {/* Active Project Detail View */}
      {activeProject ? (
        <div className="flex h-full flex-col overflow-hidden">
          {/* Top Bar inside Project */}
          <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveProjectId(null)}
                className="flex items-center gap-1 text-xs text-flow-muted hover:text-flow-primary transition-colors cursor-pointer"
              >
                <span>←</span>
                <span>All Projects</span>
              </button>
              <span className="text-white/20">/</span>
              <span className="text-xs font-semibold text-flow-primary">{activeProject.name}</span>
              {activeProject.shortcut ? (
                <button
                  type="button"
                  onClick={() => setProjectForShortcut(activeProject)}
                  className="rounded bg-white/10 hover:bg-white/15 px-1.5 py-0.5 font-mono text-[10px] text-flow-secondary hover:text-flow-primary transition-colors cursor-pointer"
                  title="Change project shortcut"
                >
                  {activeProject.shortcut}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setProjectForShortcut(activeProject)}
                  className="rounded border border-dashed border-white/20 hover:border-white/40 px-1.5 py-0.5 text-[10px] text-flow-muted hover:text-flow-primary transition-colors cursor-pointer"
                  title="Assign global shortcut"
                >
                  + Add Shortcut
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowAddExistingModal(true)}
                className="flex items-center gap-1 rounded bg-white/[0.06] hover:bg-white/10 px-2 py-1 text-[11px] text-flow-secondary hover:text-flow-primary transition-colors cursor-pointer"
              >
                <span>+</span>
                <span>Add Existing Flow</span>
              </button>
              <button
                type="button"
                onClick={onOpenAddFlow}
                className="flex items-center gap-1 rounded bg-white/[0.06] hover:bg-white/10 px-2 py-1 text-[11px] text-flow-secondary hover:text-flow-primary transition-colors cursor-pointer"
              >
                <span>+</span>
                <span>New Flow</span>
              </button>
            </div>
          </div>

          {/* Project Items List */}
          <div className="flex-1 overflow-y-auto pt-2">
            {activeProjectItems.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center">
                <p className="text-xs text-flow-muted mb-2">No items in this project yet</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddExistingModal(true)}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    Add Existing Flow
                  </button>
                  <button
                    type="button"
                    onClick={onOpenAddFlow}
                    className="rounded bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs text-flow-primary transition-colors cursor-pointer"
                  >
                    Create New Flow
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {activeProjectItems.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-flow-hover transition-colors"
                  >
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => onSelectFlowItem(item)}
                    >
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-flow-bg-elevated border border-flow-border">
                        <IconGlyph name={item.type === 'website' ? 'globe' : 'app'} size={14} className="text-flow-muted" />
                      </div>
                      <div className="truncate min-w-0">
                        <div className="text-[13px] font-medium text-flow-primary leading-tight truncate">
                          {item.name}
                        </div>
                        {item.description && (
                          <div className="text-[11px] text-flow-muted leading-tight truncate mt-0.5">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.shortcut && (
                        <kbd className="flex-shrink-0 inline-flex items-center rounded-[4px] border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] font-medium leading-none text-flow-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                          {formatBadgeShortcut(item.shortcut)}
                        </kbd>
                      )}
                      <button
                        type="button"
                        onClick={() => removeItemFromProject(activeProject.id, item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-flow-muted hover:text-red-400 transition-opacity"
                        title="Remove from project"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 3l6 6M9 3l-6 6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Project Directory List View */
        <div className="flex h-full flex-col overflow-hidden">
          {/* Header Row */}
          <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
            <div>
              <h2 className="text-xs font-semibold text-flow-primary">Workspaces & Projects</h2>
              <p className="text-[11px] text-flow-muted">Organize your flows into dedicated workspaces</p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-1 rounded bg-white/[0.08] hover:bg-white/15 px-2.5 py-1 text-xs font-medium text-flow-primary transition-colors cursor-pointer border border-white/[0.06]"
            >
              <span>+</span>
              <span>New Project</span>
            </button>
          </div>

          {/* Project Cards / List */}
          <div className="flex-1 overflow-y-auto py-2">
            {projects.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center">
                <p className="text-xs text-flow-muted mb-3">No projects yet</p>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="btn-primary text-xs px-3.5 py-1.5"
                >
                  Create your first Project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1.5">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => setActiveProjectId(proj.id)}
                    className="group flex items-center justify-between rounded-lg border border-flow-border bg-flow-surface px-3 py-2.5 hover:bg-flow-hover hover:border-flow-border-strong transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-flow-bg-elevated border border-flow-border">
                        <IconGlyph name="folder" size={15} className="text-flow-muted group-hover:text-flow-secondary" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-flow-primary leading-tight truncate">
                          {proj.name}
                        </div>
                        <div className="text-[11px] text-flow-muted leading-tight mt-0.5">
                          {proj.itemIds.length} {proj.itemIds.length === 1 ? 'item' : 'items'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {proj.shortcut ? (
                        <button
                          type="button"
                          onClick={() => setProjectForShortcut(proj)}
                          className="rounded bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] px-2 py-0.5 font-mono text-[10px] text-flow-secondary hover:text-flow-primary transition-colors cursor-pointer"
                          title="Click to change shortcut"
                        >
                          {formatBadgeShortcut(proj.shortcut)}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setProjectForShortcut(proj)}
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 rounded border border-dashed border-white/20 hover:border-white/40 bg-white/[0.02] hover:bg-white/[0.06] px-2 py-0.5 text-[10px] text-flow-muted hover:text-flow-primary transition-all cursor-pointer"
                          title="Assign shortcut"
                        >
                          <span className="text-[9px]">+</span>
                          <span>Shortcut</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(proj, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-flow-muted hover:text-flow-primary hover:bg-white/10 transition-all cursor-pointer"
                        title="Edit project"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteProject(proj.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-flow-muted hover:text-red-400 hover:bg-white/10 transition-all cursor-pointer"
                        title="Delete project"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 3l6 6M9 3l-6 6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: New / Edit Project */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 modal-backdrop"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-[360px] rounded-xl border border-flow-border bg-flow-surface p-4 shadow-flow-modal modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-flow-primary mb-3">
              {editingProject ? 'Edit Project' : 'New Project'}
            </h3>
            <form onSubmit={handleSaveProject} className="space-y-3">
              <div>
                <label className="block text-[11px] text-flow-muted mb-1">Project Name</label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="e.g. Development, Gaming, School"
                  className="input-base py-1.5 text-xs w-full"
                />
              </div>

              <div>
                <label className="block text-[11px] text-flow-muted mb-1">
                  Global Shortcut (optional)
                </label>
                <ShortcutRecorder
                  value={projShortcut}
                  onChange={(val) => {
                    setProjShortcutError(null)
                    setProjShortcut(val)
                  }}
                  hasError={Boolean(projShortcutError)}
                  widthClass="w-full"
                  placeholder="Click to record (e.g. Ctrl + Alt + D)"
                />
                {projShortcutError ? (
                  <p className="mt-1 text-[11px] text-red-400">{projShortcutError}</p>
                ) : (
                  <p className="mt-1 text-[10px] text-flow-muted">
                    Pressing this shortcut opens Flow focused directly on this workspace
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded px-3 py-1.5 text-xs text-flow-muted hover:text-flow-secondary transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs px-3.5 py-1.5">
                  {editingProject ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Existing Flow Item to Project */}
      {showAddExistingModal && activeProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 modal-backdrop"
          onClick={() => setShowAddExistingModal(false)}
        >
          <div
            className="w-[380px] max-h-[70vh] flex flex-col rounded-xl border border-flow-border bg-flow-surface p-4 shadow-flow-modal modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-flow-primary">
                Add Flow to {activeProject.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddExistingModal(false)}
                className="text-flow-muted hover:text-flow-primary text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {availableItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-flow-muted">
                  All your flows are already in this project
                </div>
              ) : (
                availableItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      addItemToProject(activeProject.id, item.id)
                      setShowAddExistingModal(false)
                    }}
                    className="flex items-center justify-between rounded-md p-2 hover:bg-flow-hover cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-flow-bg-elevated border border-flow-border">
                        <IconGlyph name={item.type === 'website' ? 'globe' : 'app'} size={12} className="text-flow-muted" />
                      </div>
                      <span className="text-xs text-flow-primary truncate">{item.name}</span>
                    </div>
                    <span className="text-[10px] text-flow-muted uppercase tracking-wider">{item.type}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Project Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(projectToDelete)}
        title={`Delete project "${projectToDelete?.name}"?`}
        description="This will remove the project but won't delete its flows. Flow items remain available in All Flows."
        confirmText="Delete"
        cancelText="Cancel"
        danger
        onConfirm={confirmDeleteProject}
        onCancel={() => setProjectToDelete(null)}
      />

      {/* Modal: Set Project Shortcut */}
      <SetShortcutModal
        isOpen={Boolean(projectForShortcut)}
        title={`Shortcut for "${projectForShortcut?.name}"`}
        subtitle="Global shortcut to summon Exist Flow focused directly on this workspace."
        initialShortcut={projectForShortcut?.shortcut}
        targetId={projectForShortcut?.id || ''}
        targetType="project"
        onSave={async (newShortcut) => {
          if (projectForShortcut) {
            updateProject(projectForShortcut.id, { shortcut: newShortcut })
            const state = useFlowStore.getState()
            const updatedProjects = state.projects.map((p) =>
              p.id === projectForShortcut.id ? { ...p, shortcut: newShortcut, updatedAt: Date.now() } : p
            )
            await window.electron?.store.set('flow-data', {
              items: state.items,
              recentIds: state.recentIds,
              favorites: state.favorites,
              projects: updatedProjects,
            })
            await window.electron?.shortcuts.sync()
          }
          setProjectForShortcut(null)
        }}
        onClose={() => setProjectForShortcut(null)}
      />
    </div>
  )
}
