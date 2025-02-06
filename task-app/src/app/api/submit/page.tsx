// app/submit/page.tsx
'use client';

import { useState } from 'react';

export default function SubmitTask() {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch('/api/tasks/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ description, category })
      });
      const result = await res.json();
      if (res.ok) {
        setMessage('Task submitted successfully!');
        setDescription('');
        setCategory('');
      } else {
        setMessage(result.error || 'Error submitting task');
      }
    } catch (err) {
      setMessage('Error submitting task');
      console.error(err);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Submit a Task</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Task Description:</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Category (optional):</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <button type="submit">Submit Task</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
