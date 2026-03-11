"use client";

import { useState } from 'react';
import { Sparkles, Loader2, Plus, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { refineTask } from '@/ai/flows/ai-task-refiner-tool';
import { useToast } from '@/hooks/use-toast';

interface TaskRefinerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectContext?: string;
  onSubtasksGenerated: (subtasks: string[], originalDescription: string) => void;
}

export function TaskRefinerModal({ isOpen, onClose, projectContext, onSubtasksGenerated }: TaskRefinerModalProps) {
  const [taskDescription, setTaskDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSubtasks, setGeneratedSubtasks] = useState<string[]>([]);
  const { toast } = useToast();

  const handleRefine = async () => {
    if (!taskDescription.trim()) return;

    setIsGenerating(true);
    try {
      const result = await refineTask({
        taskDescription,
        projectContext
      });
      setGeneratedSubtasks(result.subTasks);
    } catch (error) {
      toast({
        title: "AI Error",
        description: "Failed to refine task. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddTasks = () => {
    onSubtasksGenerated(generatedSubtasks, taskDescription);
    setGeneratedSubtasks([]);
    setTaskDescription('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="text-accent h-5 w-5 fill-accent" />
            <DialogTitle className="text-primary">AI Task Refiner</DialogTitle>
          </div>
          <DialogDescription>
            Describe a complex task and FlowBoard AI will break it down into actionable sub-tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Textarea
              placeholder="e.g., 'Launch the new marketing campaign for summer products'"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {generatedSubtasks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Check className="h-4 w-4" /> Suggested Sub-tasks
              </h4>
              <div className="bg-secondary/20 rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto">
                {generatedSubtasks.map((task, idx) => (
                  <div key={idx} className="text-sm flex items-start gap-2 p-2 rounded bg-card border">
                    <span className="font-mono text-xs mt-0.5 text-primary/60">{idx + 1}.</span>
                    {task}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {generatedSubtasks.length === 0 ? (
            <Button 
              onClick={handleRefine} 
              disabled={isGenerating || !taskDescription}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Task...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Refine Task
                </>
              )}
            </Button>
          ) : (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setGeneratedSubtasks([])} className="flex-1">
                Try Again
              </Button>
              <Button onClick={handleAddTasks} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="mr-2 h-4 w-4" />
                Add to Project
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}