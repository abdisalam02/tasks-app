'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../../lib/supabaseClient';
import { FaSmile, FaMeh, FaFrown } from 'react-icons/fa';

interface Assignment {
  id: number;
  created_at: string;
  difficulty: string;
  duration: string;
  proof_url?: string;
  comment?: string;
  task_description: string;
  status: string; // "pending", "submitted", "completed", "declined"
  assigned_to: string;
  assigned_by: string; // Reviewer’s ID (must be set)
  // Joined reviewer profile data (for display) is returned under "reviewer"
  reviewer?: {
    user_id: string;
    username?: string;
    avatar_url?: string;
  };
  points?: number;
  review_comment?: string;
  is_approved?: boolean;
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

export default function AssignedTaskDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [task, setTask] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string>('');

  // Submission states.
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submissionComment, setSubmissionComment] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);

  // Toggle states for showing the submission/resubmission form.
  const [showSubmitForm, setShowSubmitForm] = useState<boolean>(false);
  const [showResubmitForm, setShowResubmitForm] = useState<boolean>(false);

  // Additional state for the resubmission dropdown.
  const [resubmissionReason, setResubmissionReason] = useState<string>('');

  // For full-screen image modal.
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [imageToShow, setImageToShow] = useState<string>('');

  // Current user (the submitter)
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Fetch current user.
  const fetchCurrentUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      setCurrentUserId(session.user.id);
    }
  };

  // Fetch the assignment record.
  const fetchTask = async () => {
    setLoading(true);
    setError(null);
    // Select the raw assigned_by value and join reviewer profile as "reviewer"
    const { data, error } = await supabase
      .from('assignments')
      .select(
        `
        id,
        created_at,
        difficulty,
        duration,
        proof_url,
        comment,
        task_description,
        status,
        assigned_to,
        assigned_by,
        points,
        review_comment,
        is_approved,
        reviewer:profiles(user_id, username, avatar_url)
        `
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      setError(error.message);
    } else if (!data) {
      setError('Task not found.');
    } else {
      // Normalize the reviewer field:
      // If data.reviewer is an array, take its first element.
      const normalizedReviewer =
        data.reviewer && Array.isArray(data.reviewer)
          ? data.reviewer[0]
          : data.reviewer;
      const normalizedData = { ...data, reviewer: normalizedReviewer };
      setTask(normalizedData);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (id) {
      fetchCurrentUser();
      fetchTask();
    }
  }, [id]);

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setProofFile(e.target.files[0]);
    }
  };

  // Handler for both initial submission and resubmission.
  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    setUploading(true);

    // Upload proof file if provided.
    let proofUrl = task.proof_url || null;
    let extraPoints = 0;
    if (proofFile) {
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('task-proofs')
        .upload(fileName, proofFile);
      if (uploadError) {
        setToast(`Upload error: ${uploadError.message}`);
        setUploading(false);
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from('task-proofs').getPublicUrl(fileName);
      proofUrl = publicUrl;
      extraPoints = 25;
    }

    // Update points.
    const currentPoints = task.points || 0;
    const updatedPoints = currentPoints + extraPoints;

    // Compose final comment (prepend resubmission reason if provided).
    const finalComment = resubmissionReason
      ? `${resubmissionReason}. ${submissionComment}`
      : submissionComment || task.comment;

    // Update the assignment record.
    const { error } = await supabase
      .from('assignments')
      .update({
        proof_url: proofUrl,
        comment: finalComment,
        status: 'submitted',
        points: updatedPoints,
        review_comment: null, // Clear previous review comment
        is_approved: false, // Reset approval flag
      })
      .eq('id', task.id);
    if (error) {
      setToast(`Error: ${error.message}`);
    } else {
      setToast('Task submitted for review! Extra 25 points awarded for proof!');
      // Insert a review notification for the reviewer.
      // The notification target is the user whose UUID is in assigned_by.
      const reviewerId =
        task.assigned_by || (task.reviewer ? task.reviewer.user_id : null);
      console.log('Reviewer ID for notification:', reviewerId);
      if (reviewerId) {
        const notificationPayload = {
          user_id: reviewerId, // Reviewer receives the notification.
          sender_id: currentUserId, // Submitter sends the submission.
          message: `Your assigned task "${task.task_description}" has a new submission awaiting review.`,
          is_read: false,
          assignment_id: task.id,
        };
        const { error: notifError } = await supabase
          .from('notifications')
          .insert([notificationPayload]);
        if (notifError) {
          console.error('Notification insertion error:', notifError.message);
          setToast(`Notification error: ${notifError.message}`);
        } else {
          console.log('Notification inserted:', notificationPayload);
        }
      } else {
        console.error(
          'No reviewer ID found for notification. Ensure the assignment record has a valid assigned_by value.'
        );
        setToast('Error: Reviewer information missing. Notification not sent.');
      }
      // Refresh the assignment data.
      fetchTask();
      // Reset toggles and fields.
      setShowSubmitForm(false);
      setShowResubmitForm(false);
      setResubmissionReason('');
      setSubmissionComment('');
    }
    setUploading(false);
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Render the submission/resubmission section.
  const renderSubmissionSection = () => {
    if (task?.status.toLowerCase() === 'pending') {
      return (
        <div className="flex flex-col items-center">
          {!showSubmitForm ? (
            <button className="btn btn-primary" onClick={() => setShowSubmitForm(true)}>
              Submit Task for Review
            </button>
          ) : (
            <form onSubmit={handleSubmitTask} className="space-y-4 w-full">
              <div>
                <label className="label">
                  <span className="label-text text-white">Choose Proof File</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="file-input file-input-bordered w-full bg-gray-700"
                  onChange={handleProofFileChange}
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text text-white">Comment (optional)</span>
                </label>
                <textarea
                  placeholder="Enter an optional comment..."
                  className="textarea textarea-bordered w-full bg-gray-700"
                  value={submissionComment}
                  onChange={(e) => setSubmissionComment(e.target.value)}
                ></textarea>
              </div>
              <div className="card-actions justify-end">
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Submitting...' : 'Submit & Send for Review'}
                </button>
              </div>
            </form>
          )}
        </div>
      );
    } else if (task?.status.toLowerCase() === 'submitted') {
      return (
        <div className="text-center text-lg font-semibold text-yellow-300">
          Waiting for review...
        </div>
      );
    } else if (task?.status.toLowerCase() === 'declined' || task?.status.toLowerCase() === 'completed') {
      return (
        <div className="flex flex-col items-center">
          {!showResubmitForm ? (
            <button className="btn btn-warning" onClick={() => setShowResubmitForm(true)}>
              Resubmit
            </button>
          ) : (
            <form onSubmit={handleSubmitTask} className="space-y-4 w-full">
              <div>
                <label className="label">
                  <span className="label-text text-white">Choose Proof File</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="file-input file-input-bordered w-full bg-gray-700"
                  onChange={handleProofFileChange}
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text text-white">Resubmission Reason (optional)</span>
                </label>
                <select
                  className="select select-bordered w-full bg-gray-700"
                  value={resubmissionReason}
                  onChange={(e) => setResubmissionReason(e.target.value)}
                >
                  <option value="">Select reason (optional)</option>
                  <option value="Poor quality proof">Poor quality proof</option>
                  <option value="Incorrect file">Incorrect file</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">
                  <span className="label-text text-white">Comment (optional)</span>
                </label>
                <textarea
                  placeholder="Enter an optional comment..."
                  className="textarea textarea-bordered w-full bg-gray-700"
                  value={submissionComment}
                  onChange={(e) => setSubmissionComment(e.target.value)}
                ></textarea>
              </div>
              <div className="card-actions justify-end">
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Submitting...' : 'Resubmit Proof'}
                </button>
              </div>
            </form>
          )}
        </div>
      );
    } else {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-blue-900 text-white p-4">
      <div className="container mx-auto max-w-3xl space-y-6">
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
          <div className="card bg-base-100 shadow-2xl rounded-xl p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex items-center justify-center">
                <DifficultyIcon difficulty={task.difficulty} />
              </div>
              <div className="flex-grow">
                <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
                  {task.task_description}
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-4 text-lg">
                  <div>
                    <span className="font-bold text-accent">Difficulty:</span> {task.difficulty}
                  </div>
                  <div>
                    <span className="font-bold text-accent">Duration:</span> {task.duration || 'N/A'}
                  </div>
                  <div className="text-lg font-bold text-accent">
                    Points: {task.points !== undefined ? task.points : 0}
                  </div>
                  <div className="text-lg font-bold text-accent">
                    Status: {task.status}
                  </div>
                </div>
                {task.reviewer && (
                  <div className="mt-4 flex items-center gap-3">
                    {task.reviewer.avatar_url ? (
                      <img
                        src={task.reviewer.avatar_url}
                        alt="Reviewer"
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                        <span className="font-bold">
                          {task.reviewer.username ? task.reviewer.username.charAt(0).toUpperCase() : '?'}
                        </span>
                      </div>
                    )}
                    <span className="text-lg font-bold text-accent">
                      Assigned by: {task.reviewer.username || 'Unknown'}
                    </span>
                  </div>
                )}
                {task.review_comment && (
                  <div className="mt-4 p-2 border border-dashed border-red-500 rounded">
                    <p className="text-sm italic text-red-500">
                      Review Comment: {task.review_comment}
                    </p>
                  </div>
                )}
                {task.status.toLowerCase() === 'completed' && task.proof_url && (
                  <div className="mt-6">
                    <p className="font-bold text-accent text-lg">Proof Submitted:</p>
                    <img
                      src={task.proof_url}
                      alt="Proof"
                      className="w-full max-h-96 object-contain rounded-md mt-2 cursor-pointer transition-transform transform hover:scale-105"
                      onClick={() => {
                        setImageToShow(task.proof_url as string);
                        setShowImageModal(true);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 border-t pt-4">{renderSubmissionSection()}</div>
          </div>
        ) : null}
      </div>

      {/* Full-Screen Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
          <div className="relative max-w-3xl">
            <button
              className="absolute top-4 right-4 btn btn-sm btn-circle bg-red-600 hover:bg-red-700"
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
          <div className="alert alert-success shadow-lg">
            <span>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
