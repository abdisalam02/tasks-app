'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { FaSmile, FaMeh, FaFrown, FaArrowUp, FaTrophy } from 'react-icons/fa';

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
  status: string; // pending, accepted, declined, completed
  assigned_to: string;
  // Join alias for assigned_by's profile data.
  assigned_by?: {
    username?: string;
    avatar_url?: string;
  };
  points?: number;
}

interface GeneratedTask {
  id: number;
  created_at?: string;
  task_description: string;
  category?: string;
  duration?: string;
  proof_url?: string;
  comment?: string;
  status: string;
  user_id: string;
  points?: number;
}

// Returns a background class string based on task status (for assigned tasks)
const getAssignedCardClass = (status: string) => {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'bg-gradient-to-r from-gray-500 to-gray-600';
    case 'accepted':
      return 'bg-gradient-to-r from-blue-600 to-blue-800';
    case 'declined':
      return 'bg-gradient-to-r from-red-600 to-red-800';
    case 'completed':
      return 'bg-gradient-to-r from-teal-500 to-navy-600';
    default:
      return 'bg-gray-500';
  }
};

// Returns a background class string based on task status (for generated tasks)
const getGeneratedCardClass = (status: string) => {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'bg-gradient-to-r from-navy-500 to-teal-600';
    case 'accepted':
      return 'bg-gradient-to-r from-teal-600 to-green-700';
    case 'declined':
      return 'bg-gradient-to-r from-orange-600 to-red-700';
    case 'completed':
      return 'bg-gradient-to-r from-teal-500 to-navy-600';
    default:
      return 'bg-purple-500';
  }
};

// Difficulty icon component.
function DifficultyIcon({ difficulty }: { difficulty: string }) {
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return <FaSmile className="h-12 w-12 text-green-400" />;
    case 'medium':
      return <FaMeh className="h-12 w-12 text-yellow-400" />;
    case 'hard':
      return <FaFrown className="h-12 w-12 text-red-400" />;
    default:
      return <FaMeh className="h-12 w-12 text-yellow-400" />;
  }
}

