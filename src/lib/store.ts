"use client";

import { useState, useEffect } from 'react';
import { Task, Project, TaskStatus, TaskPriority } from './types';

const STORAGE_KEY = 'flowboard_data';

interface AppData {
  projects: Project[];
  tasks: Task[];
}

export function useFlowStore() {
  const [data, setData] = useState<AppData>({ projects: [], tasks: [] });
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load store", e);
      }
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data, isInitialized]);

  const addProject = (project: Omit<Project, 'id' | 'createdAt'>) => {
    const newProject: Project = {
      ...project,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    setData(prev => ({
      ...prev,
      projects: [...prev.projects, newProject]
    }));
    return newProject;
  };

  const deleteProject = (id: string) => {
    setData(prev => ({
      projects: prev.projects.filter(p => p.id !== id),
      tasks: prev.tasks.filter(t => t.projectId !== id)
    }));
  };

  const addTask = (task: Partial<Task> & { projectId: string; title: string }) => {
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      projectId: task.projectId,
      title: task.title,
      description: task.description || '',
      notes: task.notes || '',
      status: 'todo',
      priority: task.priority || 'medium',
      startDate: task.startDate,
      dueDate: task.dueDate,
      assignee: task.assignee,
      attachments: task.attachments || [],
      subtasks: task.subtasks || [],
      comments: task.comments || [],
      createdAt: new Date().toISOString(),
    };
    setData(prev => ({
      ...prev,
      tasks: [...prev.tasks, newTask]
    }));
    return newTask;
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
    }));
  };

  const updateTaskStatus = (taskId: string, status: TaskStatus) => {
    updateTask(taskId, { status });
  };

  const deleteTask = (taskId: string) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== taskId)
    }));
  };

  const getProjectWithStats = (project: Project) => {
    const projectTasks = data.tasks.filter(t => t.projectId === project.id);
    const completed = projectTasks.filter(t => t.status === 'done').length;
    return {
      ...project,
      taskCount: projectTasks.length,
      completedCount: completed,
      progress: projectTasks.length > 0 ? (completed / projectTasks.length) * 100 : 0
    };
  };

  return {
    projects: data.projects,
    tasks: data.tasks,
    isInitialized,
    addProject,
    deleteProject,
    addTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    getProjectWithStats
  };
}
