//
// page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import tasksData from '../../lib/tasks.json';
import { FaSmile, FaMeh, FaFrown } from 'react-icons/fa';

//
// Interfaces
//
interface Task {
  id: number;
  description: string;
  category?: string;
  // Optional difficulty; if missing, default to "medium"
  difficulty?: string;
}

export interface GeneratedTask extends Task {
  created_at?: string;
  duration?: string;
  proof_url?: string;
  comment?: string;
  status?: string; // e.g. 'pending', 'completed'
  // Extra columns:
  assigned_by?: string;
  points?: number;
}

interface Profile {
  user_id: string;
  username?: string;
  avatar_url?: string;
}

//
// Difficulty Icon Component
//
function DifficultyIcon({ difficulty }: { difficulty: string }) {
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return <FaSmile className="h-16 w-16 text-green-400 animate-bounce" />;
    case 'medium':
      return <FaMeh className="h-16 w-16 text-yellow-400 animate-pulse" />;
    case 'hard':
      return <FaFrown className="h-16 w-16 text-red-400 animate-pulse" />;
    default:
      return <FaMeh className="h-16 w-16 text-yellow-400 animate-pulse" />;
  }
}

//
// Points Mapping: easy = 25, medium = 50, hard = 75
//
const difficultyPoints: Record<string, number> = {
  easy: 25,
  medium: 50,
  hard: 75,
};