export default function MyTasksPage() {
  const router = useRouter();

  // Profile and tasks state.
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignedTasks, setAssignedTasks] = useState<Assignment[]>([]);
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string>('');

  // Active tab state: 'assigned' or 'generated'
  const [activeTab, setActiveTab] = useState<'assigned' | 'generated'>('assigned');

  // Modal state for completing a task.
  const [showCompleteModal, setShowCompleteModal] = useState<boolean>(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | GeneratedTask | null>(null);
  const [completeComment, setCompleteComment] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [completing, setCompleting] = useState<boolean>(false);

  // State for scroll-to-top button.
  const [showScrollToTop, setShowScrollToTop] = useState<boolean>(false);

  // --- Points mapping by difficulty ---
  const difficultyPoints: Record<string, number> = {
    easy: 25,
    medium: 50,
    hard: 75,
  };

  // Fetch current user's profile.
  const fetchProfile = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session) {
      router.push('/signin');
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url, score, completed_challenges')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error) {
      setError(error.message);
    } else if (!data) {
      setError('Profile not found.');
    } else {
      setProfile(data);
    }
  };

  // Fetch assigned tasks.
  const fetchAssignedTasks = async (userId: string) => {
    const { data, error } = await supabase
      .from('assignments')
      .select('*, assigned_by:profiles(username, avatar_url)')
      .eq('assigned_to', userId)
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setAssignedTasks(data || []);
    }
  };

  // Fetch generated tasks.
  const fetchGeneratedTasks = async (userId: string) => {
    const { data, error } = await supabase
      .from('GeneratedTasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setGeneratedTasks(data || []);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchProfile();
    };
    init();
  }, []);

  useEffect(() => {
    if (profile?.user_id) {
      fetchAssignedTasks(profile.user_id);
      fetchGeneratedTasks(profile.user_id);
      setLoading(false);
    }
  }, [profile]);

  // Auto-hide toast after 3 seconds.
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Show/hide scroll-to-top button based on scroll position.
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollToTop(true);
      } else {
        setShowScrollToTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handler for completing a task.
  // In this simplified modal for generated tasks, we remove the duration input.
  // The duration is computed automatically as the difference (in minutes) between now and the task's created_at timestamp.
  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    setCompleting(true);
    let proofUrl = selectedAssignment.proof_url || null;
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
      const { data: { publicUrl } } = supabase.storage
        .from('task-proofs')
        .getPublicUrl(fileName);
      proofUrl = publicUrl;
    }

    // Compute the duration automatically:
    // Calculate the difference in minutes between now and when the task was created.
    const now = new Date();
    const created = new Date(selectedAssignment.created_at);
    const diffMs = now.getTime() - created.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const computedDuration = `${diffMinutes} minutes`;

    // Determine task points:
    const taskPoints =
      ('points' in selectedAssignment && selectedAssignment.points !== undefined)
        ? selectedAssignment.points
        : difficultyPoints[selectedAssignment.difficulty.toLowerCase()] || 0;

    if ('assigned_to' in selectedAssignment) {
      const { error } = await supabase
        .from('assignments')
        .update({
          // Instead of manual duration, use the computed duration.
          duration: computedDuration,
          comment: completeComment,
          proof_url: proofUrl,
          status: 'completed',
        })
        .eq('id', selectedAssignment.id);
      if (error) {
        setToast(`Error: ${error.message}`);
      } else {
        setToast('Task completed successfully!');
        if (profile) fetchAssignedTasks(profile.user_id);
      }
    } else {
      const { error } = await supabase
        .from('GeneratedTasks')
        .update({
          duration: computedDuration,
          comment: completeComment,
          proof_url: proofUrl,
          status: 'completed',
          points: taskPoints, // Save points with the record.
        })
        .eq('id', selectedAssignment.id);
      if (error) {
        setToast(`Error: ${error.message}`);
      } else {
        setToast('Task completed successfully!');
        if (profile) fetchGeneratedTasks(profile.user_id);
      }
    }

    // Optionally, if not using the trigger, update the profile manually.
    // (If using the provided trigger, you can remove this block.)
    if (profile) {
      const newScore = (profile.score || 0) + taskPoints;
      const newCompletedChallenges = (profile.completed_challenges || 0) + 1;
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          score: newScore,
          completed_challenges: newCompletedChallenges,
        })
        .eq('user_id', profile.user_id);
      if (profileError) {
        console.error("Error updating profile:", profileError.message);
      } else {
        setProfile({ ...profile, score: newScore, completed_challenges: newCompletedChallenges });
      }
    }

    setShowCompleteModal(false);
    setSelectedAssignment(null);
    setCompleting(false);
  };

  // Determine the complete button class based on task status.
  const completeButtonClass =
    selectedAssignment && selectedAssignment.status.toLowerCase() === 'completed'
      ? 'btn btn-success btn-sm'
      : 'btn btn-primary btn-sm';

  return (
    <div className="min-h-screen bg-gradient-to-r from-gray-900 to-gray-800 text-white p-8">
      <div className="container mx-auto max-w-4xl space-y-10">
        {/* Points Scoreboard */}
        {profile && (
          <div className="card bg-gradient-to-r from-purple-700 to-indigo-800 shadow-2xl mb-8">
            <div className="card-body flex items-center justify-between">
              <div>
                <h2 className="card-title text-white">Your Points</h2>
                <p className="text-white text-3xl font-bold">{profile.score ?? 0}</p>
                <p className="text-white">Completed Challenges: {profile.completed_challenges ?? 0}</p>
              </div>
              <div>
                <FaTrophy className="text-yellow-400 h-16 w-16 animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <h1 className="text-4xl font-extrabold text-center mb-8">My Tasks</h1>

        {/* Tab Toggle */}
        <div className="tabs tabs-boxed justify-center mb-8">
          <a
            className={`tab ${activeTab === 'assigned' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('assigned')}
          >
            Assigned Tasks
          </a>
          <a
            className={`tab ${activeTab === 'generated' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('generated')}
          >
            Generated Tasks
          </a>
        </div>

        {activeTab === 'assigned' ? (
          <section>
            <h2 className="text-3xl font-bold mb-4">Assigned Tasks</h2>
            {loading ? (
              <p className="text-center text-gray-300 animate-pulse">Loading tasks...</p>
            ) : assignedTasks.length === 0 ? (
              <p className="text-center text-gray-400">No assigned tasks found.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {assignedTasks.map((assignment) => (
                  <div
                    key={assignment.id}
                    className={`card lg:card-side ${getAssignedCardClass(assignment.status)} shadow-xl cursor-pointer transform hover:scale-105 transition-all duration-500 p-4 rounded-xl`}
                    onClick={() => router.push(`/mytasks/assigned/${assignment.id}`)}
                  >
                    <div className="card-body">
                      <h2 className="card-title text-2xl font-bold text-white">
                        {assignment.task_description}
                      </h2>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="text-lg">
                          <span className="font-bold text-accent">Difficulty:</span>{' '}
                          {assignment.difficulty}
                        </div>
                        <div className="flex justify-end">
                          <DifficultyIcon difficulty={assignment.difficulty} />
                        </div>
                        <div className="text-lg">
                          <span className="font-bold text-accent">Duration:</span>{' '}
                          {assignment.duration || 'N/A'}
                        </div>
                        <div className="text-lg">
                          <span className="font-bold text-accent">Status:</span>{' '}
                          {assignment.status}
                        </div>
                        <div className="text-lg">
                          <span className="font-bold text-accent">Points:</span>{' '}
                          {assignment.points ? assignment.points : 0}
                        </div>
                      </div>
                      {assignment.assigned_by && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="avatar">
                            <div className="w-8 h-8 rounded-full">
                              {assignment.assigned_by.avatar_url ? (
                                <img
                                  src={assignment.assigned_by.avatar_url}
                                  alt="Assigned By"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="bg-gray-700 w-8 h-8 rounded-full flex items-center justify-center">
                                  <span className="text-xs font-bold">
                                    {assignment.assigned_by.username
                                      ? assignment.assigned_by.username.charAt(0).toUpperCase()
                                      : '?'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="text-lg font-bold text-accent">
                            {assignment.assigned_by.username || 'Unknown'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section>
            <h2 className="text-3xl font-bold mb-4">Generated Tasks</h2>
            {loading ? (
              <p className="text-center text-gray-300 animate-pulse">Loading tasks...</p>
            ) : generatedTasks.length === 0 ? (
              <p className="text-center text-gray-400">No generated tasks found.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {generatedTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`card lg:card-side ${getGeneratedCardClass(task.status)} shadow-xl cursor-pointer transform hover:scale-105 transition-all duration-500 p-4 rounded-xl`}
                    onClick={() => router.push(`/mytasks/generated/${task.id}`)}
                  >
                    <div className="card-body">
                      <h2 className="card-title text-2xl font-bold text-white">
                        {task.task_description}
                      </h2>
                      {task.category && (
                        <p className="text-lg mt-2">
                          <span className="font-bold text-accent">Category:</span> {task.category}
                        </p>
                      )}
                      <p className="text-lg mt-2">
                        <span className="font-bold text-accent">Status:</span> {task.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Modal for Completing/Updating Task */}
      {showCompleteModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 animate-fadeIn">
          <div className="modal-box relative bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl p-8">
            <button
              className="absolute top-4 right-4 btn btn-sm btn-circle bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                setShowCompleteModal(false);
                setSelectedAssignment(null);
              }}
            >
              ✕
            </button>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center justify-center">
                <DifficultyIcon difficulty={selectedAssignment.difficulty} />
              </div>
              <div className="col-span-2 space-y-2">
                <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-blue-500">
                  {selectedAssignment.task_description}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-lg font-bold text-accent">Difficulty:</div>
                  <div className="text-lg">{selectedAssignment.difficulty}</div>
                  <div className="text-lg font-bold text-accent">Comment:</div>
                  <div className="text-lg">{selectedAssignment.comment || 'None'}</div>
                  <div className="text-lg font-bold text-accent">Points:</div>
                  <div className="text-lg">{'points' in selectedAssignment ? selectedAssignment.points : 0}</div>
                </div>
                {selectedAssignment.assigned_by && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="avatar">
                      <div className="w-8 h-8 rounded-full">
                        {selectedAssignment.assigned_by.avatar_url ? (
                          <img
                            src={selectedAssignment.assigned_by.avatar_url}
                            alt="Assigned By"
                            className="object-cover"
                          />
                        ) : (
                          <div className="bg-base-300 w-8 h-8 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold">
                              {selectedAssignment.assigned_by.username
                                ? selectedAssignment.assigned_by.username.charAt(0).toUpperCase()
                                : '?'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-lg font-bold text-accent">
                      Assigned by: {selectedAssignment.assigned_by.username || 'Unknown'}
                    </span>
                  </div>
                )}
                <p className="text-sm text-gray-500">
                  Assigned At: {new Date(selectedAssignment.created_at).toLocaleString()}
                </p>
                {selectedAssignment.points !== undefined && (
                  <p className="text-lg font-bold text-accent">Points: {selectedAssignment.points}</p>
                )}
              </div>
            </div>
            <div className="mt-6">
              <label className="block text-lg font-bold text-accent mb-2">
                {proofFile ? 'Submit Proof & Complete Task' : 'Complete Task (optional proof & comment):'}
              </label>
              <input
                type="file"
                accept="image/*"
                className="file-input file-input-bordered w-full bg-gray-700 text-white"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setProofFile(e.target.files[0]);
                  }
                }}
              />
              <textarea
                placeholder="Optional submission comment..."
                className="textarea textarea-bordered w-full bg-gray-700 text-white mt-4"
                value={completeComment}
                onChange={(e) => setCompleteComment(e.target.value)}
              />
              {/* The Duration input has been removed.
                  Instead, the duration will be computed automatically as the elapsed time (in minutes)
                  between when the task was created and now. */}
            </div>
            <div className="card-actions justify-end mt-6">
              <button
                className={completeButtonClass}
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

      {/* Toast Popup */}
      {toast && (
        <div className="toast toast-center">
          <div className="alert alert-success shadow-lg">
            <span>{toast}</span>
          </div>
        </div>
      )}

      {/* Scroll to Top Button */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-4 right-4 p-3 bg-blue-600 rounded-full shadow-lg z-50 focus:outline-none transition-all duration-300 transform hover:scale-110"
          aria-label="Scroll to top"
        >
          <FaArrowUp className="text-white h-6 w-6" />
        </button>
      )}
    </div>
  );
}
