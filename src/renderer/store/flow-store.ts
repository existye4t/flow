import { create } from 'zustand'
import { FlowItem, Project, SearchResult } from '@shared/types'

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

interface FlowState {
  query: string
  selectedIndex: number
  results: SearchResult[]
  items: FlowItem[]
  recentIds: string[]
  favorites: string[]
  projects: Project[]
  activeProjectId: string | null
  activeTab: 'flows' | 'projects'
  isLoaded: boolean
  isSearching: boolean
  showAddModal: boolean
  editingItem: FlowItem | null

  setQuery: (query: string) => void
  setSelectedIndex: (index: number | ((prev: number) => number)) => void
  setResults: (results: SearchResult[]) => void
  setItems: (items: FlowItem[]) => void
  setRecentIds: (recentIds: string[]) => void
  setFavorites: (favorites: string[]) => void
  setProjects: (projects: Project[]) => void
  setActiveProjectId: (id: string | null) => void
  setActiveTab: (tab: 'flows' | 'projects') => void
  markLoaded: () => void
  addItem: (item: FlowItem) => void
  updateItem: (id: string, updates: Partial<FlowItem>) => void
  deleteItem: (id: string) => void
  toggleFavorite: (id: string) => void
  addRecent: (id: string) => void
  setShowAddModal: (show: boolean) => void
  setEditingItem: (item: FlowItem | null) => void
  resetSearch: () => void

  // Project management
  addProject: (name: string, icon?: string, shortcut?: string) => Project
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  addItemToProject: (projectId: string, itemId: string) => void
  removeItemFromProject: (projectId: string, itemId: string) => void
}

export const useFlowStore = create<FlowState>((set, get) => ({
  query: '',
  selectedIndex: 0,
  results: [],
  items: [],
  recentIds: [],
  favorites: [],
  projects: [],
  activeProjectId: null,
  activeTab: 'flows',
  isLoaded: false,
  isSearching: false,
  showAddModal: false,
  editingItem: null,

  setQuery: (query) => {
    set({ query, selectedIndex: 0 })
    // Search is handled in a debounced effect
  },

  setSelectedIndex: (index) => {
    const value = typeof index === 'function' ? index(get().selectedIndex) : index
    set({ selectedIndex: value })
  },

  setResults: (results) => set({ results }),

  setItems: (items) => set({ items }),

  setRecentIds: (recentIds) => set({ recentIds }),

  setFavorites: (favorites) =>
    set((state) => ({
      favorites,
      // Keep item.favorite flags in sync — favorites[] is the source of truth
      items: state.items.map((item) =>
        item.favorite === favorites.includes(item.id)
          ? item
          : { ...item, favorite: favorites.includes(item.id) }
      ),
    })),

  setProjects: (projects) => set({ projects }),

  setActiveProjectId: (id) =>
    set({
      activeProjectId: id,
      activeTab: id ? 'projects' : get().activeTab,
      selectedIndex: 0,
      query: '',
    }),

  setActiveTab: (tab) =>
    set({
      activeTab: tab,
      activeProjectId: tab === 'flows' ? null : get().activeProjectId,
      selectedIndex: 0,
      query: '',
    }),

  markLoaded: () => set({ isLoaded: true }),

  addItem: (item) => {
    const state = get()
    set({ items: [...state.items, item] })
  },

  updateItem: (id, updates) => {
    const state = get()
    set({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates, updatedAt: Date.now() } : item
      ),
    })
  },

  deleteItem: (id) => {
    const state = get()
    set({
      items: state.items.filter((item) => item.id !== id),
      recentIds: state.recentIds.filter((rid) => rid !== id),
      favorites: state.favorites.filter((fid) => fid !== id),
      // Clean up references in all projects
      projects: state.projects.map((p) => ({
        ...p,
        itemIds: p.itemIds.filter((itemId) => itemId !== id),
      })),
    })
  },

  toggleFavorite: (id) => {
    const current = get().favorites
    const next = current.includes(id)
      ? current.filter((fid) => fid !== id)
      : [id, ...current]
    get().setFavorites(next)
  },

  addRecent: (id) => {
    const state = get()
    const recentIds = [id, ...state.recentIds.filter((rid) => rid !== id)].slice(0, 20)
    set({ recentIds })
  },

  setShowAddModal: (show) => set({ showAddModal: show, editingItem: show ? get().editingItem : null }),

  setEditingItem: (item) => set({ editingItem: item, showAddModal: item !== null }),

  resetSearch: () => set({ query: '', selectedIndex: 0, results: [] }),

  addProject: (name, icon, shortcut) => {
    const newProject: Project = {
      id: generateId(),
      name: name.trim(),
      icon: icon || 'folder',
      shortcut: shortcut?.trim().toLowerCase() || undefined,
      itemIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((state) => ({ projects: [...state.projects, newProject] }))
    return newProject
  },

  updateProject: (id, updates) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      ),
    }))
  },

  deleteProject: (id) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
    }))
  },

  addItemToProject: (projectId, itemId) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p
        if (p.itemIds.includes(itemId)) return p
        return { ...p, itemIds: [...p.itemIds, itemId], updatedAt: Date.now() }
      }),
    }))
  },

  removeItemFromProject: (projectId, itemId) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p
        return { ...p, itemIds: p.itemIds.filter((id) => id !== itemId), updatedAt: Date.now() }
      }),
    }))
  },
}))
