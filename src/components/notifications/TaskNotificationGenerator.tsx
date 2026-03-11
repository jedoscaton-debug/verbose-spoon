
'use client';

import { useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, query, where, getDoc } from 'firebase/firestore';
import { Task, Notification } from '@/lib/types';
import { isSameDay, addDays, isBefore, parseISO, startOfDay } from 'date-fns';

/**
 * TaskNotificationGenerator
 * Background component that scans the user's tasks and generates notifications
 * for overdue, due today, and due soon (next 7 days) events.
 */
export function TaskNotificationGenerator() {
  const { user } = useUser();
  const firestore = useFirestore();
  const processedTasks = useRef<Set<string>>(new Set());

  // Get all tasks assigned to the current user
  const myTasksQuery = useMemoFirebase(() => {
    if (!user?.uid || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'tasks'),
      where('assigneeId', '==', user.uid)
    );
  }, [user?.uid, firestore]);

  const { data: tasks } = useCollection<Task>(myTasksQuery);

  useEffect(() => {
    if (!user || !firestore || !tasks) return;

    const now = new Date();
    const today = startOfDay(now);
    const next7Days = addDays(today, 7);

    tasks.forEach(async (task) => {
      if (!task.dueDate || task.status === 'done') return;

      const dueDate = parseISO(task.dueDate);
      const dueDateStart = startOfDay(dueDate);
      const dateString = dueDateStart.toISOString().split('T')[0];

      let type: 'overdue' | 'due_today' | 'due_soon' | null = null;
      let message = '';
      let title = '';

      if (isBefore(dueDateStart, today)) {
        type = 'overdue';
        title = "Task Overdue";
        message = `Task "${task.title}" is overdue! It was due on ${dateString}.`;
      } else if (isSameDay(dueDateStart, today)) {
        type = 'due_today';
        title = "Task Due Today";
        message = `Task "${task.title}" is due today.`;
      } else if (isBefore(dueDateStart, next7Days)) {
        type = 'due_soon';
        title = "Upcoming Deadline";
        message = `Task "${task.title}" is due soon (${dateString}).`;
      }

      if (type) {
        // Create a unique deterministic ID for this notification to avoid duplicates
        // For overdue, it's just based on the task ID. For due today/soon, it includes the check date.
        const checkKey = type === 'overdue' 
          ? `notif_${type}_${task.id}` 
          : `notif_${type}_${task.id}_${now.toISOString().split('T')[0]}`;

        if (processedTasks.current.has(checkKey)) return;

        const notifRef = doc(firestore, 'users', user.uid, 'notifications', checkKey);
        
        // Check if already exists in Firestore to be safe
        const existing = await getDoc(notifRef);
        if (!existing.exists()) {
          const notification: Notification = {
            id: checkKey,
            title,
            message,
            type: 'task',
            read: false,
            createdAt: now.toISOString(),
            relatedId: task.id
          };
          setDoc(notifRef, notification);
        }
        
        processedTasks.current.add(checkKey);
      }
    });
  }, [tasks, user, firestore]);

  return null;
}
