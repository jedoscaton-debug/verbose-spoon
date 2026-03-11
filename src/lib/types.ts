
export type TaskStatus = string;
export type TaskPriority = 'low' | 'medium' | 'high';
export type ProjectVisibility = 'private' | 'workspace';
export type NotificationType = 'info' | 'invite' | 'task' | 'alert';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'Admin' | 'Member';
  createdAt: string;
  updatedAt: string;
  invitedById?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  relatedId?: string;
}

export interface Invitation {
  id: string;
  email: string;
  inviterId: string;
  inviterEmail?: string;
  projectId?: string; 
  status: 'Pending' | 'Accepted' | 'Expired' | 'Revoked';
  createdAt: any;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  createdAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Comment {
  id: string;
  text: string;
  createdAt: string;
  userName: string;
}

export interface TimeEntry {
  id: string;
  hours: number;
  rate?: number;
  amount?: number;
  date: string;
  description?: string;
}

export interface List {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  creatorId: string;
}

export interface Task {
  id: string;
  projectId: string;
  listId: string;
  title: string;
  description: string;
  notes?: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate?: string;
  dueDate?: string;
  assignee?: string;
  assigneeId?: string;
  attachments: Attachment[];
  subtasks: Subtask[];
  comments: Comment[];
  timeEntries?: TimeEntry[];
  createdAt: string;
  projectOwnerId: string;
  creatorId: string;
  visibility: ProjectVisibility;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  ownerId: string; 
  creatorId: string; 
  visibility: ProjectVisibility;
}

export interface StatusConfig {
  id: string;
  label: string;
  value: string;
  color: string;
  order: number;
  isDone?: boolean;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
  read: boolean;
  participants: string[];
}
