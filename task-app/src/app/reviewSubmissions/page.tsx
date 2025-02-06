'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { FaSmile, FaMeh, FaFrown } from 'react-icons/fa';

interface Assignment {
  id: number;
  created_at: string;
  difficulty: string;
  duration: string;
  proof_url?: string;
  comment?: string;
  task_description: string;
  status: string; // "submitted", "completed", "declined"
  assigned_to: string;
  // Joined submitter’s profile via the foreign key (assigned_to -> profiles)
  submitter?: {
    username?: string;
    avatar_url?: string;
  };
  points?: number;
  review_comment?: string;
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

export default function ReviewSubmissionsPage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  // Object keyed by assignment id to hold review comment input
  const [reviewComments, setReviewComments] = useState<{ [key: number]: string }>({});
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [imageToShow, setImageToShow] = useState<string>('');

  const fetchCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) setCurrentUserId(session.user.id);
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('assignments')
      .select('*, submitter:profiles(username, avatar_url)')
      .eq('assigned_by', currentUserId)
      .eq('status', 'submitted')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setSubmissions(data || []);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      await fetchCurrentUser();
    };
    init();
  }, []);

  useEffect(() => {
    if (currentUserId) fetchSubmissions();
  }, [currentUserId]);

  const handleApprove = async (assignment: Assignment) => {
    const extraPoints = 25;
    const updatedPoints = (assignment.points || 0) + extraPoints;
    // NEW: Read the review comment input for this assignment (or default to empty string)
    const reviewComment = reviewComments[assignment.id] ?? "";
    const { error } = await supabase
      .from('assignments')
      .update({
        status: 'completed',
        points: updatedPoints,
        review_comment: reviewComment, // include review comment even on approval
      })
      .eq('id', assignment.id);
    if (error) setToast(`Error: ${error.message}`);
    else {
      setToast("Submission approved! Extra points awarded.");
      const notifPayload = {
        user_id: assignment.assigned_to,
        sender_id: currentUserId,
        message: `Your submission for "${assignment.task_description}" has been approved.`,
        is_read: false,
      };
      await supabase.from('notifications').insert([notifPayload]);
      fetchSubmissions();
    }
  };

  const handleDecline = async (assignment: Assignment) => {
    const commentForThisAssignment = reviewComments[assignment.id] ?? "";
    console.log("Updating assignment", assignment.id, "with review_comment:", commentForThisAssignment);

    const { error, data } = await supabase
      .from('assignments')
      .update({
        status: 'declined',
        review_comment: commentForThisAssignment,
      })
      .eq('id', assignment.id);
    if (error) {
      console.error("Error updating review_comment:", error.message);
      setToast(`Error: ${error.message}`);
    } else {
      console.log("Assignment updated:", data);
      setToast("Submission declined.");
      const notifPayload = {
        user_id: assignment.assigned_to,
        sender_id: currentUserId,
        message: `Your submission for "${assignment.task_description}" was declined.`,
        is_read: false,
      };
      await supabase.from('notifications').insert([notifPayload]);
      fetchSubmissions();
    }
  };

  const handleViewProof = (proofUrl: string) => {
    setImageToShow(proofUrl);
    setShowImageModal(true);
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <div className="min-h-screen bg-base-200 text-base-content p-6">
      <div className="container mx-auto max-w-4xl space-y-10">
        <h1 className="text-4xl font-extrabold text-center">Review Submissions</h1>
        {loading ? (
          <p className="text-center">Loading submissions...</p>
        ) : error ? (
          <p className="text-center text-error">{error}</p>
        ) : submissions.length === 0 ? (
          <p className="text-center">No submissions awaiting review.</p>
        ) : (
          <div className="space-y-4">
            {submissions.map((assignment) => (
              <div key={assignment.id} className="card bg-base-100 shadow-lg p-4 rounded-lg">
                <div className="flex flex-col sm:flex-row justify-between items-center">
                  <div className="flex items-center gap-4">
                    {assignment.submitter && assignment.submitter.avatar_url ? (
                      <img
                        src={assignment.submitter.avatar_url}
                        alt={assignment.submitter.username || 'Submitter'}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-base-300 flex items-center justify-center">
                        <span className="text-lg font-bold">
                          {assignment.submitter && assignment.submitter.username
                            ? assignment.submitter.username.charAt(0).toUpperCase()
                            : '?'}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-bold">
                        {assignment.submitter && assignment.submitter.username
                          ? assignment.submitter.username
                          : 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Submitted: {new Date(assignment.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 sm:mt-0 flex flex-col gap-2">
                    <button className="btn btn-success btn-sm" onClick={() => handleApprove(assignment)}>
                      Approve
                    </button>
                    <button className="btn btn-error btn-sm" onClick={() => handleDecline(assignment)}>
                      Decline
                    </button>
                    {assignment.proof_url && (
                      <button className="btn btn-outline btn-sm" onClick={() => handleViewProof(assignment.proof_url!)}>
                        View Proof
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  <label className="label">
                    <span className="label-text text-sm">Review Comment (optional):</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    className="input input-bordered w-full max-w-md"
                    value={reviewComments[assignment.id] || ""}
                    onChange={(e) =>
                      setReviewComments({
                        ...reviewComments,
                        [assignment.id]: e.target.value,
                      })
                    }
                  />
                  {assignment.review_comment && assignment.review_comment.trim() !== "" && (
                    <div className="mt-1 p-2 border border-dashed border-red-500 rounded">
                      <p className="text-sm italic text-red-500">
                        Previous Comment: {assignment.review_comment}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
              alt="Proof Full View"
              className="max-w-full max-h-screen object-contain transition-all duration-300"
            />
          </div>
        </div>
      )}
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