//
// Main Component
//
export default function MyTasksPage() {
  const router = useRouter();

  // Task generator state
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string>('');

  // Accepted (generated) tasks state – these come from the GeneratedTasks table.
  const [acceptedTasks, setAcceptedTasks] = useState<GeneratedTask[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Modal state for completing a task.
  const [showCompleteModal, setShowCompleteModal] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<GeneratedTask | null>(null);
  const [completeComment, setCompleteComment] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [completing, setCompleting] = useState<boolean>(false);

  // Modal state for assigning a task.
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [friends, setFriends] = useState<Profile[]>([]);

  // (Optional) Delete confirmation modal state.
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [taskToDelete, setTaskToDelete] = useState<GeneratedTask | null>(null);

  // On mount, get current session and load accepted tasks.
  useEffect(() => {
    const init = async () => {
      // Check for an existing user session.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        // If there is no session, redirect to the sign-in page.
        router.push('/signin');
        return;
      }
      // If session exists, continue to load the user's tasks.
      const userId = sessionData.session.user.id;
      setCurrentUserId(userId);
      await fetchAcceptedTasks(userId);
    };
    init();
  }, [router]);

  // Fetch accepted tasks from GeneratedTasks table.
  const fetchAcceptedTasks = async (userId: string) => {
    const { data, error } = await supabase
      .from('GeneratedTasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setAcceptedTasks(data || []);
    }
  };

  // Fetch friend profiles (all profiles except the current user).
  const fetchFriends = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url')
      .neq('user_id', userId);
    if (error) {
      setError(error.message);
    } else {
      setFriends(data || []);
    }
  };

  // Randomly pick a task from the local JSON.
  const fetchRandomTask = () => {
    setError(null);
    if (!tasksData || tasksData.length === 0) {
      setError("No tasks available");
      return;
    }
    const randomTask: Task = tasksData[Math.floor(Math.random() * tasksData.length)];
    if (!randomTask.difficulty) {
      randomTask.difficulty = "medium";
    }
    setTask(randomTask);
  };

  // When user declines a task, simply fetch a new one.
  const handleDecline = () => {
    fetchRandomTask();
  };

  // When user accepts a task for themselves, insert it into the GeneratedTasks table with assigned_by set to "application".
  const handleAccept = async () => {
    if (!task) return;
    setError(null);
    try {
      if (!currentUserId) throw new Error("User not found");
      const points = difficultyPoints[task.difficulty.toLowerCase()] || 0;
      const { error } = await supabase
        .from('GeneratedTasks')
        .insert([
          {
            user_id: currentUserId,
            task_description: task.description,
            category: task.category || null,
            duration: '',       // Empty initially; to be updated when completed
            proof_url: null,    // Empty initially
            comment: '',        // Empty initially
            status: 'pending',  // Default status
            difficulty: task.difficulty,
            assigned_by: 'application',
            points, // Points inserted
          },
        ]);
      if (error) throw error;
      setToast("Task accepted and saved!");
      await fetchAcceptedTasks(currentUserId);
      setTask(null);
    } catch (err: any) {
      setError(err.message || "Error saving task");
    }
  };

  // When user clicks "Assign Task", fetch friend profiles and open the assign modal.
  const handleAssign = async () => {
    if (!task) return;
    if (!currentUserId) {
      setError("User not found");
      return;
    }
    await fetchFriends(currentUserId);
    setShowAssignModal(true);
  };

  // When a friend is selected, assign the task to that friend.
  // The new record will have:
  // • user_id set to the friend’s ID (so the task belongs to that friend)
  // • assigned_by set to the current user’s ID (the assigner)
  // Then a notification is sent to the friend.
  const handleAssignToFriend = async (friendId: string) => {
    setError(null);
    try {
      if (!currentUserId) throw new Error("User not found");
      if (!task) throw new Error("No task generated");
      const points = difficultyPoints[task.difficulty.toLowerCase()] || 0;
      const { error } = await supabase
        .from('GeneratedTasks')
        .insert([
          {
            user_id: friendId, // Task belongs to friend.
            task_description: task.description,
            category: task.category || null,
            duration: '',
            proof_url: null,
            comment: '',
            status: 'pending',
            difficulty: task.difficulty,
            assigned_by: currentUserId, // Current user is assigner.
            points, // Points inserted
          },
        ]);
      if (error) throw error;
      setToast("Task assigned to friend successfully!");
      // Send a notification to the friend.
      const notifPayload = {
        user_id: friendId,
        sender_id: currentUserId,
        message: `You have been assigned a new generated task: "${task.description}" by your friend.`,
        is_read: false,
      };
      await supabase.from('notifications').insert([notifPayload]);
      setTask(null);
      setShowAssignModal(false);
      await fetchAcceptedTasks(currentUserId);
    } catch (err: any) {
      setError(err.message || "Error assigning task to friend");
    }
  };

  // Handler for opening the complete task modal.
  const handleOpenCompleteModal = (genTask: GeneratedTask) => {
    setSelectedTask(genTask);
    // Reset modal fields.
    setCompleteComment('');
    setProofFile(null);
    setShowCompleteModal(true);
  };

  // Handle file input change for proof upload.
  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setProofFile(e.target.files[0]);
    }
  };

  // Handler to complete (or resubmit) a task.
  // The duration is computed automatically as the elapsed time (in minutes) since the task was created.
  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setCompleting(true);
    let proofUrl = selectedTask.proof_url || null;
    if (proofFile) {
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('task-proofs')
        .upload(fileName, proofFile);
      if (uploadError) {
        setToast(`Upload error: ${uploadError.message}`);
        setCompleting(false);
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from('task-proofs').getPublicUrl(fileName);
      proofUrl = publicUrl;
    }
    // Compute duration automatically: difference (in minutes) between now and when the task was created.
    const now = new Date();
    const created = new Date(selectedTask.created_at!); // non-null assertion as created_at should exist
    const diffMs = now.getTime() - created.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const computedDuration = `${diffMinutes} minutes`;

    const { error } = await supabase
      .from('GeneratedTasks')
      .update({
        duration: computedDuration,
        comment: completeComment,
        proof_url: proofUrl,
        status: 'completed',
      })
      .eq('id', selectedTask.id);
    if (error) {
      setToast(`Error: ${error.message}`);
    } else {
      setToast('Task completed successfully!');
      await fetchAcceptedTasks(currentUserId);
      setShowCompleteModal(false);
      setSelectedTask(null);
    }
    setCompleting(false);
  };

  // Auto-hide toast notifications.
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handler for "View All My Tasks" button.
  const handleViewAll = () => {
    router.push('/mytasks');
  };

  // Utility: Render a gamified card for an accepted task.
  const TaskCard = ({ t }: { t: GeneratedTask }) => {
    const cardClass =
      t.status?.toLowerCase() === 'completed'
        ? 'bg-gradient-to-r from-green-500 to-green-600 border border-green-300'
        : 'bg-gradient-to-r from-indigo-600 to-purple-600';
    return (
      <div
        key={t.id}
        className={`card lg:card-side ${cardClass} shadow-xl cursor-pointer transform hover:scale-105 transition-all duration-300 p-4 rounded-xl`}
        onClick={() => router.push(`/mytasks/generated/${t.id}`)}
      >
        <div className="card-body">
          <h2 className="card-title text-2xl font-bold text-base-content">
            {t.task_description}
          </h2>
          {t.category && (
            <p className="text-lg text-base-content">Category: {t.category}</p>
          )}
          <p className="text-lg text-base-content">Status: {t.status}</p>
          <div className="flex justify-end mt-2 space-x-2">
            {t.status?.toLowerCase() === 'pending' && (
              <>
                <button
                  className="btn btn-xs btn-info"
                  onClick={() => handleOpenCompleteModal(t)}
                >
                  Complete
                </button>
                <button
                  className="btn btn-xs btn-warning"
                  onClick={() => {
                    /* (Optional) open delete confirmation */
                  }}
                >
                  Delete
                </button>
              </>
            )}
            {t.status?.toLowerCase() === 'completed' && (
              <button
                className="btn btn-xs btn-info"
                onClick={() => handleOpenCompleteModal(t)}
              >
                Update Proof
              </button>
            )}
          </div>
          {/* Points Badge */}
          {t.points !== undefined && (
            <div className="mt-2">
              <span className="badge badge-warning text-sm">
                Points: {t.points}
              </span>
            </div>
          )}
          {t.comment && t.comment.trim() !== "" && (
            <div className="mt-2">
              <span className="font-bold text-accent">Comment:</span> {t.comment}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 flex flex-col items-center bg-base-200 text-base-content">
      <div className="max-w-4xl w-full mx-auto space-y-10">
        <h1 className="text-4xl font-extrabold text-center mb-8">I'm Bored App</h1>

        {/* Task Generator Section */}
        <div className="card max-w-xl w-full bg-base-100 shadow-2xl rounded-xl p-8 transform hover:scale-105 transition-transform duration-300 mb-8 mx-auto">
          <h1 className="text-4xl font-bold text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
            I'm Bored - Task Generator
          </h1>
          <p className="text-center text-lg mb-6">
            Feeling bored? Generate a fun task to spark your creativity!
          </p>
          {/* If no task exists, show the Generate Task button */}
          {!task && (
            <div className="flex justify-center">
              <button 
                onClick={fetchRandomTask} 
                className="btn btn-primary btn-sm px-6 py-2 transition-colors duration-300"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Generate Task'}
              </button>
            </div>
          )}
          {/* When a task is generated, show its card with action buttons */}
          {task && (
            <div className="mt-6 p-4 border border-base-300 rounded-lg bg-base-100 bg-opacity-80">
              <h2 className="text-2xl font-semibold mb-2">Task:</h2>
              <p className="text-lg">{task.description}</p>
              {task.category && (
                <p className="mt-2">Category: {task.category}</p>
              )}
              <div className="mt-4 flex items-center space-x-2">
                <DifficultyIcon difficulty={task.difficulty} />
                <span className="badge badge-warning text-sm">
                  Points: {difficultyPoints[task.difficulty!.toLowerCase()] || 0}
                </span>
              </div>
              {/* Action Buttons */}
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button 
                  onClick={handleDecline} 
                  className="btn btn-secondary btn-sm w-full"
                >
                  Decline
                </button>
                <button 
                  onClick={handleAccept} 
                  className="btn btn-success btn-sm w-full"
                >
                  Accept
                </button>
                <button 
                  onClick={handleAssign} 
                  className="btn btn-info btn-sm w-full"
                >
                  Assign
                </button>
              </div>
            </div>
          )}
          {error && <p className="text-center text-red-500">{error}</p>}
        </div>

        {/* Accepted Tasks Section */}
        <div className="w-full max-w-xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-3xl font-bold">Accepted Tasks</h2>
            <button className="btn btn-outline btn-sm" onClick={handleViewAll}>
              View All My Tasks
            </button>
          </div>
          {acceptedTasks.length === 0 ? (
            <p className="text-center text-gray-200">No tasks accepted yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {acceptedTasks.slice(0, 2).map((t) => (
                <TaskCard key={t.id} t={t} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal for Completing/Updating Task */}
      {showCompleteModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 animate-fadeIn">
          <div className="modal-box relative bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl p-8">
            <button
              className="btn btn-sm btn-circle absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-base-content"
              onClick={() => {
                setShowCompleteModal(false);
                setSelectedTask(null);
              }}
            >
              ✕
            </button>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center justify-center">
                <DifficultyIcon difficulty={selectedTask.difficulty || 'medium'} />
              </div>
              <div className="col-span-2 space-y-2">
                <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-blue-500">
                  {selectedTask.task_description}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-lg font-bold text-accent">Difficulty:</div>
                  <div className="text-lg">{selectedTask.difficulty}</div>
                  <div className="text-lg font-bold text-accent">Comment:</div>
                  <div className="text-lg">{selectedTask.comment || 'None'}</div>
                </div>
                {selectedTask.assigned_by && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="avatar">
                      <div className="w-8 h-8 rounded-full">
                        {selectedTask.assigned_by.avatar_url ? (
                          <img
                            src={selectedTask.assigned_by.avatar_url}
                            alt="Assigned By"
                            className="object-cover"
                          />
                        ) : (
                          <div className="bg-base-300 w-8 h-8 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold">
                              {selectedTask.assigned_by.username
                                ? selectedTask.assigned_by.username.charAt(0).toUpperCase()
                                : '?' }
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-lg font-bold text-accent">
                      Assigned by: {selectedTask.assigned_by.username || 'Unknown'}
                    </span>
                  </div>
                )}
                <p className="text-sm text-gray-500">
                  Assigned At: {new Date(selectedTask.created_at).toLocaleString()}
                </p>
                {selectedTask.points !== undefined && (
                  <p className="text-lg font-bold text-accent">Points: {selectedTask.points}</p>
                )}
              </div>
            </div>
            <div className="mt-6">
              {/* Duration is now computed automatically; the input is removed */}
              <label className="block text-lg font-bold text-accent mb-2">
                {proofFile ? 'Submit Proof & Complete Task' : 'Complete Task (optional proof & comment):'}
              </label>
              <input
                type="file"
                accept="image/*"
                className="file-input file-input-bordered w-full bg-gray-700 text-base-content"
                onChange={handleProofFileChange}
              />
              <textarea
                placeholder="Optional submission comment..."
                className="textarea textarea-bordered w-full bg-gray-700 text-base-content mt-4"
                value={completeComment}
                onChange={(e) => setCompleteComment(e.target.value)}
              />
            </div>
            <div className="card-actions justify-end mt-6">
              <button
                className={selectedTask && selectedTask.status?.toLowerCase() === 'completed' ? 'btn btn-success btn-sm' : 'btn btn-primary btn-sm'}
                onClick={handleCompleteTask}
                disabled={completing}
              >
                {completing
                  ? 'Submitting...'
                  : proofFile
                  ? 'Submit Proof & Complete Task'
                  : 'Complete Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Assigning Task to a Friend */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 animate-fadeIn">
          <div className="modal-box relative bg-base-100 rounded-xl shadow-2xl w-full max-w-2xl p-8">
            <button
              className="absolute top-4 right-4 btn btn-sm btn-circle bg-red-600 hover:bg-red-700 text-base-content"
              onClick={() => setShowAssignModal(false)}
            >
              ✕
            </button>
            <h2 className="text-3xl font-bold text-center mb-6">
              Assign Task to a Friend
            </h2>
            <p className="text-center mb-4">Select a friend (other than yourself) to assign this task:</p>
            <div className="grid grid-cols-2 gap-4">
              {friends.length === 0 ? (
                <p className="col-span-2 text-center text-gray-300">No friends found.</p>
              ) : (
                friends.map((friend) => (
                  <div
                    key={friend.user_id}
                    className="card bg-base-100 shadow-lg rounded-xl p-4 cursor-pointer transform hover:scale-105 transition duration-300"
                    onClick={() => handleAssignToFriend(friend.user_id)}
                  >
                    <div className="flex items-center space-x-2">
                      <div className="avatar">
                        <div className="w-10 h-10 rounded-full">
                          {friend.avatar_url ? (
                            <img src={friend.avatar_url} alt={friend.username} className="object-cover" />
                          ) : (
                            <div className="bg-gray-700 w-10 h-10 rounded-full flex items-center justify-center">
                              <span className="text-sm font-bold">
                                {friend.username ? friend.username.charAt(0).toUpperCase() : '?'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="font-bold text-gray-800">{friend.username || 'Unknown'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* (Optional) Delete Confirmation Modal */}
      {showDeleteConfirm && taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 animate-fadeIn">
          <div className="modal-box bg-base-100 rounded-xl shadow-2xl max-w-md p-6">
            <h2 className="text-2xl font-bold mb-4">Confirm Deletion</h2>
            <p className="mb-6">Are you sure you want to delete this task?</p>
            <div className="flex justify-end space-x-4">
              <button onClick={confirmDeleteTask} className="btn btn-error btn-sm">
                Yes, Delete
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Popup */}
      {toast && (
        <div className="toast toast-center">
          <div className="alert alert-success shadow-lg">
            <span>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
