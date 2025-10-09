import { AlertTriangle } from 'lucide-react';

interface VoteConfirmDialogProps {
  show: boolean;
  pendingVote: string | null;
  voting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function VoteConfirmDialog({
  show,
  pendingVote,
  voting,
  onConfirm,
  onCancel,
}: VoteConfirmDialogProps) {
  if (!show || !pendingVote) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-xl font-bold text-zinc-200 mb-4">Confirmer votre vote</h3>
        <p className="text-zinc-400 mb-6">
          Êtes-vous sûr de vouloir voter pour :<br />
          <span className="text-purple-400 font-semibold text-lg">{pendingVote}</span> ?
        </p>
        <p className="text-xs text-zinc-500 mb-6">
          <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Vous ne pourrez pas changer votre vote une fois confirmé.</span>
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-medium rounded-lg transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={voting}
            className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            {voting ? 'Envoi...' : 'Confirmer le vote'}
          </button>
        </div>
      </div>
    </div>
  );
}
