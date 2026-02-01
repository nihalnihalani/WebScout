'use client'

import { useState } from 'react'

interface RecordingMetadataModalProps {
  isOpen: boolean
  sessionId: string
  onClose: () => void
  onSubmit: (description: string) => Promise<void>
}

export default function RecordingMetadataModal({
  isOpen,
  sessionId,
  onClose,
  onSubmit,
}: RecordingMetadataModalProps) {
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!description.trim()) {
      setError('Description is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit(description.trim())
      // Reset form
      setDescription('')
      setShowCancelConfirm(false)
      setIsSubmitting(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save metadata')
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (description.trim()) {
      setShowCancelConfirm(true)
    } else {
      onClose()
    }
  }

  const confirmCancel = () => {
    setDescription('')
    setShowCancelConfirm(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-md w-full border border-gray-700">
        {!showCancelConfirm ? (
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Recording Complete</h2>
              <p className="text-sm text-gray-400 mt-1">
                Describe what you just demonstrated
              </p>
              <p className="text-xs text-gray-500 mt-1 font-mono">
                Session: {sessionId}
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Description field */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., How to log into the admin dashboard"
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>

              {/* Error message */}
              {error && (
                <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg px-4 py-2">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!description.trim() || isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          /* Cancel confirmation */
          <>
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Discard changes?</h2>
              <p className="text-sm text-gray-400 mt-1">
                Your description will be lost if you cancel.
              </p>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                Keep editing
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Discard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
