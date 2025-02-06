'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../../lib/supabaseClient';
import { FaSmile, FaMeh, FaFrown } from 'react-icons/fa';

interface GeneratedTask {
  id: number;
  created_at: string;
  task_description: string;
  category?: string;
  duration?: string;
  proof_url?: string;
  comment?: string;
  status: string;
  user_id: string;
  difficulty?: string;
  points?: number;
}

function DifficultyIcon({ difficulty }: { difficulty: string }) {
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return <FaSmile className="h-16 w-16 text-green-400" />;
    case 'medium':
      return <FaMeh className="h-16 w-16 text-yellow-400" />;
    case 'hard':
      return <FaFrown className="h-16 w-16 text-red-400" />;
    default:
      return <FaMeh className="h-16 w-16 text-yellow-400" />;
  }
}

export default function GeneratedTaskDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [task, setTask] = useState<GeneratedTask | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string>('');

  // Modal state for completing/resubmitting a task.
  const [showCompleteModal, setShowCompleteModal] = useState<boolean>(false);
  const [completeComment, setCompleteComment] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [completing, setCompleting] = useState<boolean>(false);

  // Fetch the task details from the GeneratedTasks table.
  const fetchTask = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('GeneratedTasks')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      setError(error.message);
    } else if (!data) {
      setError('Task not found.');
    } else {
      setTask(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (id) {
      fetchTask();
    }
  }, [id]);

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setProofFile(e.target.files[0]);
    }
  };

  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    setCompleting(true);

    // Upload proof file if provided.
    let proofUrl = task.proof_url || null;
    if (proofFile) {
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase
        .storage
        .from('task-proofs')
        .upload(fileName, proofFile);
      if (uploadError) {
        setToast(`Upload error: ${uploadError.message}`);
        setCompleting(false);
        return;
      }
      const { data: { publicUrl } } = supabase
        .storage
        .from('task-proofs')
        .getPublicUrl(fileName);
      proofUrl = publicUrl;
    }

    // Compute duration automatically: difference (in minutes) between now and the task's creation time.
    const now = new Date();
    const created = new Date(task.created_at);
    const diffMs = now.getTime() - created.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const computedDuration = `${diffMinutes} minutes`;

    // Update the GeneratedTasks record.
    const { error } = await supabase
      .from('GeneratedTasks')
      .update({
        duration: computedDuration,
        comment: completeComment,
        proof_url: proofUrl,
        status: 'completed',
        points: task.points, // Use the provided points if any.
      })
      .eq('id', task.id);
    if (error) {
      setToast(`Error: ${error.message}`);
    } else {
      setToast('Task completed successfully!');
      fetchTask();
      setShowCompleteModal(false);
    }
    setCompleting(false);
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Modal button text: if task is already completed, show "Resubmit Task"
  const modalButtonText =
    task && task.status.toLowerCase() === 'completed'
      ? (proofFile ? 'Submit Proof & Resubmit Task' : 'Resubmit Task')
      : (proofFile ? 'Submit Proof & Complete Task' : 'Complete Task');

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-blue-900 text-white p-4">
      <div className="container mx-auto max-w-3xl">
        <button className="btn btn-outline mb-4" onClick={() => router.back()}>
          ← Back
        </button>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-gray-300 animate-pulse">Loading task...</p>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-red-400">{error}</p>
          </div>
        ) : task ? (
          <div className="card bg-base-100 shadow-2xl rounded-xl p-6 mb-8 transform hover:scale-105 transition-all duration-300">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex items-center justify-center">
                <DifficultyIcon difficulty={task.difficulty || 'medium'} />
              </div>
              <div className="flex-grow">
                <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
                  {task.task_description}
                </h2>
                {task.category && (
                  <p className="mt-4 text-lg">
                    <span className="font-bold text-accent">Category:</span> {task.category}
                  </p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-4 text-lg">
                  <div>
                    <span className="font-bold text-accent">Duration:</span> {task.duration || 'N/A'}
                  </div>
                  <div>
                    <span className="font-bold text-accent">Status:</span> {task.status}
                  </div>
                  <div className="col-span-2">
                    <span className="font-bold text-accent">Created At:</span> {new Date(task.created_at).toLocaleString()}
                  </div>
                  {task.points !== undefined && (
                    <div className="col-span-2">
                      <span className="font-bold text-accent">Points:</span> {task.points}
                    </div>
                  )}
                  {task.comment && task.comment.trim() !== "" && (
                    <div className="col-span-2">
                      <span className="font-bold text-accent">Comment:</span> {task.comment}
                    </div>
                  )}
                </div>
                {task.status.toLowerCase() !== 'completed' && (
                  <div className="mt-6">
                    <button
                      className="btn btn-info"
                      onClick={() => setShowCompleteModal(true)}
                    >
                      {task.status.toLowerCase() === 'completed' ? 'Resubmit Task' : 'Complete Task'}
                    </button>
                  </div>
                )}
                {task.status.toLowerCase() === 'completed' && task.proof_url && (
                  <div className="mt-6">
                    <p className="font-bold text-accent text-lg">Proof Submitted:</p>
                    <img
                      src={task.proof_url}
                      alt="Proof"
                      className="w-full max-h-96 object-contain rounded-md mt-2 cursor-pointer transition-transform transform hover:scale-105"
                      onClick={() => window.open(task.proof_url, '_blank')}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Modal for Completing/Resubmitting Task */}
      {showCompleteModal && task && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 animate-fadeIn">
          <div className="modal-box relative bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl p-8">
            <button
              className="btn btn-sm btn-circle absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => setShowCompleteModal(false)}
            >
              ✕
            </button>
            <h2 className="text-3xl font-bold text-white mb-4">Complete Task</h2>
            <form onSubmit={handleCompleteTask} className="space-y-4">
              {/* Duration input removed; duration will be computed automatically */}
              <div>
                <label className="label">
                  <span className="label-text text-white">Comment (optional)</span>
                </label>
                <textarea
                  placeholder="Enter an optional comment..."
                  className="textarea textarea-bordered w-full"
                  value={completeComment}
                  onChange={(e) => setCompleteComment(e.target.value)}
                ></textarea>
              </div>
              <div>
                <label className="label">
                  <span className="label-text text-white">Proof (optional)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="file-input file-input-bordered w-full"
                  onChange={handleProofFileChange}
                />
              </div>
              <div className="card-actions justify-end">
                <button type="submit" className="btn btn-primary" disabled={completing}>
                  {completing ? 'Submitting...' : modalButtonText}
                </button>
              </div>
            </form>
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
