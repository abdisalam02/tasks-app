'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { FaSmile, FaMeh, FaFrown } from 'react-icons/fa';

interface Profile {
  user_id: string;
  username?: string;
  avatar_url?: string;
  score?: number;
  completed_challenges?: number;
}

interface Assignment {
  id: number;
  created_at: string;
  difficulty: string;
  duration: string;
  proof_url?: string;
  comment?: string;
  task_description: string;
  points?: number;
  // For assignments we assume the join works and returns either an object or a string.
  assigned_by?: { 
    username?: string;
    avatar_url?: string;
  } | string;
  status?: string;
  review_comment?: string;
}

interface GeneratedTask {
  id: number;
  created_at: string;
  difficulty: string;
  duration: string;
  proof_url?: string;
  comment?: string;
  task_description: string;
  status?: string;
  // In our table, assigned_by is stored as a varchar.
  // For generated tasks, it can be "application" or a user ID.
  assigned_by?: string;
  // We removed review_comment because it does not exist in the table.
  // review_comment?: string;
}

export default function UserDetailPage() {
  const { id } = useParams();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string>('');

  // States for the assign challenge form
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [durationOption, setDurationOption] = useState<string>('1 Day');
  const [customDuration, setCustomDuration] = useState<string>('');
  const [durationUnit, setDurationUnit] = useState<string>('Minutes');
  const [comment, setComment] = useState<string>('');
  const [assigning, setAssigning] = useState<boolean>(false);

  // State for viewing a task’s full details
  const [selectedTask, setSelectedTask] = useState<Assignment | GeneratedTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState<boolean>(false);

  // State for full-screen image (for both profile and proof)
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [imageToShow, setImageToShow] = useState<string>('');

  // For generated tasks, if assigned_by is not "application", we need to fetch the profile.
  const [assignedByProfile, setAssignedByProfile] = useState<{ username?: string; avatar_url?: string } | null>(null);

  // Returns a larger difficulty icon for gamified styling.
  function DifficultyIcon({ difficulty }: { difficulty: string }) {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return <FaSmile className="h-16 w-16 text-green-400 animate-bounce" />;
      case 'medium':
        return <FaMeh className="h-16 w-16 text-yellow-400 animate-pulse" />;
      case 'hard':
        return <FaFrown className="h-16 w-16 text-red-400 animate-pulse" />;
      default:
        return null;
    }
  }

  // Fetch the user's profile.
  const fetchProfile = async () => {
    setLoadingProfile(true);
    setError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url, score, completed_challenges')
      .eq('user_id', id)
      .maybeSingle();
    if (error) {
      setError(error.message);
    } else if (!data) {
      setError('User not found.');
    } else {
      setProfile(data);
    }
    setLoadingProfile(false);
  };

  // Fetch assignments (with join to fetch assigned_by details).
  const fetchAssignments = async () => {
    const { data, error } = await supabase
      .from('assignments')
      .select('*, assigned_by:profiles(username, avatar_url), review_comment')
      .eq('assigned_to', id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching assignments:', error.message);
      setError(error.message);
    } else {
      setAssignments(data || []);
    }
  };

  // Fetch generated tasks WITHOUT trying to select a non-existent column.
  const fetchGeneratedTasks = async () => {
    const { data, error } = await supabase
      .from('GeneratedTasks')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching generated tasks:', error.message);
      setError(error.message);
    } else {
      setGeneratedTasks(data || []);
    }
  };

  // When viewing a task, if it is a generated task and its assigned_by is not "application",
  // fetch the profile for that user ID.
  const fetchAssignedByProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('user_id', userId)
      .maybeSingle();
    if (!error && data) {
      setAssignedByProfile(data);
    } else {
      setAssignedByProfile(null);
    }
  };

  // When a task is clicked, set it as selected and (if needed) fetch assigned_by profile.
  const handleViewTask = (task: Assignment | GeneratedTask) => {
    setSelectedTask(task);
    setShowTaskModal(true);
    // Reset any previous assignedByProfile value.
    setAssignedByProfile(null);
    // For generated tasks, assigned_by is stored as a string.
    if (typeof task.assigned_by === 'string' && task.assigned_by !== 'application') {
      fetchAssignedByProfile(task.assigned_by);
    }
  };

  // Mapping for points based on difficulty.
  const difficultyPoints: Record<string, number> = {
    easy: 25,
    medium: 50,
    hard: 75,
  };

  // Handler for assign challenge form submission.
  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigning(true);
    setError(null);
    const finalDuration =
      durationOption === 'Custom'
        ? `${customDuration} ${durationUnit}`
        : durationOption;
    // Compute points based on difficulty.
    const points = difficultyPoints[difficulty.toLowerCase()] || 0;
    // Get current session to set assigned_by.
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    let assignedBy = null;
    if (session) {
      assignedBy = session.user.id;
    }
    // Insert the assignment (with points).
    const { error } = await supabase
      .from('assignments')
      .insert([
        {
          assigned_to: id,
          assigned_by: assignedBy,
          task_description: taskDescription,
          difficulty,
          duration: finalDuration,
          comment,
          points,
        },
      ]);
    if (error) {
      setError(error.message);
    } else {
      // Insert a notification for the recipient.
      const notificationPayload = {
        user_id: id,
        sender_id: assignedBy,
        message: `You have been assigned a new challenge worth ${points} points!`,
        is_read: false,
      };
      const { error: notifError } = await supabase
        .from('notifications')
        .insert([notificationPayload]);
      if (notifError) {
        console.error("Notification insertion error:", notifError.message);
      }
      setToast('Challenge assigned successfully!');
      // Clear form fields.
      setTaskDescription('');
      setDifficulty('medium');
      setDurationOption('1 Day');
      setCustomDuration('');
      setDurationUnit('Minutes');
      setComment('');
      setShowAssignModal(false);
      fetchAssignments();
    }
    setAssigning(false);
  };

  // Auto-hide toast.
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (id) {
      fetchProfile();
      fetchAssignments();
      fetchGeneratedTasks();
    }
  }, [id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6">
      <div className="container mx-auto max-w-4xl space-y-10">
        <h1 className="text-4xl font-extrabold text-center mb-8">
          User Details & Tasks
        </h1>

        {/* User Profile */}
        {loadingProfile ? (
          <p className="text-center text-gray-300 animate-pulse">Loading user...</p>
        ) : error ? (
          <p className="text-center text-red-400">{error}</p>
        ) : profile ? (
          <div className="card card-bordered bg-base-100 shadow-xl transform hover:scale-105 transition-all duration-300">
            <div className="card-body items-center text-center">
              <div className="avatar">
                <div className="w-32 rounded-full ring ring-primary ring-offset-2">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Profile Picture"
                      className="object-cover rounded-full cursor-pointer"
                      onClick={() => {
                        setImageToShow(profile.avatar_url as string);
                        setShowImageModal(true);
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center bg-gray-700 w-full h-full rounded-full">
                      <span className="text-5xl font-bold text-gray-300">
                        {profile.username ? profile.username.charAt(0).toUpperCase() : '?'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <h1 className="mt-4 text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">
                {profile.username || 'No username set'}
              </h1>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                <div className="badge badge-secondary text-lg">
                  Points: {profile.score ?? 0}
                </div>
                <div className="badge badge-secondary text-lg">
                  Completed: {profile.completed_challenges ?? 0}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Assign Challenge Section */}
        <div className="card card-bordered bg-base-100 shadow-xl transform hover:scale-105 transition-all duration-300">
          <div className="card-body text-center">
            <h2 className="card-title text-2xl">Assign a Challenge</h2>
            <button
              className="btn btn-accent mt-4 text-lg font-bold"
              onClick={() => setShowAssignModal(true)}
            >
              Assign Challenge
            </button>
          </div>
        </div>

        {/* Assigned Challenges Section */}
        <div className="card card-bordered bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">Assigned Challenges</h2>
            {assignments.length === 0 ? (
              <p className="text-gray-400">No challenges assigned yet.</p>
            ) : (
              <>
                {/* Mobile Slider */}
                <div className="sm:hidden flex space-x-4 overflow-x-auto p-2 snap-x snap-mandatory">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="snap-start flex-shrink-0">
                      <div
                        className="card w-72 card-bordered bg-base-100 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer rounded-xl"
                        onClick={() => handleViewTask(assignment)}
                      >
                        <figure className="p-4 flex items-center justify-center">
                          <DifficultyIcon difficulty={assignment.difficulty} />
                        </figure>
                        <div className="card-body">
                          <h3 className="card-title text-xl font-bold">
                            {assignment.task_description}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="badge badge-info">
                              {assignment.status || 'Pending'}
                            </span>
                            <span className="badge badge-secondary capitalize">
                              {assignment.difficulty}
                            </span>
                            <span className="badge badge-warning">
                              {assignment.points ? `Points: ${assignment.points}` : ''}
                            </span>
                          </div>
                          <div className="mt-2">
                            <p className="text-sm">
                              <span className="font-bold text-accent">Duration:</span> {assignment.duration}
                            </p>
                            <p className="text-sm line-clamp-2">
                              <span className="font-bold text-accent">Comment:</span> {assignment.comment || '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop Grid */}
                <div className="hidden sm:grid grid-cols-2 gap-6">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="card card-bordered bg-base-100 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer rounded-xl"
                      onClick={() => handleViewTask(assignment)}
                    >
                      <div className="card-body">
                        <h3 className="card-title text-xl font-bold">
                          {assignment.task_description}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="badge badge-info">
                            {assignment.status || 'Pending'}
                          </span>
                          <span className="badge badge-secondary capitalize">
                            {assignment.difficulty}
                          </span>
                          <span className="badge badge-warning">
                            {assignment.points ? `Points: ${assignment.points}` : ''}
                          </span>
                        </div>
                        <div className="mt-2">
                          <p className="text-sm">
                            <span className="font-bold text-accent">Duration:</span> {assignment.duration}
                          </p>
                          <p className="text-sm">
                            <span className="font-bold text-accent">Comment:</span> {assignment.comment || '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Generated Challenges Section */}
        <div className="card card-bordered bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">Generated Challenges</h2>
            {generatedTasks.length === 0 ? (
              <p className="text-gray-400">No generated challenges yet.</p>
            ) : (
              <>
                {/* Mobile Slider */}
                <div className="sm:hidden flex space-x-4 overflow-x-auto p-2 snap-x snap-mandatory">
                  {generatedTasks.map((task) => (
                    <div key={task.id} className="snap-start flex-shrink-0">
                      <div
                        className="card w-72 card-bordered bg-base-100 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer rounded-xl"
                        onClick={() => handleViewTask(task)}
                      >
                        <figure className="p-4 flex items-center justify-center">
                          <DifficultyIcon difficulty={task.difficulty} />
                        </figure>
                        <div className="card-body">
                          <h3 className="card-title text-xl font-bold">
                            {task.task_description}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="badge badge-info">
                              {task.status || 'Pending'}
                            </span>
                            <span className="badge badge-secondary capitalize">
                              {task.difficulty}
                            </span>
                          </div>
                          <div className="mt-2">
                            <p className="text-sm">
                              <span className="font-bold text-accent">Duration:</span> {task.duration}
                            </p>
                            <p className="text-sm line-clamp-2">
                              <span className="font-bold text-accent">Comment:</span> {task.comment || '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop Grid */}
                <div className="hidden sm:grid grid-cols-2 gap-6">
                  {generatedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="card card-bordered bg-base-100 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer rounded-xl"
                      onClick={() => handleViewTask(task)}
                    >
                      <div className="card-body">
                        <h3 className="card-title text-xl font-bold">
                          {task.task_description}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="badge badge-info">
                            {task.status || 'Pending'}
                          </span>
                          <span className="badge badge-secondary capitalize">
                            {task.difficulty}
                          </span>
                        </div>
                        <div className="mt-2">
                          <p className="text-sm">
                            <span className="font-bold text-accent">Duration:</span> {task.duration}
                          </p>
                          <p className="text-sm">
                            <span className="font-bold text-accent">Comment:</span> {task.comment || '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal for Assign Challenge */}
      {showAssignModal && (
        <div className="modal modal-open">
          <div className="modal-box relative bg-gray-800 rounded-xl shadow-2xl max-w-2xl">
            <button
              className="btn btn-sm btn-circle absolute right-2 top-2 bg-red-600 hover:bg-red-700"
              onClick={() => setShowAssignModal(false)}
            >
              ✕
            </button>
            <h2 className="text-3xl font-bold text-white mb-6 border-b pb-2 border-blue-500">
              Assign Challenge to {profile?.username || 'Player'}
            </h2>
            <form onSubmit={handleAssignTask} className="space-y-6">
              {/* Task Description */}
              <div>
                <label className="label">
                  <span className="label-text text-lg font-semibold text-accent">
                    Task Description
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Enter challenge details..."
                  className="input input-bordered w-full bg-gray-700 text-white"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  required
                />
              </div>
              {/* Difficulty */}
              <div>
                <label className="label">
                  <span className="label-text text-lg font-semibold text-accent">
                    Difficulty
                  </span>
                </label>
                <select
                  className="select select-bordered w-full bg-gray-700 text-white"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              {/* Duration */}
              <div>
                <label className="label">
                  <span className="label-text text-lg font-semibold text-accent">
                    Duration
                  </span>
                </label>
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer flex items-center gap-2">
                    <input
                      type="radio"
                      name="duration"
                      value="1 Day"
                      className="radio radio-primary"
                      checked={durationOption === '1 Day'}
                      onChange={() => setDurationOption('1 Day')}
                    />
                    <span className="text-gray-300">1 Day</span>
                  </label>
                  <label className="cursor-pointer flex items-center gap-2">
                    <input
                      type="radio"
                      name="duration"
                      value="1 Week"
                      className="radio radio-primary"
                      checked={durationOption === '1 Week'}
                      onChange={() => setDurationOption('1 Week')}
                    />
                    <span className="text-gray-300">1 Week</span>
                  </label>
                  <label className="cursor-pointer flex items-center gap-2">
                    <input
                      type="radio"
                      name="duration"
                      value="Custom"
                      className="radio radio-primary"
                      checked={durationOption === 'Custom'}
                      onChange={() => setDurationOption('Custom')}
                    />
                    <span className="text-gray-300">Custom</span>
                  </label>
                </div>
                {durationOption === 'Custom' && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="number"
                      placeholder="Value"
                      className="input input-bordered w-1/2 bg-gray-700 text-white"
                      value={customDuration}
                      onChange={(e) => setCustomDuration(e.target.value)}
                      required
                    />
                    <select
                      className="select select-bordered w-1/2 bg-gray-700 text-white"
                      value={durationUnit}
                      onChange={(e) => setDurationUnit(e.target.value)}
                    >
                      <option value="Minutes">Minutes</option>
                      <option value="Hours">Hours</option>
                    </select>
                  </div>
                )}
              </div>
              {/* Comment */}
              <div>
                <label className="label">
                  <span className="label-text text-lg font-semibold text-accent">
                    Comment
                  </span>
                </label>
                <textarea
                  placeholder="Any extra notes..."
                  className="textarea textarea-bordered w-full bg-gray-700 text-white"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
              {/* Submit Button */}
              <div className="modal-action">
                <button type="submit" className="btn btn-primary" disabled={assigning}>
                  {assigning ? 'Assigning...' : 'Send Challenge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Viewing Full Task Details */}
      {showTaskModal && selectedTask && (
        <div className="modal modal-open">
          <div className="modal-box relative bg-gray-800 rounded-xl shadow-2xl max-w-2xl p-8">
            <button
              className="btn btn-sm btn-circle absolute right-2 top-2 bg-red-600 hover:bg-red-700"
              onClick={() => setShowTaskModal(false)}
            >
              ✕
            </button>
            <div className="mb-4 border-b border-blue-500 pb-2">
              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">
                {selectedTask.task_description}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="badge badge-info text-lg">
                  {selectedTask.status || 'Pending'}
                </span>
                <span className="badge badge-secondary text-lg capitalize">
                  {selectedTask.difficulty}
                </span>
                {/* Display Assigned By information */}
                {typeof selectedTask.assigned_by === "string" ? (
                  selectedTask.assigned_by === "application" ? (
                    <span className="badge badge-warning text-lg">
                      Assigned By: Application
                    </span>
                  ) : assignedByProfile ? (
                    <div className="flex items-center gap-2">
                      {assignedByProfile.avatar_url && (
                        <img
                          src={assignedByProfile.avatar_url}
                          alt="Assigned By"
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <span className="badge badge-warning text-lg">
                        Assigned By: {assignedByProfile.username || 'Unknown'}
                      </span>
                    </div>
                  ) : (
                    <span className="badge badge-warning text-lg">
                      Loading Assigned By...
                    </span>
                  )
                ) : (
                  // For assignments where the join worked.
                  typeof selectedTask.assigned_by === "object" && selectedTask.assigned_by ? (
                    <div className="flex items-center gap-2">
                      {selectedTask.assigned_by.avatar_url && (
                        <img
                          src={selectedTask.assigned_by.avatar_url}
                          alt="Assigned By"
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <span className="badge badge-warning text-lg">
                        Assigned By: {selectedTask.assigned_by.username || 'Unknown'}
                      </span>
                    </div>
                  ) : null
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-lg">
                  <span className="font-bold text-accent">Duration:</span> {selectedTask.duration}
                </p>
                <p className="text-lg">
                  <span className="font-bold text-accent">Comment:</span> {selectedTask.comment || 'None'}
                </p>
                <p className="text-sm text-gray-400">
                  <span className="font-bold text-accent">
                    { 'assigned_by' in selectedTask ? 'Assigned/Created At:' : 'Created At:' }
                  </span>{' '}
                  {new Date(selectedTask.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center justify-center">
                <DifficultyIcon difficulty={selectedTask.difficulty} />
              </div>
            </div>
            {/* If review comment exists, display it */}
            {selectedTask.review_comment && (
              <div className="mt-6">
                <h3 className="text-xl font-bold text-accent">Review Comment:</h3>
                <p className="mt-2">
                  {selectedTask.review_comment}
                </p>
              </div>
            )}
            {/* If proof is provided, display clickable image */}
            {selectedTask.proof_url && (
              <div className="mt-6">
                <h3 className="text-xl font-bold text-accent">Proof Submitted:</h3>
                <img
                  src={selectedTask.proof_url}
                  alt="Proof"
                  className="w-full max-h-96 object-contain rounded-md mt-2 cursor-pointer transition-transform transform hover:scale-105"
                  onClick={() => {
                    setImageToShow(selectedTask.proof_url as string);
                    setShowImageModal(true);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Screen Image Modal */}
      {showImageModal && (
        <div className="modal modal-open">
          <div className="modal-box p-0 bg-transparent flex items-center justify-center relative">
            <button
              className="btn btn-sm btn-circle absolute right-4 top-4 bg-red-600 hover:bg-red-700"
              onClick={() => setShowImageModal(false)}
            >
              ✕
            </button>
            <img
              src={imageToShow}
              alt="Full View"
              className="max-w-full max-h-screen object-contain transition-all duration-300"
            />
          </div>
        </div>
      )}

      {/* Toast Popup */}
      {toast && (
        <div className="toast toast-center">
          <div className="alert alert-success">
            <span>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
